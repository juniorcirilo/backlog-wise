import { useEffect, useState } from "react";
import { useDemo } from "@/contexts/DemoContext";
import {
  getDemoProject,
  MOCK_PROJECT,
  type JiraProject,
} from "@/data/mock-data";
import { getWorkspaceConfig } from "@/lib/workspace-projects";

const LS_ACTIVE_PROJECT = "backlogai_active_project";
const LS_ACTIVE_PROJECTS = "backlogai_active_projects";

function readFromStorage(): JiraProject | null {
  try {
    const raw = localStorage.getItem(LS_ACTIVE_PROJECTS);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr[0]) return arr[0] as JiraProject;
    }
    const single = localStorage.getItem(LS_ACTIVE_PROJECT);
    if (single) return JSON.parse(single) as JiraProject;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Devolve o projeto Jira ativo. Estrategia:
 *   1. Modo demo → projeto mock do perfil.
 *   2. localStorage → cache sincronico (resposta imediata, sem flicker).
 *   3. Workspace via edge function → hidrata cache se localStorage vazio.
 *      Crucial para nao-admin: ele nunca passou pelo fluxo de importacao,
 *      entao seu localStorage e vazio. Sem essa hidratacao, a sidebar
 *      usaria MOCK_PROJECT e levaria Backlog/Matriz/Cronograma para uma
 *      key que nao existe no Jira.
 */
export function useActiveProject(): JiraProject {
  const { isDemoMode, demoProfile } = useDemo();
  const [project, setProject] = useState<JiraProject>(() => {
    if (isDemoMode) return getDemoProject(demoProfile);
    return readFromStorage() ?? MOCK_PROJECT;
  });

  useEffect(() => {
    if (isDemoMode) {
      setProject(getDemoProject(demoProfile));
      return;
    }

    let cancelled = false;
    const fromStorage = readFromStorage();

    if (fromStorage) {
      setProject(fromStorage);
    } else {
      // Sem cache local — busca o workspace para hidratar.
      // Importante para nao-admin que nunca passou pelo Dashboard.
      getWorkspaceConfig()
        .then((cfg) => {
          if (cancelled) return;
          if (cfg.activeProjects.length > 0) {
            const first = cfg.activeProjects[0];
            localStorage.setItem(LS_ACTIVE_PROJECTS, JSON.stringify(cfg.activeProjects));
            localStorage.setItem(LS_ACTIVE_PROJECT, JSON.stringify(first));
            setProject(first);
          } else {
            setProject(MOCK_PROJECT);
          }
        })
        .catch(() => {
          if (!cancelled) setProject(MOCK_PROJECT);
        });
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_ACTIVE_PROJECT || e.key === LS_ACTIVE_PROJECTS) {
        setProject(readFromStorage() ?? MOCK_PROJECT);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
    };
  }, [isDemoMode, demoProfile]);

  return project;
}
