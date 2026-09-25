import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type IssueOut = {
  id: string;
  key: string;
  title: string;
  body: string;
  issueType: "Bug" | "Task" | "Story" | "Epic";
  priority: "Highest" | "High" | "Medium" | "Low" | "Lowest";
  status: "To Do" | "In Progress" | "Done" | "Blocked";
  components: string[];
  labels: string[];
  assignee?: string;
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  riceScore: number;
  aiSummary: string;
  urgencyScore: number;
  dependencies: string[];
  suggestedSprint: number;
  createdAt: string;
};

type ProjectMetaOut = {
  key: string;
  name: string;
  issueCount: number;
  lastSyncedAt: string;
};

function mapType(name?: string): IssueOut["issueType"] {
  const n = (name ?? "").toLowerCase();
  if (n.includes("bug")) return "Bug";
  if (n.includes("epic")) return "Epic";
  if (n.includes("story") || n.includes("improvement")) return "Story";
  return "Task";
}

function mapPriority(name?: string): IssueOut["priority"] {
  const n = (name ?? "").toLowerCase();
  if (n === "highest" || n === "blocker") return "Highest";
  if (n === "high" || n === "critical" || n === "major") return "High";
  if (n === "low" || n === "minor") return "Low";
  if (n === "lowest" || n === "trivial") return "Lowest";
  return "Medium";
}

function mapStatus(category?: string): IssueOut["status"] {
  if (category === "done") return "Done";
  if (category === "indeterminate") return "In Progress";
  return "To Do";
}

function adfToText(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(adfToText).join("");
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  const children = adfToText(node.content ?? []);
  if (node.type === "paragraph" || node.type === "heading") return children + "\n\n";
  if (node.type === "listItem") return "- " + children + "\n";
  return children;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      // Devolve 200 com code para evitar que o reporter global trate como erro fatal.
      return json({ error: "Unauthorized", code: "auth_expired" }, 200);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user?.id) {
      console.error("Auth failed:", userError?.message);
      return json({ error: "Unauthorized", code: "auth_expired" }, 200);
    }

    // Acessivel a qualquer membro autenticado do workspace. Esta funcao apenas
    // LE issues do Jira usando as credenciais do workspace; nao expoe os
    // secrets (que ficam em vault.secrets, lidos so via service_role aqui
    // dentro). Restringir a admin quebrava o uso normal — nao-admin precisa
    // ver Backlog/Matriz/Cronograma, e admin tambem caia em 403 quando o
    // has_role falhava transitoriamente (JWT stale, role nao carregada).
    //
    // Quem pode IMPORTAR/SELECIONAR projetos para o workspace continua sendo
    // so admin (list-jira-projects + saveWorkspaceProjects → RLS de write
    // admin-only).

    const body = await req.json().catch(() => ({}));
    const projectKeys: string[] = Array.isArray(body?.projectKeys)
      ? body.projectKeys.filter((k: unknown) => typeof k === "string" && k.length > 0).slice(0, 20)
      : [];
    if (projectKeys.length === 0) return json({ error: "projectKeys required" }, 400);
    const maxPerProject = Math.min(Math.max(Number(body?.maxPerProject ?? 100), 1), 200);

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: registry } = await adminClient
      .from("api_keys_registry")
      .select("metadata, is_active")
      .eq("service_name", "jira")
      .maybeSingle();

    if (!registry || !registry.is_active) {
      return json({ error: "Jira not connected", code: "not_connected" }, 200);
    }
    const meta = (registry.metadata ?? {}) as { domain?: string; email?: string };
    if (!meta.domain || !meta.email) {
      return json({ error: "Metadata Jira incompleta", code: "not_connected" }, 200);
    }

    const { data: secretValue, error: readErr } = await adminClient.rpc("vault_read_secret", {
      p_service: "jira",
    });
    if (readErr || !secretValue) {
      return json({ error: "Secret not found", code: "not_connected" }, 200);
    }

    const basic = btoa(`${meta.email}:${secretValue}`);
    const allIssues: IssueOut[] = [];
    const projectMeta: ProjectMetaOut[] = [];
    const now = new Date().toISOString();
    const fields = [
      "summary", "description", "issuetype", "priority", "status",
      "assignee", "components", "labels", "created", "updated",
    ];

    for (const key of projectKeys) {
      let projectName = key;
      let count = 0;
      let nextPageToken: string | null = null;

      do {
        const reqBody: Record<string, unknown> = {
          jql: `project = "${key.replace(/"/g, '\\"')}" ORDER BY created DESC`,
          fields,
          maxResults: 100,
        };
        if (nextPageToken) reqBody.nextPageToken = nextPageToken;

        const url = `https://${meta.domain}/rest/api/3/search/jql`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Basic ${basic}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(reqBody),
        });

        if (res.status === 401 || res.status === 403) {
          return json({ error: "Invalid Jira credentials", code: "invalid_credentials" }, 200);
        }
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error(`Jira search/jql failed for ${key}:`, res.status, text.slice(0, 300));
          return json({ error: "Jira request failed", code: "fetch_failed", project: key }, 200);
        }

        const data = await res.json() as {
          issues?: any[];
          nextPageToken?: string | null;
          isLast?: boolean;
        };

        for (const it of data.issues ?? []) {
          if (count >= maxPerProject) break;
          const f = it.fields ?? {};
          if (!projectName || projectName === key) {
            projectName = f.project?.name ?? key;
          }
          const bodyText = typeof f.description === "string"
            ? f.description
            : adfToText(f.description);

          allIssues.push({
            id: String(it.id),
            key: it.key,
            title: f.summary ?? "(sem título)",
            body: (bodyText ?? "").trim().slice(0, 2000),
            issueType: mapType(f.issuetype?.name),
            priority: mapPriority(f.priority?.name),
            status: mapStatus(f.status?.statusCategory?.key),
            components: Array.isArray(f.components) ? f.components.map((c: any) => c.name).filter(Boolean) : [],
            labels: Array.isArray(f.labels) ? f.labels.filter(Boolean) : [],
            assignee: f.assignee?.displayName,
            reach: 0, impact: 0, confidence: 0, effort: 1,
            riceScore: 0, urgencyScore: 0,
            aiSummary: "",
            dependencies: [],
            suggestedSprint: 0,
            createdAt: f.created ?? now,
          });
          count++;
        }

        nextPageToken = data.nextPageToken ?? null;
        if (data.isLast || !nextPageToken || count >= maxPerProject) break;
      } while (nextPageToken && count < maxPerProject);

      projectMeta.push({ key, name: projectName, issueCount: count, lastSyncedAt: now });
    }

    // ── Merge persisted RICE scores from issue_scores ──
    // Garante que TODO cliente (admin, agent, janela anônima) recebe os
    // scores aplicados anteriormente via "Priorizar com IA", sem depender
    // de sessionStorage do navegador.
    try {
      const issueKeys = allIssues.map(i => i.key);
      if (issueKeys.length > 0) {
        const { data: scoreRows, error: scoresErr } = await adminClient
          .from("issue_scores")
          .select("issue_key, reach, impact, confidence, effort, rice_score, urgency_score, ai_summary, suggested_sprint, dependencies")
          .in("project_key", projectKeys)
          .in("issue_key", issueKeys);

        if (scoresErr) {
          console.warn("issue_scores read failed (continuing without merge):", scoresErr.message);
        } else if (scoreRows && scoreRows.length > 0) {
          const byKey = new Map<string, any>();
          scoreRows.forEach(r => byKey.set(r.issue_key, r));
          for (const iss of allIssues) {
            const s = byKey.get(iss.key);
            if (!s) continue;
            iss.reach           = Number(s.reach           ?? iss.reach);
            iss.impact          = Number(s.impact          ?? iss.impact);
            iss.confidence      = Number(s.confidence      ?? iss.confidence);
            iss.effort          = Number(s.effort          ?? iss.effort);
            iss.riceScore       = Number(s.rice_score      ?? iss.riceScore);
            iss.urgencyScore    = Number(s.urgency_score   ?? iss.urgencyScore);
            iss.aiSummary       = String(s.ai_summary      ?? iss.aiSummary);
            iss.suggestedSprint = Number(s.suggested_sprint ?? iss.suggestedSprint);
            iss.dependencies    = Array.isArray(s.dependencies) ? s.dependencies : iss.dependencies;
          }
        }
      }
    } catch (mergeErr) {
      console.warn("issue_scores merge threw (continuing):", mergeErr);
    }

    return json({ issues: allIssues, projectMeta });
  } catch (e) {
    console.error("list-jira-issues internal error:", e);
    return json({ error: "Internal error", code: "internal" }, 200);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
