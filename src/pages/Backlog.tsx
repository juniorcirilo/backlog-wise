import { useState, useRef, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Sparkles, ArrowUpDown, ChevronDown, ChevronUp, CheckCircle2,
  Loader2, AlertCircle, RefreshCw, UserX, Info,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { type Issue, type IssueType, type Priority } from "@/data/mock-data";
import { useProjectIssues, type IssueScoreUpdate } from "@/hooks/useProjectIssues";
import { supabase } from "@/integrations/supabase/client";
import { useSyncLogger } from "@/hooks/useSyncLogger";
import IssueDrawer, {
  IssueTypeBadge,
  PriorityBadge,
  riceColor,
  getInitials,
  ISSUE_TYPE_CFG,
  PRIORITY_CFG,
} from "@/components/backlog/IssueDrawer";

function truncateName(s: string, n = 12): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function clamp10(n: unknown): number {
  const v = Math.round(Number(n) || 0);
  return Math.max(0, Math.min(10, v));
}

// ── Main page ───────────────────────────────────────────
type SortField = 'riceScore' | 'impact' | 'effort' | 'key';
type SortDir = 'asc' | 'desc';

const ALL_ISSUE_TYPES: (IssueType | 'all')[] = ['all', 'Bug', 'Task', 'Story', 'Epic'];
const ALL_PRIORITIES: (Priority | 'all')[] = ['all', 'Highest', 'High', 'Medium', 'Low', 'Lowest'];

export default function Backlog() {
  const { repository_id } = useParams<{ repository_id: string }>();
  const { issues, project, loading, error, refetch, applyScores } = useProjectIssues(repository_id);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [issueTypeFilter, setIssueTypeFilter] = useState<IssueType | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('riceScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [analysisState, setAnalysisState] = useState<'idle' | 'running' | 'done'>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [analyzedKeys, setAnalyzedKeys] = useState<Set<string>>(new Set());
  const [riceExplainerOpen, setRiceExplainerOpen] = useState(false);
  const cancelledRef = useRef(false);
  const { logSync, completeSync } = useSyncLogger();

  useEffect(() => () => { cancelledRef.current = true; }, []);

  const startAnalysis = async () => {
    if (analysisState !== 'idle') return;
    if (!issues.length) {
      toast.error('Nenhum ticket para analisar');
      return;
    }
    cancelledRef.current = false;
    setAnalysisState('running');
    setAnalyzedKeys(new Set());
    setCurrentIndex(0);

    const total = issues.length;
    const ticketsPayload = issues.map(i => ({
      key: i.key,
      summary: i.title,
      description: i.body ?? '',
      issueType: i.issueType,
      priority: i.priority,
      status: i.status,
      components: i.components ?? [],
      labels: i.labels ?? [],
    }));
    const preset = { reach: 25, impact: 25, confidence: 25, effort: 25 };

    // Animação de progresso enquanto a edge function processa.
    let animationCancelled = false;
    const runAnimation = async () => {
      for (let i = 0; i < total; i++) {
        if (animationCancelled || cancelledRef.current) return;
        setCurrentIndex(i);
        await new Promise(r => setTimeout(r, 220 + Math.random() * 180));
        if (animationCancelled || cancelledRef.current) return;
        setAnalyzedKeys(prev => {
          const next = new Set(prev);
          next.add(issues[i].key);
          return next;
        });
      }
    };
    const animationPromise = runAnimation();
    const logId = await logSync('ai_analysis');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('analyze-backlog', {
        body: { tickets: ticketsPayload, preset },
      });

      animationCancelled = true;
      await animationPromise;
      if (cancelledRef.current) return;

      if (fnError || !data || (data as any).error) {
        const msg = (data as any)?.error ?? fnError?.message ?? 'Erro desconhecido';
        console.error('analyze-backlog error', msg);
        toast.error('Falha ao priorizar com IA', { description: String(msg).slice(0, 160) });
        await completeSync(logId, { status: 'failed', errorMessage: String(msg) });
        setAnalysisState('idle');
        setAnalyzedKeys(new Set());
        setCurrentIndex(0);
        return;
      }

      const items = ((data as any).items ?? []) as Array<{
        key: string; reach: number; impact: number; confidence: number;
        effort: number; score: number; rationale?: string;
        dependencies?: { blockedBy?: string[]; blocks?: string[] };
      }>;

      if (!items.length) {
        toast.error('A IA não retornou pontuações');
        await completeSync(logId, { status: 'failed', errorMessage: 'IA não retornou pontuações' });
        setAnalysisState('idle');
        setAnalyzedKeys(new Set());
        setCurrentIndex(0);
        return;
      }

      const updates: IssueScoreUpdate[] = items.map(it => ({
        key: it.key,
        reach: clamp10(it.reach),
        impact: clamp10(it.impact),
        confidence: clamp10(it.confidence),
        effort: clamp10(it.effort),
        riceScore: Math.round(Number(it.score) || 0),
        aiSummary: it.rationale,
        dependencies: [
          ...(it.dependencies?.blockedBy ?? []),
          ...(it.dependencies?.blocks ?? []),
        ],
      }));

      applyScores(updates);
      await completeSync(logId, { status: 'completed', issuesProcessed: updates.length });
      setAnalyzedKeys(new Set(issues.map(i => i.key)));
      setAnalysisState('done');
      try {
        localStorage.setItem('backlogai_backlog_analyzed', 'true');
        // Reabre a notificação no botão flutuante caso o usuário rode a análise
        // de novo depois de já ter visto a tela de boas-vindas anterior.
        localStorage.removeItem('backlogai_notification_seen');
        window.dispatchEvent(new StorageEvent('storage', { key: 'backlogai_backlog_analyzed' }));
        window.dispatchEvent(new StorageEvent('storage', { key: 'backlogai_notification_seen' }));
      } catch { /* ignore */ }
      toast.success('Análise concluída', {
        description: `${updates.length} tickets pontuados pela IA com base no framework RICE.`,
      });
      setTimeout(() => {
        if (cancelledRef.current) return;
        setAnalysisState('idle');
        setAnalyzedKeys(new Set());
        setCurrentIndex(0);
      }, 2500);
    } catch (e) {
      animationCancelled = true;
      console.error('analyze-backlog exception', e);
      toast.error('Falha ao priorizar com IA', { description: e instanceof Error ? e.message : 'Erro inesperado' });
      await completeSync(logId, { status: 'failed', errorMessage: e instanceof Error ? e.message : 'Erro inesperado' });
      setAnalysisState('idle');
      setAnalyzedKeys(new Set());
      setCurrentIndex(0);
    }
  };

  const isRunning = analysisState === 'running';
  const currentTicket = isRunning ? issues[currentIndex] : null;
  const showScore = (key: string) =>
    !isRunning || analyzedKeys.has(key);
  const isAnalyzingNow = (key: string) =>
    isRunning && currentTicket?.key === key && !analyzedKeys.has(key);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const filtered = issues
    .filter(i => issueTypeFilter === 'all' || i.issueType === issueTypeFilter)
    .filter(i => priorityFilter === 'all' || i.priority === priorityFilter)
    .sort((a, b) => {
      const mult = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'key') return a.key.localeCompare(b.key) * mult;
      return (a[sortField] - b[sortField]) * mult;
    });

  const countByType = (type: IssueType) => issues.filter(i => i.issueType === type).length;

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === 'desc'
      ? <ChevronDown className="h-3 w-3 text-accent" />
      : <ChevronUp className="h-3 w-3 text-accent" />;
  }

  if (loading) {
    return (
      <div className="px-6 py-8 lg:px-12 lg:py-10 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <span className="text-sm">Carregando issues do Jira…</span>
        </div>
        <div className="mt-6 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-bg-surface-1 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    const isJiraAuth = error === "invalid_credentials" || error === "not_connected";
    const isSessionAuth = error === "auth_expired";
    return (
      <div className="px-6 py-8 lg:px-12 lg:py-10 max-w-3xl mx-auto">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="text-base font-semibold text-foreground">
                {isSessionAuth
                  ? "Sessão expirada"
                  : isJiraAuth
                    ? "Conexão com o Jira inválida"
                    : "Não foi possível carregar as issues"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isSessionAuth
                  ? "Faça login novamente para buscar as issues do Jira."
                  : isJiraAuth
                  ? "As credenciais salvas não estão mais válidas. Reconecte sua conta para continuar."
                  : "Houve um erro ao buscar as issues do Jira. Tente novamente em instantes."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {isSessionAuth ? (
                  <Link to="/login" className="lp-btn-primary-indigo">Entrar novamente</Link>
                ) : isJiraAuth ? (
                  <Link to="/conectar-jira" className="lp-btn-primary-indigo">Reconectar Jira</Link>
                ) : (
                  <button onClick={refetch} className="lp-btn-primary-indigo">
                    <RefreshCw className="h-4 w-4" /> Tentar novamente
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 lg:px-12 lg:py-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-mono text-muted-foreground mb-1">{project.key} · {project.name}</p>
          <h1 className="text-2xl font-bold tracking-tight">Backlog</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{issues.length} tickets · Sync {new Date(project.lastSyncedAt).toLocaleDateString('pt-BR')}</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {analysisState === 'idle' && (
            <button className="lp-btn-primary-indigo" onClick={startAnalysis}>
              <Sparkles className="h-4 w-4" /> Priorizar com IA
            </button>
          )}
          {isRunning && currentTicket && (
            <div className="flex items-center gap-3 w-72 rounded-xl border bg-bg-surface-1 px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-accent flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-0.5">
                  Analisando {analyzedKeys.size + 1} de {issues.length}
                </p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-accent flex-shrink-0">{currentTicket.key}</span>
                  <span className="text-xs text-foreground truncate font-medium">{currentTicket.title}</span>
                </div>
                <Progress value={(analyzedKeys.size / issues.length) * 100} className="h-1 mt-1.5" />
              </div>
            </div>
          )}
          {analysisState === 'done' && (
            <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-sm font-semibold text-success">
              <CheckCircle2 className="h-4 w-4" /> Análise concluída!
            </div>
          )}
        </div>
      </div>

      {/* RICE explainer (colapsável, fechado por padrão) */}
      <div className="mb-5 rounded-2xl border bg-card overflow-hidden shadow-elevation-1">
        <button
          type="button"
          onClick={() => setRiceExplainerOpen(v => !v)}
          aria-expanded={riceExplainerOpen}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-bg-surface-1 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold">Como funciona a pontuação RICE?</span>
          </div>
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            riceExplainerOpen && "rotate-180",
          )} />
        </button>
        {riceExplainerOpen && (
          <div className="px-4 pb-4 pt-3 border-t space-y-4">
            <div className="rounded-xl bg-bg-surface-1 px-4 py-3 text-center">
              <span className="text-xs text-muted-foreground">Score = </span>
              <span className="font-mono text-sm font-semibold text-foreground">
                (Reach × Impacto × Confiança) ÷ Esforço
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { en: "Reach",      pt: "Alcance",   desc: "Quantas pessoas este ticket impacta?" },
                { en: "Impact",     pt: "Impacto",   desc: "Qual o efeito direto no negócio?" },
                { en: "Confidence", pt: "Confiança", desc: "Quão certos estamos da estimativa?" },
                { en: "Effort",     pt: "Esforço",   desc: "Custo em semanas-pessoa." },
              ].map(f => (
                <div key={f.en} className="rounded-xl border bg-bg-surface-1 p-3">
                  <p className="text-sm font-semibold">
                    {f.en}{" "}
                    <span className="text-xs text-muted-foreground font-normal">({f.pt})</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 leading-snug">{f.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground flex items-start gap-2">
              <Sparkles className="h-3.5 w-3.5 text-accent flex-shrink-0 mt-0.5" />
              A IA estima automaticamente cada fator com base na descrição e contexto do ticket.
            </p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {ALL_ISSUE_TYPES.map(type => (
          <button
            key={type}
            onClick={() => setIssueTypeFilter(type)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              issueTypeFilter === type
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border bg-bg-surface-1 text-muted-foreground hover:border-accent/40 hover:text-foreground'
            )}
          >
            {type === 'all' ? `Todos (${issues.length})` : `${ISSUE_TYPE_CFG[type].label} (${countByType(type)})`}
          </button>
        ))}
        <div className="ml-auto">
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value as Priority | 'all')}
            className="rounded-lg border bg-bg-surface-1 px-3 py-1.5 text-xs font-medium text-foreground cursor-pointer outline-none focus:ring-1 focus:ring-accent"
          >
            {ALL_PRIORITIES.map(p => (
              <option key={p} value={p}>
                {p === 'all' ? 'Prioridade: Todas' : `Prioridade: ${PRIORITY_CFG[p].label}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border bg-card shadow-elevation-2 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-bg-surface-1">
                <th className="px-4 py-3 text-left">
                  <button className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground" onClick={() => toggleSort('key')}>
                    Chave <SortIcon field="key" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resumo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prioridade</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Responsável</th>
                <th className="px-4 py-3 text-left">
                  <button className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground" onClick={() => toggleSort('impact')}>
                    Impacto <SortIcon field="impact" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground" onClick={() => toggleSort('effort')}>
                    Esforço <SortIcon field="effort" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left">
                  <button className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground" onClick={() => toggleSort('riceScore')}>
                    RICE <SortIcon field="riceScore" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    Nenhum ticket encontrado com esses filtros.
                  </td>
                </tr>
              )}
              {filtered.map((issue) => (
                <tr
                  key={issue.id}
                  onClick={() => setSelectedIssue(issue)}
                  className={cn(
                    'group cursor-pointer transition-colors',
                    isAnalyzingNow(issue.key)
                      ? 'bg-accent/5'
                      : isRunning && !analyzedKeys.has(issue.key)
                        ? 'opacity-50 hover:bg-bg-surface-1'
                        : 'hover:bg-bg-surface-1',
                  )}
                >
                  <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                    {issue.key}
                  </td>
                  <td className="px-4 py-3.5 max-w-xs">
                    <p className="font-medium truncate group-hover:text-accent transition-colors">{issue.title}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <IssueTypeBadge issueType={issue.issueType} />
                  </td>
                  <td className="px-4 py-3.5">
                    <PriorityBadge priority={issue.priority} />
                  </td>
                  <td className="px-4 py-3.5">
                    {issue.assignee ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-accent text-[10px] font-semibold flex-shrink-0"
                          aria-hidden
                        >
                          {getInitials(issue.assignee)}
                        </div>
                        <span className="text-sm truncate" title={issue.assignee}>
                          {truncateName(issue.assignee)}
                        </span>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-surface-1 px-2 py-0.5 text-xs text-muted-foreground">
                        <UserX className="h-3.5 w-3.5" />
                        Sem dono
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{issue.impact}/10</span>
                      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${issue.impact * 10}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{issue.effort}/10</span>
                      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-warning" style={{ width: `${issue.effort * 10}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    {isAnalyzingNow(issue.key) ? (
                      <Loader2 className="h-4 w-4 animate-spin text-accent" />
                    ) : showScore(issue.key) ? (
                      <span className={cn('text-base transition-opacity duration-300', riceColor(issue.riceScore))}>
                        {issue.riceScore}
                      </span>
                    ) : (
                      <span className="text-base text-muted-foreground/40">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <IssueDrawer
        issue={selectedIssue}
        allIssues={issues}
        siblings={filtered}
        onNavigate={setSelectedIssue}
        onClose={() => setSelectedIssue(null)}
      />
    </div>
  );
}
