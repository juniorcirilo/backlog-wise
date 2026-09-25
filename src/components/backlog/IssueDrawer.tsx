import { useEffect, useMemo, useState } from "react";
import {
  Sparkles, Link2, ExternalLink, ChevronLeft, ChevronRight, UserX,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { type Issue, type IssueType, type Priority } from "@/data/mock-data";
import { getWorkspaceConfig } from "@/lib/workspace-projects";

// ─────────────────────────────────────────────────────────────
// Tokens de design — compartilhados entre tabela e drawer.
// ─────────────────────────────────────────────────────────────

export const ISSUE_TYPE_CFG: Record<IssueType, { label: string; badge: string }> = {
  Bug:   { label: "Bug",   badge: "bg-destructive/10 text-destructive border-destructive/20" },
  Task:  { label: "Task",  badge: "bg-muted text-muted-foreground border-border" },
  Story: { label: "Story", badge: "bg-success/10 text-success border-success/20" },
  Epic:  { label: "Epic",  badge: "bg-accent/10 text-accent border-accent/20" },
};

export const PRIORITY_CFG: Record<Priority, { label: string; badge: string }> = {
  Highest: { label: "Highest", badge: "bg-destructive/10 text-destructive border-destructive/20" },
  High:    { label: "High",    badge: "bg-warning/10 text-warning border-warning/20" },
  Medium:  { label: "Medium",  badge: "bg-accent/10 text-accent border-accent/20" },
  Low:     { label: "Low",     badge: "bg-muted text-muted-foreground border-border" },
  Lowest:  { label: "Lowest",  badge: "bg-muted/60 text-muted-foreground border-border" },
};

// Threshold da tabela (RICE alto/médio/baixo).
export function riceColor(score: number): string {
  if (score >= 100) return "text-success font-bold";
  if (score >= 50)  return "text-warning font-semibold";
  return "text-muted-foreground font-medium";
}

// Threshold do número grande no drawer (escala diferente do banner da tabela).
function bigRiceColor(score: number): string {
  if (score >= 60) return "text-success";
  if (score >= 30) return "text-warning";
  return "text-destructive";
}

export function IssueTypeBadge({ issueType }: { issueType: IssueType }) {
  const cfg = ISSUE_TYPE_CFG[issueType];
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", cfg.badge)}>
      {cfg.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const cfg = PRIORITY_CFG[priority];
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", cfg.badge)}>
      {cfg.label}
    </span>
  );
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function daysAgo(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

// ─────────────────────────────────────────────────────────────
// Score factor bar (Reach / Impact / Confidence / Effort)
// ─────────────────────────────────────────────────────────────

function FactorBar({
  label, value, max = 10, color, dark,
}: { label: string; value: number; max?: number; color: string; dark?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className={cn("text-xs", dark ? "text-white/85" : "text-muted-foreground")}>{label}</span>
        <span className={cn("text-sm font-semibold tabular-nums", dark && "text-white")}>
          {value}<span className={cn("font-normal", dark ? "text-white/70" : "text-muted-foreground")}>/{max}</span>
        </span>
      </div>
      <div className={cn("h-2 rounded-full overflow-hidden", dark ? "bg-white/15" : "bg-muted")}>
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Domínio Jira: cache em sessionStorage para não refetchear a
// cada abertura de drawer.
// ─────────────────────────────────────────────────────────────

const SS_JIRA_DOMAIN = "backlogai_jira_domain";

function readCachedDomain(): string | null {
  try { return sessionStorage.getItem(SS_JIRA_DOMAIN); } catch { return null; }
}

function useJiraDomain(): string | null {
  const [domain, setDomain] = useState<string | null>(readCachedDomain);
  useEffect(() => {
    if (domain) return;
    let cancelled = false;
    (async () => {
      try {
        const cfg = await getWorkspaceConfig();
        if (!cancelled && cfg.domain) {
          try { sessionStorage.setItem(SS_JIRA_DOMAIN, cfg.domain); } catch { /* ignore */ }
          setDomain(cfg.domain);
        }
      } catch { /* sem domínio = sem botão */ }
    })();
    return () => { cancelled = true; };
  }, [domain]);
  return domain;
}

// ─────────────────────────────────────────────────────────────
// Drawer
// ─────────────────────────────────────────────────────────────

interface IssueDrawerProps {
  issue: Issue | null;
  /** Lista usada para resolver dependências por id (geralmente o backlog inteiro). */
  allIssues: Issue[];
  /** Lista para navegação ← / → no rodapé (default: allIssues). Se vazia, esconde os botões. */
  siblings?: Issue[];
  /** Quando passado, mostra os botões "Anterior"/"Próxima" e dispara este callback. */
  onNavigate?: (issue: Issue) => void;
  onClose: () => void;
  /**
   * Empilha o drawer acima de outros portais já abertos (default Sheet usa
   * z-50). O FloatingChat usa z-[70], então quando o drawer for aberto
   * em cima dele precisamos passar `topMost`.
   */
  topMost?: boolean;
}

export default function IssueDrawer({
  issue, allIssues, siblings, onNavigate, onClose, topMost,
}: IssueDrawerProps) {
  const jiraDomain = useJiraDomain();

  const navList = (siblings ?? allIssues).filter(s => s.id);
  const navIndex = issue ? navList.findIndex(s => s.id === issue.id) : -1;
  const canPrev = !!onNavigate && navIndex > 0;
  const canNext = !!onNavigate && navIndex >= 0 && navIndex < navList.length - 1;

  // Média RICE do conjunto recebido — usada na frase "X acima/abaixo da média".
  const avgRice = useMemo(() => {
    if (!allIssues.length) return 0;
    return Math.round(allIssues.reduce((s, i) => s + (i.riceScore ?? 0), 0) / allIssues.length);
  }, [allIssues]);

  const issueRef = issue ? allIssues.find(i => i.id === issue.id) ?? issue : null;
  const deps = (issueRef?.dependencies
    .map(id => allIssues.find(i => i.id === id))
    .filter(Boolean) ?? []) as Issue[];

  const overlayClassName = topMost ? "z-[80]" : undefined;
  const contentClassName = cn(
    "w-full sm:max-w-md overflow-y-auto",
    topMost && "z-[80]",
  );

  const handlePrev = () => {
    if (!canPrev || !onNavigate) return;
    onNavigate(navList[navIndex - 1]);
  };
  const handleNext = () => {
    if (!canNext || !onNavigate) return;
    onNavigate(navList[navIndex + 1]);
  };

  const jiraUrl = issue && jiraDomain
    ? `https://${jiraDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")}/browse/${issue.key}`
    : null;

  const riceDiff = issue ? issue.riceScore - avgRice : 0;
  const riceDiffLabel =
    riceDiff > 0 ? `+${riceDiff} acima da média do backlog`
    : riceDiff < 0 ? `${Math.abs(riceDiff)} abaixo da média do backlog`
    : "na média do backlog";

  return (
    <Sheet open={!!issue} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className={contentClassName}
        overlayClassName={overlayClassName}
      >
        {issue && (
          <div className="flex flex-col min-h-full">
            {/* ── Header ───────────────────────────────────── */}
            <SheetHeader className="mb-5 space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{issue.key}</span>
                <span>·</span>
                <IssueTypeBadge issueType={issue.issueType} />
                <PriorityBadge priority={issue.priority} />
              </div>
              <SheetTitle className="text-[18px] font-bold leading-tight">
                {issue.title}
              </SheetTitle>

              {/* Responsável + tempo aberto */}
              <div className="flex items-center gap-3">
                {issue.assignee ? (
                  <>
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-accent text-xs font-semibold flex-shrink-0">
                      {getInitials(issue.assignee)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{issue.assignee}</p>
                      <p className="text-xs text-muted-foreground">
                        abriu há {daysAgo(issue.createdAt)} {daysAgo(issue.createdAt) === 1 ? "dia" : "dias"}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground flex-shrink-0">
                      <UserX className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-muted-foreground">Sem responsável</p>
                      <p className="text-xs text-muted-foreground">
                        abriu há {daysAgo(issue.createdAt)} {daysAgo(issue.createdAt) === 1 ? "dia" : "dias"}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </SheetHeader>

            {/* ── RICE Score card (escuro) ─────────────────── */}
            <div className="mb-5 rounded-2xl border border-sidebar-border bg-sidebar text-white p-5">
              <p className="text-[11px] font-semibold uppercase text-white/60 mb-2">
                RICE Score
              </p>
              <div className="flex items-baseline gap-3">
                <span
                  className="text-[48px] leading-none tabular-nums text-white"
                  style={{ fontWeight: 800 }}
                >
                  {issue.riceScore}
                </span>
                <span className="text-sm text-white/80">pontos</span>
              </div>
              <p className="text-xs text-white/60 mt-1">
                {riceDiffLabel}
              </p>

              <div className="mt-5 space-y-3.5">
                <FactorBar dark label="Reach (Alcance)"      value={issue.reach}      color="bg-accent" />
                <FactorBar dark label="Impact (Impacto)"     value={issue.impact}     color="bg-success" />
                <FactorBar dark label="Confidence (Confiança)" value={issue.confidence > 10 ? Math.round(issue.confidence / 10) : issue.confidence} color="bg-accent" />
                <FactorBar dark label="Effort (Esforço)"     value={issue.effort}     color="bg-warning" />
              </div>
            </div>

            {/* ── Justificativa da IA ──────────────────────── */}
            {issue.aiSummary && (
              <div className="mb-5 rounded-lg bg-accent/5 border border-accent/15 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-accent" />
                  <p className="text-xs font-semibold uppercase tracking-widest text-accent">
                    Análise da IA
                  </p>
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed">
                  {issue.aiSummary}
                </p>
              </div>
            )}

            {/* ── Labels ───────────────────────────────────── */}
            {issue.labels.length > 0 && (
              <div className="mb-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                  Labels
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {issue.labels.map(l => (
                    <span
                      key={l}
                      className="rounded-md border border-border bg-border/30 px-2 py-0.5 text-xs font-mono text-muted-foreground"
                    >
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Dependências ─────────────────────────────── */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Dependências detectadas
                </p>
              </div>
              {deps.length > 0 ? (
                <div className="space-y-2">
                  {deps.map(dep => (
                    <div key={dep.id} className="flex items-center gap-3 rounded-xl border bg-bg-surface-1 px-3 py-2">
                      <Link2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="font-mono text-xs text-muted-foreground flex-shrink-0">{dep.key}</span>
                      <span className="text-sm font-medium flex-1 min-w-0 truncate">{dep.title}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  Nenhuma dependência identificada.
                </p>
              )}
            </div>

            {/* ── Footer ───────────────────────────────────── */}
            <div className="mt-auto pt-4 border-t flex flex-wrap items-center gap-2">
              {onNavigate && navList.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrev}
                    disabled={!canPrev}
                    className="inline-flex items-center gap-1 rounded-lg border bg-bg-surface-1 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!canNext}
                    className="inline-flex items-center gap-1 rounded-lg border bg-bg-surface-1 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Próxima
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              {jiraUrl && (
                <a
                  href={jiraUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white shadow-accent-glow hover:brightness-110 transition-all"
                >
                  Abrir no Jira
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
