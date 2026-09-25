import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type JiraProjectOut = {
  id: string;
  key: string;
  name: string;
  template: "Scrum software" | "Kanban software" | "Kanban business" | "Business";
  description: string;
  lead?: string;
  issueCount: number;
  lastSyncedAt: string;
};

// Heurística simples: o endpoint /project/search devolve `style` ("classic" | "next-gen")
// e `projectTypeKey` ("software" | "business" | "service_desk"). Não dá pra saber se um
// projeto software é Scrum ou Kanban sem buscar o board, então default = Scrum software.
function mapTemplate(p: { style?: string; projectTypeKey?: string }): JiraProjectOut["template"] {
  if (p.projectTypeKey === "business") return "Business";
  if (p.projectTypeKey === "software") {
    return p.style === "next-gen" ? "Kanban software" : "Scrum software";
  }
  return "Scrum software";
}

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

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Checa role via service_role para evitar falhas transitorias de RLS/JWT.
    // has_role e SECURITY DEFINER — funciona com qualquer client.
    const { data: isAdmin, error: roleErr } = await adminClient.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) {
      console.error("has_role failed:", roleErr.message);
      return json({ error: "Internal error", code: "internal" }, 500);
    }
    if (!isAdmin) {
      console.warn("Forbidden — user is not admin", { userId });
      return json({ error: "Forbidden: admin only" }, 403);
    }

    // Lê metadata (domain + email) do registry
    const { data: registry } = await adminClient
      .from("api_keys_registry")
      .select("metadata, is_active")
      .eq("service_name", "jira")
      .maybeSingle();

    if (!registry || !registry.is_active) {
      return json({ error: "Jira not connected", code: "not_connected" }, 404);
    }

    const meta = (registry.metadata ?? {}) as { domain?: string; email?: string };
    if (!meta.domain || !meta.email) {
      return json({ error: "Metadata Jira incompleta", code: "not_connected" }, 400);
    }

    // Lê o token do Vault
    const { data: secretValue, error: readErr } = await adminClient.rpc("vault_read_secret", {
      p_service: "jira",
    });
    if (readErr || !secretValue) {
      return json({ error: "Secret not found", code: "not_connected" }, 404);
    }

    const basic = btoa(`${meta.email}:${secretValue}`);
    const projects: JiraProjectOut[] = [];
    let startAt = 0;
    const pageSize = 50;
    const maxPages = 5; // safety cap → 250 projetos

    for (let page = 0; page < maxPages; page++) {
      const url = `https://${meta.domain}/rest/api/3/project/search?maxResults=${pageSize}&startAt=${startAt}&orderBy=name&expand=lead,description`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Basic ${basic}`,
          Accept: "application/json",
        },
      });

      if (res.status === 401 || res.status === 403) {
        return json({ error: "Invalid Jira credentials", code: "invalid_credentials" }, 401);
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error("Jira project/search failed", res.status, body.slice(0, 200));
        return json({ error: "Jira request failed", code: "fetch_failed" }, 502);
      }

      const data = await res.json() as {
        values: Array<{
          id: string;
          key: string;
          name: string;
          description?: string;
          style?: string;
          projectTypeKey?: string;
          lead?: { displayName?: string };
        }>;
        isLast?: boolean;
        total?: number;
      };

      const now = new Date().toISOString();
      for (const p of data.values ?? []) {
        projects.push({
          id: p.id,
          key: p.key,
          name: p.name,
          template: mapTemplate(p),
          description: p.description ?? "",
          lead: p.lead?.displayName,
          issueCount: 0,
          lastSyncedAt: now,
        });
      }

      if (data.isLast || (data.values ?? []).length < pageSize) break;
      startAt += pageSize;
    }

    return json({ projects });
  } catch (e) {
    console.error("list-jira-projects internal error:", e);
    return json({ error: "Internal error", code: "internal" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
