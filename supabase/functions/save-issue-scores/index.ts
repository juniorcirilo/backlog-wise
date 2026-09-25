import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ScoreUpdateIn {
  key: string;
  reach?: number;
  impact?: number;
  confidence?: number;
  effort?: number;
  riceScore?: number;
  urgencyScore?: number;
  aiSummary?: string;
  suggestedSprint?: number;
  dependencies?: string[];
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function num(v: unknown, def = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
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
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user?.id) {
      return json({ error: "Unauthorized", code: "auth_expired" }, 401);
    }
    const userId = userData.user.id;

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verifica admin via has_role (mesma policy de UPDATE da tabela)
    const { data: roleRows, error: roleErr } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleErr) {
      console.error("role check failed", roleErr);
      return json({ error: "Internal", code: "internal" }, 500);
    }
    if (!roleRows) {
      return json({ error: "Forbidden: admin only", code: "forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const projectKey = typeof body?.projectKey === "string" ? body.projectKey.trim() : "";
    const updates = Array.isArray(body?.updates) ? body.updates as ScoreUpdateIn[] : [];

    if (!projectKey) return json({ error: "projectKey required" }, 400);
    if (!updates.length) return json({ ok: true, upserted: 0 });

    // Sanitiza e monta rows.
    // Se o ticket já existe, fazemos UPDATE preservando campos não enviados;
    // se não existe, INSERT com defaults da tabela.
    const now = new Date().toISOString();

    // Carrega linhas existentes para fazer merge não-destrutivo
    const issueKeys = updates.map(u => u.key).filter(Boolean);
    const { data: existing } = await adminClient
      .from("issue_scores")
      .select("*")
      .eq("project_key", projectKey)
      .in("issue_key", issueKeys);
    const byKey = new Map<string, any>();
    (existing ?? []).forEach(r => byKey.set(r.issue_key, r));

    const rows = updates
      .filter(u => typeof u.key === "string" && u.key.length > 0)
      .map(u => {
        const prev = byKey.get(u.key) ?? {};
        return {
          project_key: projectKey,
          issue_key: u.key,
          reach:            u.reach            !== undefined ? num(u.reach)            : (prev.reach            ?? 0),
          impact:           u.impact           !== undefined ? num(u.impact)           : (prev.impact           ?? 0),
          confidence:       u.confidence       !== undefined ? num(u.confidence)       : (prev.confidence       ?? 0),
          effort:           u.effort           !== undefined ? num(u.effort, 1)        : (prev.effort           ?? 1),
          rice_score:       u.riceScore        !== undefined ? num(u.riceScore)        : (prev.rice_score       ?? 0),
          urgency_score:    u.urgencyScore     !== undefined ? num(u.urgencyScore)     : (prev.urgency_score    ?? 0),
          ai_summary:       u.aiSummary        !== undefined ? String(u.aiSummary ?? "") : (prev.ai_summary      ?? null),
          suggested_sprint: u.suggestedSprint  !== undefined ? num(u.suggestedSprint)  : (prev.suggested_sprint ?? 0),
          dependencies:     Array.isArray(u.dependencies) ? u.dependencies : (prev.dependencies ?? []),
          analyzed_by: userId,
          analyzed_at: now,
        };
      });

    const { error: upsertErr, count } = await adminClient
      .from("issue_scores")
      .upsert(rows, { onConflict: "project_key,issue_key", count: "exact" });

    if (upsertErr) {
      console.error("upsert failed", upsertErr);
      return json({ error: "Failed to save scores", code: "internal" }, 500);
    }

    return json({ ok: true, upserted: count ?? rows.length });
  } catch (e) {
    console.error("save-issue-scores internal error:", e);
    return json({ error: "Internal", code: "internal" }, 500);
  }
});
