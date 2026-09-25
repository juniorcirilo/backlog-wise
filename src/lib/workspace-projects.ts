// Source-of-truth da configuracao do workspace (Jira conectado +
// projetos ativos + dominio).
//
// LEITURA: faz proxy via edge function `get-workspace-config`, que
// roda com service_role e bypassa RLS. Garante que TODOS os membros
// autenticados/aprovados/ativos veem a mesma config, independente
// de role e independente de drift na RLS de api_keys_registry.
//
// ESCRITA: continua sendo um UPDATE direto em
// `api_keys_registry.metadata.active_projects` — admin-only via RLS
// de write da tabela. Nao-admin que tentar salvar e bloqueado pelo
// banco, e isso e desejado.
//
// localStorage segue como cache local sincrono pelos hooks
// (useActiveProject, useProjectIssues); o Dashboard hidrata o cache
// a partir do workspace em todo carregamento.

import { supabase } from "@/integrations/supabase/client";
import { type JiraProject } from "@/data/mock-data";

const SERVICE = "jira";
const FIELD = "active_projects";
const LOG = "[workspace-projects]";

export interface WorkspaceConfig {
  jiraConnected: boolean;
  activeProjects: JiraProject[];
  domain: string | null;
}

/**
 * Le a config do workspace via edge function (service_role internamente).
 * Acessivel a qualquer usuario aprovado e ativo — admin, supervisor ou
 * agent. Nao depende de RLS de api_keys_registry.
 */
export async function getWorkspaceConfig(): Promise<WorkspaceConfig> {
  const { data, error } = await supabase.functions.invoke("get-workspace-config");

  if (!error) {
    const payload = (data ?? {}) as Partial<WorkspaceConfig> & { code?: string; error?: string };
    if (!payload.code) {
      const activeProjects = Array.isArray(payload.activeProjects)
        ? payload.activeProjects
        : [];

      console.log(LOG, "config carregada via edge function", {
        jiraConnected: !!payload.jiraConnected,
        activeProjectsCount: activeProjects.length,
        hasDomain: !!payload.domain,
      });

      return {
        jiraConnected: !!payload.jiraConnected,
        activeProjects,
        domain: payload.domain ?? null,
      };
    }
    console.warn(LOG, "edge function retornou code", { code: payload.code, error: payload.error });
  } else {
    console.warn(LOG, "edge function falhou", { message: error.message });
  }

  // ── Fallback: leitura direta da tabela ─────────────────
  // Admin tem RLS de SELECT em api_keys_registry; supervisor tambem.
  // Se a edge function falhar, tentamos esse caminho antes de devolver
  // estado vazio (que forcaria o onboarding a aparecer indevidamente).
  console.log(LOG, "tentando fallback via leitura direta de api_keys_registry");
  const { data: row, error: dbErr } = await supabase
    .from("api_keys_registry")
    .select("is_active, metadata")
    .eq("service_name", SERVICE)
    .maybeSingle();

  if (dbErr) {
    console.warn(LOG, "fallback tambem falhou (provavelmente RLS — usuario nao-admin)", {
      message: dbErr.message,
    });
    return { jiraConnected: false, activeProjects: [], domain: null };
  }

  if (!row) {
    console.log(LOG, "fallback: nenhuma linha em api_keys_registry");
    return { jiraConnected: false, activeProjects: [], domain: null };
  }

  const meta = (row.metadata ?? {}) as { domain?: string; active_projects?: unknown };
  const activeProjects = Array.isArray(meta.active_projects)
    ? (meta.active_projects as JiraProject[])
    : [];

  console.log(LOG, "config carregada via fallback direto", {
    jiraConnected: !!row.is_active,
    activeProjectsCount: activeProjects.length,
    hasDomain: !!meta.domain,
  });

  return {
    jiraConnected: !!row.is_active,
    activeProjects,
    domain: meta.domain ?? null,
  };
}

/** Atalho — retorna apenas a lista de projetos ativos. */
export async function getWorkspaceProjects(): Promise<JiraProject[]> {
  return (await getWorkspaceConfig()).activeProjects;
}

/**
 * Salva a lista de projetos ativos do workspace. Operacao de escrita —
 * passa direto pela RLS de UPDATE em api_keys_registry, que e admin-only.
 * Nao-admin sera bloqueado pelo banco (o que e o comportamento desejado).
 */
export async function saveWorkspaceProjects(
  projects: JiraProject[],
): Promise<{ ok: boolean; error?: string }> {
  // Le primeiro o metadata atual para nao perder domain/email no merge.
  const { data: existing, error: readErr } = await supabase
    .from("api_keys_registry")
    .select("metadata")
    .eq("service_name", SERVICE)
    .maybeSingle();

  if (readErr) {
    console.warn(LOG, "falha ao ler registry para salvar", readErr);
    return { ok: false, error: readErr.message };
  }
  if (!existing) {
    return {
      ok: false,
      error: "Jira ainda não está conectado — conecte primeiro para salvar projetos.",
    };
  }

  const currentMeta = (existing.metadata ?? {}) as Record<string, unknown>;
  const newMeta = { ...currentMeta, [FIELD]: projects };

  const { data, error: updateErr } = await supabase
    .from("api_keys_registry")
    .update({ metadata: newMeta as never })
    .eq("service_name", SERVICE)
    .select("id");

  if (updateErr) {
    console.warn(LOG, "falha no update de metadata", updateErr);
    return { ok: false, error: updateErr.message };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "Nenhuma linha foi atualizada — verifique permissões." };
  }

  console.log(LOG, "salvou", projects.length, "projeto(s) no workspace");
  return { ok: true };
}
