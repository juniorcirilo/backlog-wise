import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  service_name: z.enum(["github", "jira"]),
  value: z.string().min(20).max(500),
  label: z.string().max(100).optional().nullable(),
  // Campos não-secretos. Para Jira: { domain, email }. Schema aberto
  // para permitir que outros serviços usem outros campos no futuro.
  metadata: z.record(z.string(), z.unknown()).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

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

    // Role check
    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden: admin only" }, 403);

    const body = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: parsed.error.flatten().fieldErrors }, 400);
    }
    const { service_name, value, label, metadata } = parsed.data;

    // Service-role client to call privileged RPCs
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Vault upsert via SECURITY DEFINER RPC. We pass the user JWT-bound client
    // to enforce has_role check inside the function.
    const { data: vaultName, error: vaultErr } = await userClient.rpc("vault_upsert_secret", {
      p_service: service_name,
      p_value: value,
    });
    if (vaultErr) {
      return json({ error: "Failed to store secret" }, 500);
    }

    // Upsert metadata row (service_role bypasses RLS)
    const { error: upsertErr } = await adminClient
      .from("api_keys_registry")
      .upsert(
        {
          service_name,
          vault_secret_name: vaultName as string,
          label: label ?? null,
          is_active: true,
          last_validation_status: "untested",
          last_validated_at: null,
          created_by: userId,
          updated_at: new Date().toISOString(),
          metadata: metadata ?? {},
        },
        { onConflict: "service_name" }
      );

    if (upsertErr) {
      console.error("api_keys_registry upsert failed:", upsertErr);
      // Rollback: remove o secret recém-gravado para não deixar lixo no Vault.
      await userClient.rpc("vault_delete_secret", { p_service: service_name }).catch(() => {});
      return json({ error: "Failed to store metadata" }, 500);
    }

    return json({ success: true });
  } catch (e) {
    console.error("store-api-key internal error:", e);
    return json({ error: "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
