import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  service_name: z.enum(["github", "jira"]),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden: admin only" }, 403);

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { service_name } = parsed.data;

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Read secret server-side (service_role only)
    const { data: secretValue, error: readErr } = await adminClient.rpc("vault_read_secret", {
      p_service: service_name,
    });
    if (readErr || !secretValue) {
      return json({ status: "error", message: "Secret not found" }, 404);
    }

    let status: "valid" | "invalid" | "error" = "error";
    let login: string | undefined;

    if (service_name === "github") {
      try {
        const ghRes = await fetch("https://api.github.com/user", {
          headers: {
            Authorization: `Bearer ${secretValue}`,
            "User-Agent": "BacklogAI-Validator",
            Accept: "application/vnd.github+json",
          },
        });
        if (ghRes.ok) {
          const data = await ghRes.json();
          status = "valid";
          login = data.login;
        } else if (ghRes.status === 401 || ghRes.status === 403) {
          status = "invalid";
        } else {
          status = "error";
        }
      } catch {
        status = "error";
      }
    } else if (service_name === "jira") {
      // Lê domain + email do registry (não-secretos) e bate em /myself.
      const { data: registry } = await adminClient
        .from("api_keys_registry")
        .select("metadata")
        .eq("service_name", "jira")
        .maybeSingle();

      const meta = (registry?.metadata ?? {}) as { domain?: string; email?: string };
      if (!meta.domain || !meta.email) {
        return json({ status: "error", message: "Metadata Jira incompleta" }, 400);
      }

      try {
        const basic = btoa(`${meta.email}:${secretValue}`);
        const jiraRes = await fetch(`https://${meta.domain}/rest/api/3/myself`, {
          headers: {
            Authorization: `Basic ${basic}`,
            Accept: "application/json",
          },
        });
        if (jiraRes.ok) {
          const data = await jiraRes.json();
          status = "valid";
          login = data.displayName ?? data.emailAddress;
        } else if (jiraRes.status === 401 || jiraRes.status === 403) {
          status = "invalid";
        } else {
          status = "error";
        }
      } catch {
        status = "error";
      }
    }

    if (status === "valid" || status === "invalid") {
      await adminClient
        .from("api_keys_registry")
        .update({
          last_validated_at: new Date().toISOString(),
          last_validation_status: status,
        })
        .eq("service_name", service_name);
    }

    return json({ status, login });
  } catch (_e) {
    return json({ status: "error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
