import { useCallback, useEffect, useRef, useState } from "react";
import { useDemo } from "@/contexts/DemoContext";
import { supabase } from "@/integrations/supabase/client";
import {
  getDemoIssues,
  getDemoProject,
  MOCK_ISSUES,
  MOCK_PROJECT,
  type Issue,
  type JiraProject,
} from "@/data/mock-data";

const LS_ACTIVE_PROJECT = "backlogai_active_project";
const LS_ACTIVE_PROJECTS = "backlogai_active_projects";
const SS_ISSUES_PREFIX = "backlogai_issues_";
const SS_SCORES_PREFIX = "backlogai_scores_";
const CACHE_TTL_MS = 5 * 60 * 1000;

export type ProjectIssuesError = "auth_expired" | "invalid_credentials" | "fetch_failed" | "not_connected" | "internal" | null;

// ─────────────────────────────────────────────────────────────
// Contrato de sincronizacao nao-destrutiva.
//
// Cada Issue e composta por dois conjuntos de campos:
//
//   1. Campos do Jira (source-of-truth: list-jira-issues)
//      key, id, title, body, issueType, priority, status,
//      components, labels, assignee, createdAt
//      → reescritos a cada sync.
//
//   2. Campos derivados pela IA (source-of-truth: applyScores)
//      reach, impact, confidence, effort, riceScore,
//      urgencyScore, aiSummary, suggestedSprint, dependencies
//      → atualizados APENAS quando o usuario clica em
//        "Priorizar com IA". A sincronizacao com o Jira nunca
//        os reescreve.
//
// Implementacao: o cache da fetch (`SS_ISSUES_PREFIX`) guarda os
// dados crus do Jira; os scores ficam num cache separado
// (`SS_SCORES_PREFIX`) por chave de ticket. `mergeScores` faz a
// composicao em toda leitura, sem nunca modificar o cache cru.
//
// Tickets novos (sem entrada em scores) ficam com zeros vindos do
// Jira — UI deve interpretar como "aguardando analise".
//
// Tickets fechados/Done no Jira continuam sendo retornados pelo
// list-jira-issues (a JQL nao filtra status), entao mantem score
// e historico visiveis.
// ─────────────────────────────────────────────────────────────

export interface IssueScoreUpdate {
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

interface UseProjectIssuesResult {
  issues: Issue[];
  project: JiraProject;
  loading: boolean;
  error: ProjectIssuesError;
  refetch: () => void;
  applyScores: (updates: IssueScoreUpdate[]) => void;
}

interface CachedIssues {
  fetchedAt: number;
  issues: Issue[];
  project: JiraProject;
}

function readActiveProjects(): JiraProject[] {
  try {
    const raw = localStorage.getItem(LS_ACTIVE_PROJECTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed as JiraProject[];
    }
    const single = localStorage.getItem(LS_ACTIVE_PROJECT);
    if (single) return [JSON.parse(single) as JiraProject];
  } catch {
    /* ignore */
  }
  return [];
}

function readCache(cacheKey: string): CachedIssues | null {
  try {
    const raw = sessionStorage.getItem(SS_ISSUES_PREFIX + cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedIssues;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(cacheKey: string, payload: CachedIssues) {
  try {
    sessionStorage.setItem(SS_ISSUES_PREFIX + cacheKey, JSON.stringify(payload));
  } catch {
    /* quota — ignore */
  }
}

function readScores(cacheKey: string): Record<string, IssueScoreUpdate> {
  try {
    const raw = sessionStorage.getItem(SS_SCORES_PREFIX + cacheKey);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, IssueScoreUpdate>;
  } catch {
    return {};
  }
}

function writeScores(cacheKey: string, scores: Record<string, IssueScoreUpdate>) {
  try {
    sessionStorage.setItem(SS_SCORES_PREFIX + cacheKey, JSON.stringify(scores));
  } catch {
    /* quota — ignore */
  }
}

// Sobreposicao nao-destrutiva: para cada ticket retornado pelo Jira,
// se houver scores salvos para aquela key, eles sobrescrevem APENAS
// os campos de IA. Os campos do Jira (titulo, prioridade, status,
// assignee, labels, etc) ficam como vieram do fetch.
function mergeScores(issues: Issue[], scores: Record<string, IssueScoreUpdate>): Issue[] {
  if (!Object.keys(scores).length) return issues;
  return issues.map(i => {
    const s = scores[i.key];
    if (!s) return i;
    return {
      ...i,
      reach:           s.reach           ?? i.reach,
      impact:          s.impact          ?? i.impact,
      confidence:      s.confidence      ?? i.confidence,
      effort:          s.effort          ?? i.effort,
      riceScore:       s.riceScore       ?? i.riceScore,
      urgencyScore:    s.urgencyScore    ?? i.urgencyScore,
      aiSummary:       s.aiSummary       ?? i.aiSummary,
      suggestedSprint: s.suggestedSprint ?? i.suggestedSprint,
      dependencies:    s.dependencies    ?? i.dependencies,
    };
  });
}

// Remove chaves com valor undefined antes de mesclar — evita que uma
// atualizacao parcial (analise que falhou no meio, payload incompleto)
// clobbere campos ja preservados de uma analise anterior.
function withoutUndefined(u: IssueScoreUpdate): IssueScoreUpdate {
  const out: IssueScoreUpdate = { key: u.key };
  (Object.keys(u) as Array<keyof IssueScoreUpdate>).forEach(k => {
    if (k === "key") return;
    const v = u[k];
    if (v !== undefined) (out as unknown as Record<string, unknown>)[k] = v;
  });
  return out;
}

/**
 * Carrega issues reais do Jira para o projeto ativo (ou todos os projetos
 * ativos quando `projectKey` é omitido). Em modo demo, devolve mocks.
 */
export function useProjectIssues(projectKey?: string): UseProjectIssuesResult {
  const { isDemoMode, demoProfile } = useDemo();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [project, setProject] = useState<JiraProject>(MOCK_PROJECT);
  const [loading, setLoading] = useState(!isDemoMode);
  const [error, setError] = useState<ProjectIssuesError>(null);
  const [tick, setTick] = useState(0);
  const reqIdRef = useRef(0);
  const cacheKeyRef = useRef<string>("");

  const refetch = useCallback(() => {
    if (projectKey) sessionStorage.removeItem(SS_ISSUES_PREFIX + projectKey);
    else sessionStorage.removeItem(SS_ISSUES_PREFIX + "all");
    setTick(t => t + 1);
  }, [projectKey]);

  const applyScores = useCallback((updates: IssueScoreUpdate[]) => {
    if (!updates.length) return;
    const key = cacheKeyRef.current;
    const next: Record<string, IssueScoreUpdate> = key ? readScores(key) : {};
    for (const u of updates) {
      if (!u.key) continue;
      // Spread-merge filtrando undefined: campos ausentes na atualizacao
      // nao apagam o que ja estava salvo de analises anteriores.
      next[u.key] = { ...(next[u.key] ?? { key: u.key }), ...withoutUndefined(u) };
    }
    if (key) writeScores(key, next);
    setIssues(prev => {
      const merged = mergeScores(prev, next);
      // Atualiza o cache de issues com os scores mesclados — proxima
      // remontagem ja le issues "completas", sem janela de riceScore=0
      // antes do mergeScores rodar.
      if (key) {
        const cached = readCache(key);
        if (cached) writeCache(key, { ...cached, issues: merged });
      }
      return merged;
    });

    // Acorda OUTRAS instancias do hook (ex.: FloatingChat enquanto o
    // Backlog roda "Priorizar com IA") com a MESMA cacheKey. Sem isso,
    // cada instancia tem seu proprio React state e so esta que chamou
    // applyScores ve os scores atualizados — o resto continua mostrando
    // riceScore=0 ate ser desmontado e re-montado.
    if (key && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("backlogai:scores-updated", { detail: { cacheKey: key } }),
      );
    }

    // Persistencia no servidor (tabela issue_scores) — fonte de verdade
    // compartilhada entre todos os usuarios/dispositivos. sessionStorage
    // continua como cache local para resposta sincrona.
    // Agrupa por projectKey deduzindo do prefixo da issue_key (ex.:
    // "PDVDI-42" -> "PDVDI") quando o hook foi chamado com `all` projects.
    const groups = new Map<string, IssueScoreUpdate[]>();
    for (const u of updates) {
      if (!u.key) continue;
      const dash = u.key.lastIndexOf("-");
      const pk = projectKey ?? (dash > 0 ? u.key.slice(0, dash) : "");
      if (!pk) continue;
      const arr = groups.get(pk) ?? [];
      arr.push(u);
      groups.set(pk, arr);
    }
    for (const [pk, items] of groups) {
      supabase.functions
        .invoke("save-issue-scores", { body: { projectKey: pk, updates: items } })
        .then(({ error: fnError, data }) => {
          if (fnError || (data as { error?: string } | null)?.error) {
            console.warn("[useProjectIssues] save-issue-scores falhou", {
              projectKey: pk,
              fnError: fnError?.message,
              dataError: (data as { error?: string } | null)?.error,
            });
          } else {
            console.log("[useProjectIssues] scores persistidos", {
              projectKey: pk,
              upserted: (data as { upserted?: number } | null)?.upserted,
            });
          }
        });
    }
  }, [projectKey]);

  useEffect(() => {
    // Demo mode → comportamento antigo
    if (isDemoMode) {
      setIssues(getDemoIssues(demoProfile));
      setProject(getDemoProject(demoProfile));
      setLoading(false);
      setError(null);
      return;
    }

    const active = readActiveProjects();
    const targetKeys = projectKey
      ? [projectKey]
      : active.map(p => p.key);

    const fallbackProject =
      (projectKey && active.find(p => p.key === projectKey)) ||
      active[0] ||
      MOCK_PROJECT;

    if (targetKeys.length === 0) {
      setIssues(MOCK_ISSUES);
      setProject(MOCK_PROJECT);
      setLoading(false);
      setError(null);
      return;
    }

    const cacheKey = projectKey ?? "all:" + targetKeys.join(",");
    cacheKeyRef.current = cacheKey;
    const persistedScores = readScores(cacheKey);

    const cached = readCache(cacheKey);
    if (cached) {
      setIssues(mergeScores(cached.issues, persistedScores));
      setProject(cached.project);
      setLoading(false);
      setError(null);
      return;
    }

    const myReq = ++reqIdRef.current;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        let { data: sessionData } = await supabase.auth.getSession();
        const expiresAt = sessionData.session?.expires_at ? sessionData.session.expires_at * 1000 : 0;
        if (sessionData.session && expiresAt - Date.now() < 60_000) {
          const refreshed = await supabase.auth.refreshSession();
          sessionData = refreshed.data;
        }

        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
          setError("auth_expired");
          setIssues([]);
          setProject(fallbackProject);
          setLoading(false);
          return;
        }

        const { data, error: fnError } = await supabase.functions.invoke(
          "list-jira-issues",
          {
            body: { projectKeys: targetKeys, maxPerProject: 200 },
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );

        if (myReq !== reqIdRef.current) return;

        const payload = (data ?? null) as { code?: ProjectIssuesError; error?: string } | null;

        if (fnError || !data) {
          const code = payload?.code ?? "fetch_failed";
          console.warn("[useProjectIssues] list-jira-issues falhou", {
            cacheKey, projectKeys: targetKeys,
            fnError: fnError?.message,
            dataError: payload?.error,
            code,
          });
          setError(code);
          setIssues([]);
          setProject(fallbackProject);
          setLoading(false);
          return;
        }

        if (payload?.code) {
          console.warn("[useProjectIssues] list-jira-issues retornou code", {
            cacheKey, projectKeys: targetKeys,
            code: payload.code,
            error: payload.error,
          });
          setError(payload.code);
          setIssues([]);
          setProject(fallbackProject);
          setLoading(false);
          return;
        }

        const fetchedIssues = ((data as any).issues ?? []) as Issue[];
        const meta = ((data as any).projectMeta ?? []) as Array<{
          key: string; name: string; issueCount: number; lastSyncedAt: string;
        }>;

        const primaryKey = projectKey ?? meta[0]?.key;
        const primaryMeta = meta.find(m => m.key === primaryKey) ?? meta[0];
        const resolvedProject: JiraProject = primaryMeta
          ? {
              ...fallbackProject,
              key: primaryMeta.key,
              name: primaryMeta.name || fallbackProject.name,
              issueCount: primaryMeta.issueCount,
              lastSyncedAt: primaryMeta.lastSyncedAt,
            }
          : fallbackProject;

        // Cache guarda issues JA mescladas com scores — elimina a janela
        // onde riceScore=0 aparece em re-montagens antes do mergeScores.
        const mergedIssues = mergeScores(fetchedIssues, persistedScores);
        setIssues(mergedIssues);
        setProject(resolvedProject);
        setLoading(false);
        writeCache(cacheKey, {
          fetchedAt: Date.now(),
          issues: mergedIssues,
          project: resolvedProject,
        });

        // Acorda outras instancias do hook (FloatingChat, etc) que ja estao
        // montadas e estao olhando para a mesma cacheKey — assim elas leem
        // do cache que acabamos de gravar, sem precisar refazer o fetch.
        // Mesmo evento usado pelo applyScores; aqui sinaliza "fetch inicial
        // terminou", la "scores foram atualizados". A semantica para o
        // listener e identica: re-le do cache e atualiza state.
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("backlogai:scores-updated", { detail: { cacheKey } }),
          );
        }
      } catch (e) {
        if (myReq !== reqIdRef.current) return;
        console.error("useProjectIssues fetch error", e);
        setError("internal");
        setIssues([]);
        setProject(fallbackProject);
        setLoading(false);
      }
    })();
  }, [isDemoMode, demoProfile, projectKey, tick]);

  // Sincroniza esta instancia quando OUTRA instancia chamou applyScores
  // com a mesma cacheKey (ex.: Backlog roda "Priorizar com IA" enquanto
  // o FloatingChat ja esta montado). Le do cache que applyScores acabou
  // de atualizar — sem nova chamada de rede.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ cacheKey: string }>).detail;
      if (!detail?.cacheKey || detail.cacheKey !== cacheKeyRef.current) return;
      const persistedScores = readScores(detail.cacheKey);
      const cached = readCache(detail.cacheKey);
      if (cached) setIssues(mergeScores(cached.issues, persistedScores));
    };
    window.addEventListener("backlogai:scores-updated", handler);
    return () => window.removeEventListener("backlogai:scores-updated", handler);
  }, []);

  return { issues, project, loading, error, refetch, applyScores };
}
