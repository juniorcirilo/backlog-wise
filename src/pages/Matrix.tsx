import { useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { Info, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Issue, type IssueType } from "@/data/mock-data";
import { useProjectIssues } from "@/hooks/useProjectIssues";


// ── SVG layout constants ────────────────────────────────
const SVG_W = 600;
const SVG_H = 480;
const PAD_L = 56;
const PAD_R = 24;
const PAD_T = 24;
const PAD_B = 48;
const PLOT_W = SVG_W - PAD_L - PAD_R;
const PLOT_H = SVG_H - PAD_T - PAD_B;
const MID_X = PAD_L + PLOT_W / 2;
const MID_Y = PAD_T + PLOT_H / 2;

function issueX(effort: number) { return PAD_L + (effort / 10) * PLOT_W; }
function issueY(impact: number) { return PAD_T + (1 - impact / 10) * PLOT_H; }

function makeCircleRadius(issues: Issue[]) {
  if (issues.length === 0) return () => 7;
  const max = Math.max(...issues.map(i => i.riceScore));
  const min = Math.min(...issues.map(i => i.riceScore));
  return (score: number) => {
    const norm = max === min ? 0.5 : (score - min) / (max - min);
    return 7 + norm * 16;
  };
}

// ── Issue type colors (CSS token strings) ──────────────
const ISSUE_TYPE_COLOR: Record<IssueType, string> = {
  Bug:   'hsl(var(--destructive))',
  Task:  'hsl(var(--muted-foreground))',
  Story: 'hsl(var(--success))',
  Epic:  'hsl(var(--accent))',
};

const ISSUE_TYPE_LABEL: Record<IssueType, string> = {
  Bug: 'Bug', Task: 'Task', Story: 'Story', Epic: 'Epic',
};

const ISSUE_TYPE_BADGE: Record<IssueType, string> = {
  Bug:   'bg-destructive/10 text-destructive border-destructive/20',
  Task:  'bg-muted text-muted-foreground border-border',
  Story: 'bg-success/10 text-success border-success/20',
  Epic:  'bg-accent/10 text-accent border-accent/20',
};

function getQuadrant(issue: Issue): string {
  const highImpact = issue.impact >= 5;
  const highEffort = issue.effort >= 5;
  if (highImpact && !highEffort) return 'Quick Win';
  if (highImpact && highEffort)  return 'Estratégico';
  if (!highImpact && !highEffort) return 'Fill-in';
  return 'Questionável';
}

// Extrai o número da chave Jira ("PLAT-58" → "58") para o label dentro do círculo.
function keyNumber(key: string): string {
  return key.split('-').pop() ?? key;
}

// ── Tooltip ─────────────────────────────────────────────
interface TooltipState { issue: Issue; x: number; y: number }

function IssueTooltip({ tooltip }: { tooltip: TooltipState }) {
  const { issue, x, y } = tooltip;
  const flipX = x > 420;
  const flipY = y > 320;
  return (
    <div
      className="absolute z-20 pointer-events-none w-56 rounded-2xl border bg-bg-elevated shadow-elevation-4 p-3"
      style={{
        left: flipX ? x - 232 : x + 16,
        top: flipY ? y - 140 : y - 8,
      }}
    >
      <p className="text-xs font-mono text-muted-foreground mb-1">{issue.key}</p>
      <p className="text-sm font-semibold leading-snug mb-2">{issue.title}</p>
      <div className="flex items-center justify-between">
        <span className={cn('inline-flex rounded-md border px-2 py-0.5 text-xs font-medium', ISSUE_TYPE_BADGE[issue.issueType])}>
          {ISSUE_TYPE_LABEL[issue.issueType]}
        </span>
        <span className="text-sm font-bold text-accent">{issue.riceScore} RICE</span>
      </div>
      <div className="mt-2 pt-2 border-t grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>Impacto: <b className="text-foreground">{issue.impact}/10</b></span>
        <span>Esforço: <b className="text-foreground">{issue.effort}/10</b></span>
        <span className="col-span-2">Quadrante: <b className="text-foreground">{getQuadrant(issue)}</b></span>
      </div>
    </div>
  );
}

// ── Ranking side panel ──────────────────────────────────
function RankingPanel({ issues, selectedId, onSelect }: { issues: Issue[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const sorted = [...issues].sort((a, b) => b.riceScore - a.riceScore);
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 border-b">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Ranking RICE</p>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {sorted.map((issue, idx) => (
          <button
            key={issue.id}
            onClick={() => onSelect(issue.id === selectedId ? '' : issue.id)}
            className={cn(
              'w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-bg-surface-1',
              selectedId === issue.id && 'bg-accent/5 border-l-2 border-accent'
            )}
          >
            <span className="text-xs font-bold text-muted-foreground mt-0.5 w-4 flex-shrink-0">
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{issue.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: ISSUE_TYPE_COLOR[issue.issueType] }}
                />
                <span className="text-[10px] text-muted-foreground">{getQuadrant(issue)}</span>
              </div>
            </div>
            <span className={cn(
              'text-sm font-bold flex-shrink-0 mt-0.5',
              issue.riceScore >= 100 ? 'text-success' : issue.riceScore >= 50 ? 'text-warning' : 'text-muted-foreground'
            )}>
              {issue.riceScore}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────
export default function Matrix() {
  const { repository_id } = useParams<{ repository_id: string }>();
  const { issues, project } = useProjectIssues(repository_id);
  const circleRadius = makeCircleRadius(issues);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleCircleEnter = (e: React.MouseEvent<SVGCircleElement>, issue: Issue) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setTooltip({ issue, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleCircleLeave = () => setTooltip(null);

  const handleCircleClick = (e: React.MouseEvent, issue: Issue) => {
    e.stopPropagation();
    setSelectedId(id => id === issue.id ? null : issue.id);
  };

  const yTicks = [0, 2, 4, 6, 8, 10];
  const xTicks = [0, 2, 4, 6, 8, 10];

  return (
    <div className="px-6 py-8 lg:px-12 lg:py-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-mono text-muted-foreground mb-1">{project.key} · {project.name}</p>
          <h1 className="text-2xl font-bold tracking-tight">Matriz de Priorização</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{issues.length} tickets · Eixo X = Esforço · Eixo Y = Impacto</p>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 items-center text-xs">
          {(Object.keys(ISSUE_TYPE_COLOR) as IssueType[]).map(type => (
            <div key={type} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: ISSUE_TYPE_COLOR[type] }} />
              <span className="text-muted-foreground">{ISSUE_TYPE_LABEL[type]}</span>
            </div>
          ))}
          <span className="text-muted-foreground ml-2">· Tamanho = RICE</span>
        </div>
      </div>

      {/* Explainer (colapsável, fechado por padrão) */}
      <MatrixExplainer />

      {/* Body: chart + ranking */}
      <div className="flex flex-col lg:flex-row gap-4">

        {/* SVG Chart */}
        <div
          ref={containerRef}
          className="relative flex-1 p-4 lg:p-6 rounded-2xl border bg-bg-surface-1"
          onClick={() => setSelectedId(null)}
        >
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className="w-full h-auto max-h-[600px]"
          >
            {/* Quadrant backgrounds */}
            <rect x={PAD_L} y={PAD_T} width={PLOT_W / 2} height={PLOT_H / 2}
              style={{ fill: 'hsl(var(--success) / 0.07)' }} />
            <rect x={MID_X} y={PAD_T} width={PLOT_W / 2} height={PLOT_H / 2}
              style={{ fill: 'hsl(var(--accent) / 0.06)' }} />
            <rect x={PAD_L} y={MID_Y} width={PLOT_W / 2} height={PLOT_H / 2}
              style={{ fill: 'hsl(var(--muted) / 0.5)' }} />
            <rect x={MID_X} y={MID_Y} width={PLOT_W / 2} height={PLOT_H / 2}
              style={{ fill: 'hsl(var(--destructive) / 0.05)' }} />

            {/* Grid lines */}
            {xTicks.map(t => (
              <line key={`x${t}`}
                x1={issueX(t)} y1={PAD_T}
                x2={issueX(t)} y2={PAD_T + PLOT_H}
                style={{ stroke: 'hsl(var(--border))', strokeWidth: 1, opacity: 0.5 }}
              />
            ))}
            {yTicks.map(t => (
              <line key={`y${t}`}
                x1={PAD_L} y1={issueY(t)}
                x2={PAD_L + PLOT_W} y2={issueY(t)}
                style={{ stroke: 'hsl(var(--border))', strokeWidth: 1, opacity: 0.5 }}
              />
            ))}

            {/* Axis dividers (thicker) */}
            <line x1={MID_X} y1={PAD_T} x2={MID_X} y2={PAD_T + PLOT_H}
              style={{ stroke: 'hsl(var(--border))', strokeWidth: 1.5 }} />
            <line x1={PAD_L} y1={MID_Y} x2={PAD_L + PLOT_W} y2={MID_Y}
              style={{ stroke: 'hsl(var(--border))', strokeWidth: 1.5 }} />

            {/* Quadrant labels */}
            <text x={PAD_L + 10} y={PAD_T + 18} className="text-xs" fontSize={11} fontWeight={600}
              style={{ fill: 'hsl(var(--success))' }}>
              ⚡ Quick Wins
            </text>
            <text x={MID_X + 10} y={PAD_T + 18} className="text-xs" fontSize={11} fontWeight={600}
              style={{ fill: 'hsl(var(--accent))' }}>
              🎯 Projetos Estratégicos
            </text>
            <text x={PAD_L + 10} y={MID_Y + 20} className="text-xs" fontSize={11} fontWeight={600}
              style={{ fill: 'hsl(var(--muted-foreground))' }}>
              📋 Fill-ins
            </text>
            <text x={MID_X + 10} y={MID_Y + 20} className="text-xs" fontSize={11} fontWeight={600}
              style={{ fill: 'hsl(var(--destructive))' }}>
              ❓ Questionáveis
            </text>

            {/* Y-axis ticks */}
            {yTicks.map(t => (
              <text key={`yl${t}`} x={PAD_L - 8} y={issueY(t) + 4}
                fontSize={10} textAnchor="end" style={{ fill: 'hsl(var(--muted-foreground))' }}>
                {t}
              </text>
            ))}

            {/* X-axis ticks */}
            {xTicks.map(t => (
              <text key={`xl${t}`} x={issueX(t)} y={PAD_T + PLOT_H + 16}
                fontSize={10} textAnchor="middle" style={{ fill: 'hsl(var(--muted-foreground))' }}>
                {t}
              </text>
            ))}

            {/* Axis labels */}
            <text x={PAD_L + PLOT_W / 2} y={SVG_H - 2}
              fontSize={11} fontWeight={600} textAnchor="middle"
              style={{ fill: 'hsl(var(--muted-foreground))' }}>
              Esforço →
            </text>
            <text x={12} y={PAD_T + PLOT_H / 2}
              fontSize={11} fontWeight={600} textAnchor="middle"
              transform={`rotate(-90, 12, ${PAD_T + PLOT_H / 2})`}
              style={{ fill: 'hsl(var(--muted-foreground))' }}>
              ↑ Impacto
            </text>

            {/* Issue circles */}
            {issues.map(issue => {
              const cx = issueX(issue.effort);
              const cy = issueY(issue.impact);
              const r = circleRadius(issue.riceScore);
              const isSelected = selectedId === issue.id;
              return (
                <g key={issue.id}>
                  {isSelected && (
                    <circle cx={cx} cy={cy} r={r + 6}
                      style={{ fill: ISSUE_TYPE_COLOR[issue.issueType], opacity: 0.2 }} />
                  )}
                  <circle
                    cx={cx} cy={cy} r={r}
                    style={{
                      fill: ISSUE_TYPE_COLOR[issue.issueType],
                      opacity: selectedId && !isSelected ? 0.3 : 0.85,
                      cursor: 'pointer',
                      stroke: isSelected ? 'hsl(var(--foreground))' : 'hsl(var(--bg-elevated))',
                      strokeWidth: isSelected ? 2 : 1.5,
                      transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={e => handleCircleEnter(e, issue)}
                    onMouseLeave={handleCircleLeave}
                    onClick={e => handleCircleClick(e, issue)}
                  />
                  {r >= 12 && (
                    <text x={cx} y={cy + 4}
                      fontSize={9} fontWeight={700} textAnchor="middle"
                      style={{ fill: 'white', pointerEvents: 'none' }}>
                      {keyNumber(issue.key)}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Tooltip */}
          {tooltip && <IssueTooltip tooltip={tooltip} />}
        </div>

        {/* Ranking sidebar */}
        <aside className="w-full lg:w-64 xl:w-72 rounded-2xl border bg-card flex flex-col max-h-[400px] lg:max-h-[600px]">
          <RankingPanel
            issues={issues}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </aside>
      </div>

      {/* Quadrant summary footer */}
      <div className="mt-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Quick Wins', color: 'text-success', bg: 'bg-success/10', emoji: '⚡', filter: (i: Issue) => i.impact >= 5 && i.effort < 5 },
            { label: 'Estratégicos', color: 'text-accent', bg: 'bg-accent/10', emoji: '🎯', filter: (i: Issue) => i.impact >= 5 && i.effort >= 5 },
            { label: 'Fill-ins', color: 'text-muted-foreground', bg: 'bg-muted', emoji: '📋', filter: (i: Issue) => i.impact < 5 && i.effort < 5 },
            { label: 'Questionáveis', color: 'text-destructive', bg: 'bg-destructive/10', emoji: '❓', filter: (i: Issue) => i.impact < 5 && i.effort >= 5 },
          ].map(q => (
            <div key={q.label} className={cn('rounded-xl px-3 py-2 flex items-center gap-2', q.bg)}>
              <span className="text-base">{q.emoji}</span>
              <div>
                <p className={cn('text-sm font-bold', q.color)}>{issues.filter(q.filter).length}</p>
                <p className="text-xs text-muted-foreground">{q.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Card explicativo colapsável (mesmo padrão do Backlog).
// ─────────────────────────────────────────────────────────────
function MatrixExplainer() {
  const [open, setOpen] = useState(false);
  const quadrants = [
    { icon: "⚡", title: "Quick Wins", sub: "alto impacto, baixo esforço",
      desc: "Prioridade máxima — grande retorno com pouco custo." },
    { icon: "🎯", title: "Projetos Estratégicos", sub: "alto impacto, alto esforço",
      desc: "Importantes mas exigem planejamento e recursos." },
    { icon: "📋", title: "Fill-ins", sub: "baixo impacto, baixo esforço",
      desc: "Fazer quando houver folga no sprint." },
    { icon: "❓", title: "Questionáveis", sub: "baixo impacto, alto esforço",
      desc: "Reavaliar — podem não valer o investimento." },
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
          <span className="text-sm font-semibold">Como interpretar a Matriz?</span>
        </div>
        <ChevronDown className={cn(
          "h-4 w-4 text-muted-foreground transition-transform",
          open && "rotate-180",
        )} />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-3 border-t space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quadrants.map(q => (
              <div key={q.title} className="rounded-xl border bg-bg-surface-1 p-3">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  <span aria-hidden>{q.icon}</span>
                  {q.title}{" "}
                  <span className="text-xs text-muted-foreground font-normal">({q.sub})</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-snug">{q.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground flex items-start gap-2">
            <Info className="h-3.5 w-3.5 text-accent flex-shrink-0 mt-0.5" />
            O tamanho de cada círculo representa o Score RICE do ticket. Círculos maiores = maior prioridade.
          </p>
        </div>
      )}
    </div>
  );
}
