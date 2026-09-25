// ─────────────────────────────────────────────────────────────
//  Edge Function · get-workspace-config
//
//  Source-of-truth da configuracao do workspace (Jira conectado +
//  projetos ativos + dominio). Usa service_role internamente para
//  bypassar RLS.
//
//  Esta versao tem logs verbosos em cada passo — qualquer falha
//  fica explicita nos Edge Function logs do Supabase. Tambem
//  parseia metadata defensivamente (jsonb pode chegar como objeto
//  OU como string serializada dependendo do driver/projeto).
// ─────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOG = "[get-workspace-config]";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized", code: "auth_expired" }, 200);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error(LOG, "missing env vars", {
        hasUrl: !!SUPABASE_URL,
        hasAnon: !!SUPABASE_ANON_KEY,
        hasService: !!SUPABASE_SERVICE_ROLE_KEY,
      });
      return json({ error: "Server misconfigured", code: "internal" }, 500);
    }

    // ── 1. Auth: valida JWT do usuario ────────────────────
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user?.id) {
      console.warn(LOG, "auth invalid", { error: userError?.message });
      return json({ error: "Unauthorized", code: "auth_expired" }, 200);
    }
    const userId = userData.user.id;
    console.log(LOG, "user autenticado", { userId });

    // ── 2. service_role: bypassa RLS ──────────────────────
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── 3. Gate: usuario aprovado e ativo ─────────────────
    const { data: profile, error: profileErr } = await adminClient
      .from("profiles")
      .select("is_active, is_approved")
      .eq("id", userId)
      .maybeSingle();
    if (profileErr) {
      console.error(LOG, "profile read failed", profileErr);
      return json({ error: "Internal error", code: "internal" }, 500);
    }
    console.log(LOG, "profile carregado", {
      found: !!profile,
      is_active: profile?.is_active,
      is_approved: profile?.is_approved,
    });
    if (!profile || !profile.is_active || !profile.is_approved) {
      return json(
        { error: "User not approved or inactive", code: "forbidden" },
        403,
      );
    }

    // ── 4. Workspace config: SELECT * sem .maybeSingle() ──
    // Usa array direto pra evitar surpresa caso haja >1 row (nao deveria
    // acontecer pelo UNIQUE em service_name, mas defensivo).
    const { data: rows, error: regErr } = await adminClient
      .from("api_keys_registry")
      .select("*")
      .eq("service_name", "jira")
      .limit(2);

    if (regErr) {
      console.error(LOG, "registry read failed", regErr);
      return json({ error: "Internal error", code: "internal" }, 500);
    }

    console.log(LOG, "raw query result", {
      rowCount: rows?.length ?? 0,
      rows: (rows ?? []).map((r) => ({
        id: r.id,
        service_name: r.service_name,
        is_active: r.is_active,
        metadata_type: typeof r.metadata,
        metadata_is_array: Array.isArray(r.metadata),
        metadata_keys: r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
          ? Object.keys(r.metadata)
          : null,
        metadata_string_preview: typeof r.metadata === "string"
          ? (r.metadata as string).slice(0, 300)
          : null,
      })),
    });

    if (!rows || rows.length === 0) {
      console.log(LOG, "nenhuma linha em api_keys_registry para service_name=jira");
      return json({
        jiraConnected: false,
        activeProjects: [],
        domain: null,
      });
    }

    const registry = rows[0];

    // ── 5. Parse defensivo de metadata ────────────────────
    // jsonb normalmente vem como objeto, mas defensivo: aceita string
    // serializada ou objeto.
    let meta: { domain?: string; email?: string; active_projects?: unknown } = {};
    const rawMeta = registry.metadata;

    if (typeof rawMeta === "string") {
      try {
        meta = JSON.parse(rawMeta);
        console.log(LOG, "metadata era string — parseado com sucesso");
      } catch (e) {
        console.warn(LOG, "metadata e string nao-JSON", {
          error: (e as Error).message,
          preview: (rawMeta as string).slice(0, 200),
        });
      }
    } else if (rawMeta && typeof rawMeta === "object") {
      meta = rawMeta as typeof meta;
    } else {
      console.warn(LOG, "metadata em formato inesperado", {
        type: typeof rawMeta,
        value: rawMeta,
      });
    }

    console.log(LOG, "metadata parseada", {
      keys: Object.keys(meta),
      hasActiveProjects: "active_projects" in meta,
      activeProjectsType: typeof meta.active_projects,
      activeProjectsIsArray: Array.isArray(meta.active_projects),
      activeProjectsLength: Array.isArray(meta.active_projects)
        ? meta.active_projects.length
        : null,
      hasDomain: !!meta.domain,
      domainPreview: meta.domain,
    });

    const activeProjects = Array.isArray(meta.active_projects)
      ? meta.active_projects
      : [];

    const result = {
      jiraConnected: !!registry.is_active,
      activeProjects,
      domain: meta.domain ?? null,
    };

    console.log(LOG, "respondendo", {
      jiraConnected: result.jiraConnected,
      activeProjectsCount: result.activeProjects.length,
      activeProjectKeys: activeProjects
        .filter((p): p is { key: string } => !!p && typeof p === "object" && "key" in p)
        .map((p) => p.key),
      hasDomain: !!result.domain,
    });

    return json(result);
  } catch (e) {
    console.error(LOG, "uncaught error", e);
    return json({ error: "Internal error", code: "internal" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
