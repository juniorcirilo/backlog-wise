import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, KanbanSquare, Search, User, AlertCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOCK_JIRA_PROJECTS, type JiraProject, type JiraProjectTemplate } from "@/data/mock-data";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/contexts/DemoContext";
import { Checkbox } from "@/components/ui/checkbox";
import { useSyncLogger } from "@/hooks/useSyncLogger";
import { saveWorkspaceProjects } from "@/lib/workspace-projects";
import { toast } from "sonner";

const LS_ACTIVE_PROJECT = "backlogai_active_project";
const LS_ACTIVE_PROJECTS = "backlogai_active_projects";
const LS_BACKLOG_ANALYZED = "backlogai_backlog_analyzed";
const LEGACY_LS_KEY = "backlogai_jira_credentials";

const TEMPLATE_BADGE: Record<JiraProjectTemplate, string> = {
  "Scrum software":  "bg-accent/10 text-accent border-accent/20",
  "Kanban software": "bg-success/10 text-success border-success/20",
  "Kanban business": "bg-warning/10 text-warning border-warning/20",
  Business:          "bg-muted text-muted-foreground border-border",
};

type LoadError = "invalid_credentials" | "not_connected" | "fetch_failed";

export default function ImportFromJira() {
  const navigate = useNavigate();
  const { isDemoMode } = useDemo();
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState<string | null>(null);
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LoadError | null>(null);
  const { logSync, completeSync } = useSyncLogger();

  useEffect(() => {
    let cancelled = false;
    localStorage.removeItem(LEGACY_LS_KEY);

    async function load() {
      // Modo demo: sempre mostra os projetos fictícios.
      if (isDemoMode) {
        if (cancelled) return;
        setProjects(MOCK_JIRA_PROJECTS);
        setDomain(null);
        setError(null);
        setLoading(false);
        return;
      }

      // Modo real: precisa do Jira conectado.
      const { data: registry } = await supabase
        .from("api_keys_registry")
        .select("is_active, label, metadata")
        .eq("service_name", "jira")
        .maybeSingle();

      if (cancelled) return;

      if (!registry?.is_active) {
        navigate("/conectar-jira", { replace: true });
        return;
      }

      const meta = (registry.metadata ?? {}) as { domain?: string };
      setDomain(meta.domain ?? registry.label ?? null);

      const { data, error: invokeErr } = await supabase.functions.invoke("list-jira-projects");
      if (cancelled) return;

      if (invokeErr || !data) {
        setError("fetch_failed");
        setLoading(false);
        return;
      }

      if ((data as { code?: LoadError }).code) {
        setError((data as { code: LoadError }).code);
        setLoading(false);
        return;
      }

      const remoteProjects = ((data as { projects?: JiraProject[] }).projects ?? []) as JiraProject[];
      setProjects(remoteProjects);
      setError(null);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [isDemoMode, navigate]);

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.key.toLowerCase().includes(query.toLowerCase())
  );

  const toggleSelected = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    const chosen = projects.filter(p => selected.has(p.key));
    if (chosen.length === 0) return;

    // Workspace = fonte de verdade. Persiste para que outros usuarios da
    // workspace vejam os projetos sem passar pelo onboarding.
    if (!isDemoMode) {
      setImporting(true);
      const res = await saveWorkspaceProjects(chosen);
      setImporting(false);
      if (!res.ok) {
        toast.error("Não foi possível salvar os projetos do workspace", {
          description: res.error,
        });
        return;
      }
    }

    // Cache local — leitura sincrona pelos hooks (useActiveProject etc).
    localStorage.setItem(LS_ACTIVE_PROJECTS, JSON.stringify(chosen));
    localStorage.setItem(LS_ACTIVE_PROJECT, JSON.stringify(chosen[0]));
    localStorage.setItem(LS_BACKLOG_ANALYZED, "false");

    // Invalida cache de issues anterior (sessão), para forçar fetch limpo.
    try {
      Object.keys(sessionStorage)
        .filter(k => k.startsWith("backlogai_issues_"))
        .forEach(k => sessionStorage.removeItem(k));
    } catch { /* noop */ }

    // Registra a importação no histórico (não bloqueia o fluxo).
    if (!isDemoMode) {
      const logId = await logSync("jira_full_sync");
      await completeSync(logId, { status: "completed", issuesProcessed: chosen.length });
    }

    navigate(`/repository/${chosen[0].key}/backlog`);
  };

  if (loading) {
    return (
      <div className="px-6 py-10 lg:px-12 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-muted rounded" />
          <div className="h-24 bg-muted rounded-2xl" />
          <div className="h-24 bg-muted rounded-2xl" />
        </div>
      </div>
    );
  }

  // Estado de erro: token inválido → CTA para reconectar.
  if (error === "invalid_credentials") {
    return (
      <div className="px-6 py-10 lg:px-12 max-w-2xl mx-auto">
        <div className="rounded-2xl border bg-card p-8 text-center shadow-elevation-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Credenciais do Jira inválidas</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            O token salvo foi recusado pela Atlassian. Pode ter expirado ou sido revogado. Reconecte para continuar.
          </p>
          <Link
            to="/conectar-jira"
            className="lp-btn-primary-indigo inline-flex mt-6"
          >
            Reconectar Jira <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  if (error === "fetch_failed") {
    return (
      <div className="px-6 py-10 lg:px-12 max-w-2xl mx-auto">
        <div className="rounded-2xl border bg-card p-8 text-center shadow-elevation-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/10 text-warning mb-4">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Não foi possível buscar os projetos</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Houve uma falha ao conversar com a API do Jira. Tente novamente em instantes.
          </p>
          <button onClick={() => window.location.reload()} className="lp-btn-primary-indigo inline-flex mt-6">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const hasReal = !isDemoMode;
  const selectionCount = selected.size;

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 px-6 py-10 lg:px-12 max-w-5xl w-full mx-auto">
      <header className="flex items-start justify-between flex-wrap gap-4 mb-7">
        <div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase text-success mb-1">
            <Check className="h-3.5 w-3.5" /> Conectado ao Jira
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Escolha um ou mais projetos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {hasReal && domain
              ? <>Importando de <span className="font-mono text-foreground">{domain}</span></>
              : isDemoMode
                ? "Projetos de demonstração — desative o Modo Demo para listar projetos da sua conta Jira."
                : "Selecione quais projetos Jira você quer priorizar com IA."}
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por nome ou chave…"
            className="w-full rounded-xl border bg-bg-elevated pl-9 pr-3 py-2 text-sm outline-none transition-all placeholder:text-muted-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </div>
      </header>

      {isDemoMode && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-accent/20 bg-accent/5 px-3.5 py-2.5 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 mt-0.5 text-accent flex-shrink-0" />
          <span>
            <span className="font-semibold text-foreground">Modo demonstração ativo.</span>{" "}
            Estes não são seus projetos reais. Desative em <Link to="/settings" className="text-accent hover:underline">Configurações</Link> para listar sua conta Jira.
          </span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground">
          {projects.length === 0
            ? "Nenhum projeto encontrado nesta conta Jira."
            : <>Nenhum projeto encontrado para "<span className="font-semibold">{query}</span>".</>}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(project => {
            const isSelected = selected.has(project.key);
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => toggleSelected(project.key)}
                className={cn(
                  "group block w-full text-left rounded-2xl border bg-card p-5 shadow-elevation-1 transition-all hover:border-accent hover:shadow-elevation-3",
                  isSelected && "border-accent ring-2 ring-accent/30"
                )}
              >
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelected(project.key)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Selecionar ${project.name}`}
                  />

                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-bg-surface-1 flex-shrink-0">
                    <KanbanSquare className="h-6 w-6 text-foreground" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs font-bold text-muted-foreground">{project.key}</span>
                      <span className="text-muted-foreground/50">·</span>
                      <p className="font-semibold truncate text-foreground">{project.name}</p>
                      <span className={cn(
                        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium",
                        TEMPLATE_BADGE[project.template]
                      )}>
                        {project.template}
                      </span>
                    </div>
                    {project.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1">{project.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      {project.lead && (
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3" /> {project.lead}
                        </span>
                      )}
                      {project.issueCount > 0 && <span>{project.issueCount} tickets</span>}
                      <span>
                        Atualizado {new Date(project.lastSyncedAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      </div>

      {/* Rodapé sticky de confirmação (confinado à área principal) */}
      <div className="sticky bottom-0 z-10 mt-auto border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="px-6 lg:px-12 py-3 max-w-5xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-muted-foreground">
            {selectionCount === 0
              ? "Nenhum projeto selecionado"
              : selectionCount === 1
                ? "1 projeto selecionado"
                : `${selectionCount} projetos selecionados`}
          </p>
          <button
            onClick={handleImport}
            disabled={selectionCount === 0 || importing}
            className="lp-btn-primary-indigo disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? "Salvando…" : "Importar selecionados"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
