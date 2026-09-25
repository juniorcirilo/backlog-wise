import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  CalendarDays, BarChart3, Target, Clock, Layers, Filter, Info, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MOCK_JIRA_PROJECTS,
  type Issue, type IssueType, type Priority,
} from "@/data/mock-data";
import { useDemo } from "@/contexts/DemoContext";
import { useProjectIssues } from "@/hooks/useProjectIssues";
import IssueDrawer from "@/components/backlog/IssueDrawer";

type GroupBy = "sprint" | "priority";

const ISSUE_TYPE_ORDER: IssueType[] = ["Bug", "Task", "Story", "Epic"];
const PRIORITY_ORDER: Priority[] = ["Highest", "High", "Medium", "Low", "Lowest"];

const ISSUE_TYPE_BADGE: Record<IssueType, string> = {
  Bug:   "bg-destructive/10 text-destructive border-destructive/20",
  Task:  "bg-muted text-muted-foreground border-border",
  Story: "bg-success/10 text-success border-success/20",
  Epic:  "bg-accent/10 text-accent border-accent/20",
};

const ISSUE_TYPE_DOT: Record<IssueType, string> = {
  Bug:   "bg-destructive",
  Task:  "bg-muted-foreground",
  Story: "bg-success",
  Epic:  "bg-accent",
};

const PRIORITY_DOT: Record<Priority, string> = {
  Highest: "bg-destructive",
  High:    "bg-warning",
  Medium:  "bg-accent",
  Low:     "bg-muted-foreground",
  Lowest:  "bg-muted",
};

// Sprint 1 começa numa data fixa para que o cronograma seja estável entre
// renders e demos. Em produção viria do projeto Jira.
const SPRINT_1_START = new Date("2026-04-28T00:00:00Z");
const SPRINT_LENGTH_DAYS = 14;
const TOTAL_SPRINTS = 4;

interface SprintInfo {
  num: number;
  start: Date;
  end: Date;
  label: string;
  range: string;
}

function buildSprints(): SprintInfo[] {
  const sprints: SprintInfo[] = [];
  for (let i = 0; i < TOTAL_SPRINTS; i++) {
    const start = new Date(SPRINT_1_START);
    start.setUTCDate(start.getUTCDate() + i * SPRINT_LENGTH_DAYS);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + SPRINT_LENGTH_DAYS - 1);
    const fmt = (d: Date) =>
      d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
    sprints.push({
      num: i + 1,
      start,
      end,
      label: `Sprint ${i + 1}`,
      range: `${fmt(start)} – ${fmt(end)}`,
    });
  }
  return sprints;
}

function TicketCard({ issue, onClick }: { issue: Issue; onClick: (i: Issue) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick(issue)}
      className="w-full text-left rounded-lg border bg-card px-2.5 py-2 shadow-elevation-1 hover:shadow-elevation-2 hover:border-accent/40 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-mono text-[10px] font-bold text-muted-foreground">
          {issue.key}
        </span>
        <span
          className={cn(
            "inline-flex rounded border px-1.5 py-0.5 text-[9px] font-medium",
            ISSUE_TYPE_BADGE[issue.issueType],
          )}
        >
          {issue.issueType}
        </span>
      </div>
      <p className="text-xs leading-snug line-clamp-2 text-foreground">
        {issue.title}
      </p>
      <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground">
        <span>{issue.priority}</span>
        <span className="font-bold text-accent">RICE {issue.riceScore}</span>
      </div>
    </button>
  );
}


export default function Roadmap() {
  const { repository_id } = useParams();
  const [groupBy, setGroupBy] = useState<GroupBy>("sprint");
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const { isDemoMode } = useDemo();


  const sprints = useMemo(buildSprints, []);

  const projectKey = repository_id?.toUpperCase() ?? "PLAT";
  const { issues, project } = useProjectIssues(repository_id);

  // Em demo: o hook devolve mocks. Em real: issues do Jira do projeto.
  const projectInfo = project
    ?? MOCK_JIRA_PROJECTS.find(p => p.key === projectKey)
    ?? MOCK_JIRA_PROJECTS[0];

  // Resolve o sprint efetivo de um ticket. Tickets reais vindos do Jira não
  // têm `suggestedSprint` populado (fica 0), então caímos num fallback baseado
  // em priority: Highest→1, High→2, Medium→3, Low/Lowest→4.
  const PRIORITY_TO_SPRINT: Record<Priority, number> = {
    Highest: 1, High: 2, Medium: 3, Low: 4, Lowest: 4,
  };
  const effectiveSprint = (t: Issue): number => {
    if (t.suggestedSprint && t.suggestedSprint > 0) {
      return Math.min(Math.max(1, t.suggestedSprint), TOTAL_SPRINTS);
    }
    return PRIORITY_TO_SPRINT[t.priority] ?? TOTAL_SPRINTS;
  };

  const tickets = useMemo(() => issues, [issues]);

  const totalEffort = tickets.reduce((sum, t) => sum + t.effort, 0);
  const lastSprint = tickets.length
    ? Math.min(TOTAL_SPRINTS, Math.max(1, ...tickets.map(effectiveSprint)))
    : 1;
  const completionDate = sprints[lastSprint - 1]?.end;

  const typeCounts: Record<IssueType, number> = { Bug: 0, Task: 0, Story: 0, Epic: 0 };
  tickets.forEach(t => { typeCounts[t.issueType] = (typeCounts[t.issueType] ?? 0) + 1; });

  // Linhas (rows) do timeline dependem do agrupamento.
  const rows: Array<{ key: string; label: string; dotClass: string; tickets: Issue[] }> =
    groupBy === "sprint"
      ? ISSUE_TYPE_ORDER.map(t => ({
          key: t,
          label: t,
          dotClass: ISSUE_TYPE_DOT[t],
          tickets: tickets.filter(i => i.issueType === t),
        }))
      : PRIORITY_ORDER.map(p => ({
          key: p,
          label: p,
          dotClass: PRIORITY_DOT[p],
          tickets: tickets.filter(i => i.priority === p),
        }));

  return (
    <div className="px-6 py-8 lg:px-12 lg:py-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-mono text-muted-foreground mb-1">
            {projectInfo.key} · {projectInfo.name}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">Cronograma</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tickets.length} tickets · sprints de 2 semanas · agrupados {groupBy === "sprint" ? "por tipo de ticket" : "por prioridade"}
          </p>
        </div>

        {/* Toggle */}
        <div className="inline-flex rounded-xl border bg-bg-surface-1 p-1">
          <button
            onClick={() => setGroupBy("sprint")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              groupBy === "sprint"
                ? "bg-card text-foreground shadow-elevation-1"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            Por Sprint
          </button>
          <button
            onClick={() => setGroupBy("priority")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              groupBy === "priority"
                ? "bg-card text-foreground shadow-elevation-1"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            Por Prioridade
          </button>
        </div>
      </div>

      {/* Explainer (colapsável, fechado por padrão) */}
      <RoadmapExplainer />

      {/* Layout: side panel + timeline */}
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">

        {/* ── Side panel ────────────────────────────────── */}
        <aside className="space-y-4">
          {/* Resumo */}
          <div className="rounded-2xl border bg-card p-4 shadow-elevation-1">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Resumo
              </p>
            </div>
            <p className="text-3xl font-bold tracking-tight">{tickets.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              tickets no cronograma
            </p>
          </div>

          {/* Distribuição por tipo */}
          <div className="rounded-2xl border bg-card p-4 shadow-elevation-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Distribuição por tipo
            </p>
            <div className="space-y-2.5">
              {ISSUE_TYPE_ORDER.map(t => {
                const count = typeCounts[t];
                const pct = tickets.length === 0 ? 0 : (count / tickets.length) * 100;
                return (
                  <div key={t}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={cn("h-2 w-2 rounded-full", ISSUE_TYPE_DOT[t])} />
                        <span className="font-medium">{t}</span>
                      </div>
                      <span className="font-semibold tabular-nums">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", ISSUE_TYPE_DOT[t])}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Conclusão estimada */}
          <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-accent" />
              <p className="text-xs font-semibold uppercase tracking-widest text-accent">
                Conclusão estimada
              </p>
            </div>
            <p className="text-sm font-bold">
              Sprint {lastSprint}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {completionDate
                ? completionDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
                : "—"}
            </p>
          </div>

          {/* Esforço total */}
          <div className="rounded-2xl border bg-card p-4 shadow-elevation-1">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Esforço total
              </p>
            </div>
            <p className="text-2xl font-bold tabular-nums">{totalEffort}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              pontos de esforço (escala 1–10)
            </p>
          </div>
        </aside>

        {/* ── Timeline ─────────────────────────────────── */}
        <div className="rounded-2xl border bg-card shadow-elevation-1 overflow-hidden">
          {/* Sprint header */}
          <div className="grid border-b bg-bg-surface-1" style={{ gridTemplateColumns: "120px repeat(4, minmax(0, 1fr))" }}>
            <div className="px-4 py-3 flex items-center gap-1.5 border-r">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {groupBy === "sprint" ? "Tipo" : "Prioridade"}
              </span>
            </div>
            {sprints.map(s => (
              <div key={s.num} className="px-3 py-3 border-r last:border-r-0">
                <p className="text-sm font-bold">{s.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.range}</p>
              </div>
            ))}
          </div>

          {/* Group rows */}
          {rows.map((row, rowIdx) => (
            <div
              key={row.key}
              className={cn(
                "grid",
                rowIdx < rows.length - 1 && "border-b",
              )}
              style={{ gridTemplateColumns: "120px repeat(4, minmax(0, 1fr))" }}
            >
              {/* Row label */}
              <div className="px-4 py-3 border-r bg-bg-surface-1/40 flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full flex-shrink-0", row.dotClass)} />
                <span className="text-sm font-semibold">{row.label}</span>
                <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                  {row.tickets.length}
                </span>
              </div>

              {/* Sprint cells */}
              {sprints.map(s => {
                const cellTickets = row.tickets.filter(t => effectiveSprint(t) === s.num);
                return (
                  <div
                    key={`${row.key}-${s.num}`}
                    className="border-r last:border-r-0 p-2 space-y-1.5 min-h-[88px]"
                  >
                    {cellTickets.map(t => <TicketCard key={t.id} issue={t} onClick={setSelectedIssue} />)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {!isDemoMode && (
        <p className="mt-6 text-xs text-muted-foreground text-center">
          📅 Este cronograma é gerado automaticamente com base nos scores RICE e prioridades. Quando os sprints reais do Jira forem integrados, as datas serão atualizadas automaticamente.
        </p>
      )}

      <IssueDrawer
        issue={selectedIssue}
        allIssues={issues}
        siblings={tickets}
        onNavigate={setSelectedIssue}
        onClose={() => setSelectedIssue(null)}
      />
    </div>
  );
}

function RoadmapExplainer() {
  const [open, setOpen] = useState(false);
  const items = [
    { icon: "📅", title: "Sprints",      desc: "Cada coluna representa 2 semanas de trabalho." },
    { icon: "🎯", title: "Distribuição", desc: "Tickets de maior RICE aparecem nos primeiros sprints." },
    { icon: "⚡", title: "Estimativa",   desc: "A conclusão estimada considera o esforço total de todos os tickets." },
  ];
  return (
    <div className="mb-5 rounded-2xl border bg-card overflow-hidden shadow-elevation-1">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-surface-1 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold">Como funciona o Cronograma?</span>
        </div>
        <ChevronDown className={cn(
          "h-4 w-4 text-muted-foreground transition-transform",
          open && "rotate-180",
        )} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-3 border-t space-y-4">
          <p className="text-sm text-foreground">
            Os tickets são distribuídos em sprints de 2 semanas com base no Score RICE e na prioridade definida.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {items.map(it => (
              <div key={it.title} className="rounded-xl border bg-bg-surface-1 p-3">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <span aria-hidden>{it.icon}</span>
                  {it.title}
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-snug">{it.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-warning-foreground bg-warning/10 border border-warning/20 rounded-xl px-3 py-2 flex items-start gap-2">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            Os sprints são simulados com base nos scores. Quando a integração com sprints reais do Jira for ativada, este cronograma será substituído pelos dados reais.
          </p>
        </div>
      )}
    </div>
  );
}
