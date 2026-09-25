import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Plus,
  Clock,
  AlertTriangle,
  KanbanSquare,
  List,
  Sparkles,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  Loader2,
  XCircle,
  Zap,
  Lock,
} from "lucide-react";
import ScrollReveal from "@/components/lp/ScrollReveal";
import OnboardingSteps from "@/components/dashboard/OnboardingSteps";
import { useDemo } from "@/contexts/DemoContext";
import { useActiveProject } from "@/hooks/useActiveProject";
import { useProjectIssues } from "@/hooks/useProjectIssues";
import { getDemoActivities, type JiraProject, type DemoActivity } from "@/data/mock-data";
import { cn } from "@/lib/utils";
import { getWorkspaceConfig, saveWorkspaceProjects } from "@/lib/workspace-projects";

const LEGACY_LS_KEY = "backlogai_jira_credentials";
const LS_ACTIVE_PROJECT = "backlogai_active_project";
const LS_ACTIVE_PROJECTS = "backlogai_active_projects";


function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

const SYNC_LABELS: Record<string, string> = {
  jira_full_sync: "Sincronização completa do Jira",
  jira_incremental: "Sincronização incremental",
  ai_analysis: "Análise com IA",
};

function syncIcon(type: string) {
  if (type.startsWith("ai")) return Sparkles;
  return RefreshCw;
}

function statusBadge(status: string) {
  if (status === "completed")
    return { Icon: CheckCircle2, cls: "bg-success/10 text-success border-success/20", label: "concluído" };
  if (status === "failed")
    return { Icon: XCircle, cls: "bg-destructive/10 text-destructive border-destructive/20", label: "falhou" };
  return { Icon: Loader2, cls: "bg-warning/10 text-warning-foreground border-warning/20", label: "em execução" };
}

interface ProjectCardProps {
  project: JiraProject;
}

function ProjectCard({ project }: ProjectCardProps) {
  const { issues, loading } = useProjectIssues(project.key);

  const metrics = useMemo(() => {
    const total = issues.length;
    const analyzed = issues.filter(i => typeof i.riceScore === "number" && i.riceScore > 0).length;
    const scored = issues.filter(i => typeof i.riceScore === "number" && i.riceScore > 0);
    const avg = scored.length
      ? Math.round(scored.reduce((s, i) => s + (i.riceScore || 0), 0) / scored.length)
      : 0;
    return { total, analyzed, avg };
  }, [issues]);

  const scoreTone =
    metrics.avg > 50
      ? "text-success"
      : metrics.avg >= 20
        ? "text-warning-foreground"
        : metrics.avg > 0
          ? "text-destructive"
          : "text-muted-foreground";

  const lastSync = project.lastSyncedAt ? formatRelative(project.lastSyncedAt) : "—";

  return (
    <Link
      to={`/repository/${project.key}/backlog`}
      className={cn(
        "group block rounded-2xl border bg-bg-elevated p-5 shadow-elevation-2",
        "transition-all hover:shadow-elevation-3 hover:border-accent/30",
      )}
    >
      {/* Linha superior */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-bg-surface-1">
            <KanbanSquare className="h-5 w-5 text-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center rounded-md bg-bg-surface-2 px-2 py-0.5 font-mono text-[11px] font-semibold text-text-secondary">
                {project.key}
              </span>
            </div>
            <p className="mt-1 truncate text-[18px] font-bold leading-tight">{project.name}</p>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {project.description}
            </p>
          </div>
        </div>
        <span className="badge-priority-low flex-shrink-0">{project.template}</span>
      </div>

      {/* Métricas */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniMetric Icon={List} label="Tickets" value={loading ? "…" : metrics.total} />
        <MiniMetric
          Icon={Sparkles}
          label="Analisados"
          value={loading ? "…" : metrics.analyzed}
          tone="text-accent"
        />
        <MiniMetric
          Icon={TrendingUp}
          label="RICE médio"
          value={loading ? "…" : metrics.avg || "—"}
          tone={scoreTone}
        />
      </div>

      {/* Linha inferior */}
      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Último sync: {lastSync}</span>
        <span className="font-semibold text-accent group-hover:underline">Abrir backlog →</span>
      </div>
    </Link>
  );
}

function MiniMetric({
  Icon,
  label,
  value,
  tone = "text-foreground",
}: {
  Icon: typeof List;
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface-1 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", tone)} />
        <span className="truncate">{label}</span>
      </div>
      <p className={cn("mt-0.5 text-lg font-bold leading-none", tone)}>{value}</p>
    </div>
  );
}

interface MetricCardProps {
  Icon: typeof List;
  label: string;
  value: string | number;
  sub?: string;
  tone?: string;
  iconBg?: string;
}

function MetricCard({ Icon, label, value, sub, tone = "text-foreground", iconBg = "bg-bg-surface-1 text-foreground" }: MetricCardProps) {
  return (
    <div className="rounded-xl border bg-bg-elevated p-5 shadow-elevation-2">
      <div className="flex items-center gap-2">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", iconBg)}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      </div>
      <p className={cn("mt-3 text-3xl font-bold leading-none tabular-nums", tone)}>{value}</p>
      {sub && <p className="mt-2 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ConsolidatedMetrics({ projects, activeKey }: { projects: JiraProject[]; activeKey?: string }) {
  // Lê as issues do projeto ativo usando a MESMA cacheKey do Backlog,
  // garantindo que os scores aplicados via "Priorizar com IA" apareçam aqui.
  const { issues, loading } = useProjectIssues(activeKey);

  const metrics = useMemo(() => {
    const total = issues.length;
    const critical = issues.filter(i => i.priority === "Highest" || i.priority === "High").length;
    const scored = issues.filter(i => typeof i.riceScore === "number" && i.riceScore > 0);
    const avg = scored.length
      ? Math.round(scored.reduce((s, i) => s + (i.riceScore || 0), 0) / scored.length)
      : 0;
    // Quick Wins: alto RICE (≥ 40) e baixo esforço (≤ 4).
    const quickWins = scored.filter(i => (i.effort ?? 99) <= 4 && (i.riceScore || 0) >= 40).length;
    return { total, critical, avg, scored: scored.length, quickWins };
  }, [issues]);


  const avgTone =
    metrics.avg > 50 ? "text-success"
      : metrics.avg >= 20 ? "text-warning-foreground"
      : metrics.avg > 0 ? "text-destructive"
      : "text-muted-foreground";

  const dash = loading ? "…" : null;

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        Icon={List}
        label="Total de tickets"
        value={dash ?? metrics.total}
        sub={`em ${projects.length} projeto${projects.length === 1 ? "" : "s"}`}
      />
      <MetricCard
        Icon={AlertTriangle}
        label="Tickets críticos"
        value={dash ?? metrics.critical}
        sub="prioridade Highest ou High"
        tone="text-destructive"
        iconBg="bg-destructive/10 text-destructive"
      />
      <MetricCard
        Icon={TrendingUp}
        label="Score RICE médio"
        value={dash ?? (metrics.avg || "—")}
        sub={metrics.scored > 0 ? `${metrics.scored} tickets analisados` : "nenhum ticket analisado ainda"}
        tone={avgTone}
        iconBg={
          metrics.avg > 50 ? "bg-success/10 text-success"
            : metrics.avg >= 20 ? "bg-warning/15 text-warning-foreground"
            : "bg-bg-surface-1 text-muted-foreground"
        }
      />
      <MetricCard
        Icon={Zap}
        label="Quick Wins"
        value={dash ?? metrics.quickWins}
        sub="alto RICE e baixo esforço"
        tone="text-success"
        iconBg="bg-success/10 text-success"
      />
    </div>
  );
}

export default function Dashboard() {
  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { isDemoMode, demoProfile } = useDemo();
  const demoProject = useActiveProject();
  const [jiraConnected, setJiraConnected] = useState(false);
  // Workspace e a fonte-de-verdade. localStorage e apenas cache hidratado.
  const [workspaceProjects, setWorkspaceProjects] = useState<JiraProject[]>([]);
  const [activeProject, setActiveProject] = useState<JiraProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userName = profile?.full_name || user?.email?.split("@")[0] || "";
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  })();
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  useEffect(() => {
    if (!user || authLoading) return;
    let cancelled = false;
    let redirecting = false;
    async function load() {
      localStorage.removeItem(LEGACY_LS_KEY);
      try {
        // Source-of-truth unica do workspace. A edge function usa
        // service_role internamente, entao retorna a mesma config
        // para qualquer usuario aprovado/ativo (admin ou nao-admin).
        const cfg = await getWorkspaceConfig();
        if (cancelled) return;

        const connected = cfg.jiraConnected;
        let wsProjects = cfg.activeProjects;

        setJiraConnected(connected);

        console.log("[Dashboard] diagnostico", {
          userId: user.id,
          isAdmin,
          jiraConnected: connected,
          workspaceProjectsCount: wsProjects.length,
          workspaceProjectKeys: wsProjects.map(p => p.key),
        });

        // Admin com Jira conectado e workspace vazio:
        //   1) tenta migrar do localStorage (caso save anterior tenha falhado)
        //   2) se nao tiver nada para migrar, manda direto pra /importar-jira
        if (connected && isAdmin && wsProjects.length === 0) {
          let migrated = false;
          try {
            const localRaw = localStorage.getItem(LS_ACTIVE_PROJECTS);
            if (localRaw) {
              const localProjects = JSON.parse(localRaw) as JiraProject[];
              if (Array.isArray(localProjects) && localProjects.length > 0) {
                console.log(
                  "[Dashboard] migrando", localProjects.length,
                  "projeto(s) do localStorage para workspace",
                );
                const res = await saveWorkspaceProjects(localProjects);
                if (cancelled) return;
                if (res.ok) {
                  wsProjects = localProjects;
                  migrated = true;
                } else {
                  console.warn("[Dashboard] migracao falhou:", res.error);
                }
              }
            }
          } catch (e) {
            console.warn("[Dashboard] erro lendo localStorage para migracao", e);
          }

          if (!migrated && wsProjects.length === 0) {
            console.log(
              "[Dashboard] admin sem projetos e sem cache local — redirecionando para /importar-jira",
            );
            redirecting = true;
            navigate("/importar-jira", { replace: true });
            return;
          }
        }

        setWorkspaceProjects(wsProjects);

        // Hidrata cache local a partir do workspace (workspace ganha sempre).
        if (wsProjects.length > 0) {
          localStorage.setItem(LS_ACTIVE_PROJECTS, JSON.stringify(wsProjects));
          const savedRaw = localStorage.getItem(LS_ACTIVE_PROJECT);
          let active: JiraProject | null = null;
          if (savedRaw) {
            try {
              const saved = JSON.parse(savedRaw) as JiraProject;
              active = wsProjects.find(p => p.key === saved.key) ?? null;
            } catch { /* ignore */ }
          }
          if (!active) active = wsProjects[0];
          localStorage.setItem(LS_ACTIVE_PROJECT, JSON.stringify(active));
          setActiveProject(active);
        } else {
          localStorage.removeItem(LS_ACTIVE_PROJECTS);
          localStorage.removeItem(LS_ACTIVE_PROJECT);
          setActiveProject(null);
        }
      } catch (e) {
        console.error("[Dashboard] falha em load()", e);
        if (!cancelled) setError("Não foi possível carregar suas preferências. Tente recarregar a página.");
      } finally {
        // Se estamos redirecionando, mantem o skeleton de loading ate o
        // React Router montar a nova rota — sem flash do estado vazio.
        if (!cancelled && !redirecting) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, isAdmin, navigate]);

  // Issues do projeto principal para o resumo dinâmico
  const primaryKey = isDemoMode ? demoProject.key : activeProject?.key;
  const { issues: primaryIssues } = useProjectIssues(primaryKey);

  const summary = useMemo(() => {
    if (!isDemoMode && !activeProject) return null;
    const total = primaryIssues.length;
    const scored = primaryIssues.filter(i => typeof i.riceScore === "number" && i.riceScore > 0);
    const analyzed = scored.length;
    if (total === 0) return null;
    if (analyzed === 0) return `Você tem ${total} tickets aguardando análise`;
    const avg = Math.round(scored.reduce((s, i) => s + (i.riceScore || 0), 0) / scored.length);
    const quickWins = scored.filter(i => (i.effort ?? 99) <= 3 && (i.impact ?? 0) >= 6).length;
    return `Score médio do backlog: ${avg} · ${quickWins} Quick Win${quickWins === 1 ? "" : "s"} identificado${quickWins === 1 ? "" : "s"}`;
  }, [primaryIssues, isDemoMode, activeProject]);

  if (loading || authLoading) {
    return (
      <div className="px-6 py-8 lg:px-12 lg:py-10 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-64 bg-muted rounded" />
          <div className="h-40 bg-muted rounded-2xl" />
        </div>
      </div>
    );
  }

  const workspaceHasProjects = workspaceProjects.length > 0;
  const showDashboard = isDemoMode || workspaceHasProjects;

  // Onboarding: SOMENTE admin que ainda nao configurou o workspace.
  // Usuarios nao-admin nunca veem o setup — cabe ao admin conectar o Jira
  // e selecionar projetos para a workspace inteira.
  const showOnboarding = !isDemoMode && isAdmin && !workspaceHasProjects;
  const showWaitingForAdmin = !isDemoMode && !isAdmin && !workspaceHasProjects;

  console.log("[Dashboard] decisao de view", {
    isDemoMode, isAdmin,
    workspaceHasProjects,
    view: showOnboarding ? "onboarding"
      : showWaitingForAdmin ? "waiting"
      : "dashboard",
  });

  const displayProjects: JiraProject[] = isDemoMode
    ? [demoProject]
    : workspaceProjects;
  const displayLogs: DemoActivity[] = isDemoMode ? getDemoActivities(demoProfile) : [];

  // Estado A — Onboarding (admin sem projetos no workspace)
  if (showOnboarding) {
    return (
      <div className="px-6 py-4 lg:px-12 lg:py-6 max-w-7xl mx-auto">
        {error && (
          <div className="mb-6 rounded-xl border border-destructive/20 bg-destructive/10 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
        <OnboardingSteps jiraConnected={jiraConnected} hasProject={false} />
      </div>
    );
  }

  // Estado A' — Aguardando admin (nao-admin sem projetos)
  if (showWaitingForAdmin) {
    return (
      <div className="px-6 py-10 lg:px-12 max-w-3xl mx-auto">
        {error && (
          <div className="mb-6 rounded-xl border border-destructive/20 bg-destructive/10 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
        <div className="rounded-2xl border bg-card p-10 text-center shadow-elevation-1">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">Aguardando configuração</h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
            Um administrador ainda não conectou a conta Jira ao workspace.
            Você verá os projetos aqui assim que a configuração for concluída.
          </p>
        </div>
      </div>
    );
  }

  const headerSummary =
    summary ?? (workspaceHasProjects || isDemoMode
      ? "Bem-vindo de volta. Aqui está um resumo do seu backlog."
      : "Configure sua primeira integração para começar");

  // Estado B — Dashboard ativo
  return (
    <div className="px-6 py-8 lg:px-12 lg:py-10 max-w-7xl mx-auto">
      <ScrollReveal>
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              {greeting}, {userName} 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-1 capitalize">{today}</p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary">
              <Zap className="h-4 w-4 text-accent" />
              {headerSummary}
            </p>
          </div>
          {/* Apenas admin pode importar/gerenciar projetos do workspace. */}
          {(isAdmin || isDemoMode) && (
            <button
              type="button"
              onClick={() => navigate("/importar-jira")}
              className="lp-btn-primary-indigo"
            >
              <Plus className="h-4 w-4" /> Adicionar Projeto
            </button>
          )}
        </div>
      </ScrollReveal>

      {error && (
        <div className="mt-6 rounded-xl border border-destructive/20 bg-destructive/10 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Métricas consolidadas */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold tracking-tight">Visão geral</h2>
        <ConsolidatedMetrics projects={displayProjects} activeKey={primaryKey} />
      </section>

      {/* Projetos */}
      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">Seus projetos</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {displayProjects.map((p, i) => (
            <ScrollReveal key={p.id} delay={i * 0.05}>
              <ProjectCard project={p} />
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Atividade recente — só quando há registros */}
      {displayLogs.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">Atividade recente</h2>
          <ul className="mt-4 rounded-2xl border bg-bg-elevated divide-y divide-border shadow-elevation-1 overflow-hidden">
            {displayLogs.map(l => {
              const Icon = syncIcon(l.sync_type);
              const { Icon: SIcon, cls, label } = statusBadge(l.status);
              const title = SYNC_LABELS[l.sync_type] ?? l.sync_type.replace(/_/g, " ");
              return (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-bg-surface-1"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-surface-1 text-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{title}</p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelative(l.started_at)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                      cls,
                    )}
                  >
                    <SIcon className={cn("h-3 w-3", l.status === "running" && "animate-spin")} />
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
