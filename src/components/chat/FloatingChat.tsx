import { useCallback, useEffect, useMemo, useRef, useState, forwardRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Send, Sparkles, Plus, ChevronLeft, ChevronDown, X, ArrowRight,
  AlertTriangle, TrendingUp, Lightbulb, KanbanSquare, Lock, Clock,
  MessageSquare, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type Issue, type ChatMessage, type ChatSession } from "@/data/mock-data";
import { useProjectIssues } from "@/hooks/useProjectIssues";
import { useActiveProject } from "@/hooks/useActiveProject";
import { useDemo } from "@/contexts/DemoContext";
import { supabase } from "@/integrations/supabase/client";
import IssueDrawer from "@/components/backlog/IssueDrawer";

// ─────────────────────────────────────────────────────────────
// Storage keys & helpers
// ─────────────────────────────────────────────────────────────

const LS_ACTIVE_PROJECT = "backlogai_active_project";
const LS_BACKLOG_ANALYZED = "backlogai_backlog_analyzed";
const LS_NOTIF_SEEN = "backlogai_notification_seen";
const LS_SESSIONS = "backlogai_chat_sessions";

const HIDDEN_ROUTES = ["/login", "/onboarding", "/pending-approval"];

function readJiraConnected() {
  try { return !!localStorage.getItem(LS_ACTIVE_PROJECT); } catch { return false; }
}
function readBacklogAnalyzed() {
  try { return localStorage.getItem(LS_BACKLOG_ANALYZED) === "true"; } catch { return false; }
}
function readNotifSeen() {
  try { return localStorage.getItem(LS_NOTIF_SEEN) === "true"; } catch { return false; }
}
function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(LS_SESSIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function saveSessions(sessions: ChatSession[]) {
  try { localStorage.setItem(LS_SESSIONS, JSON.stringify(sessions)); } catch { /* quota */ }
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `há ${diffD} d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// ─────────────────────────────────────────────────────────────
// Sugestões e textos
// ─────────────────────────────────────────────────────────────

const SUGGESTION_CATEGORIES: { label: string; items: string[] }[] = [
  {
    label: "Priorização",
    items: [
      "O que priorizar agora?",
      "Quais são os Quick Wins?",
      "O que está bloqueando o sprint?",
    ],
  },
  {
    label: "Time",
    items: [
      "Quem está sobrecarregado?",
      "Tickets sem responsável?",
      "Como está a distribuição do time?",
    ],
  },
  {
    label: "Insights",
    items: [
      "Quais bugs são críticos?",
      "O que entregar até fim do mês?",
      "Há tickets duplicados?",
    ],
  },
];

const WELCOME_SUGGESTIONS = [
  "O que devo priorizar agora?",
  "Quais Quick Wins posso entregar esta semana?",
  "Há riscos no meu backlog atual?",
];

const TIPS = [
  "Pergunte sobre prioridades: “O que o time deve fazer primeiro?”",
  "Analise o time: “Quem tem mais tickets no sprint?”",
  "Identifique riscos: “Há dependências bloqueantes?”",
  "Planeje entregas: “O que consigo entregar até sexta?”",
];

const WELCOME_MESSAGE =
  "Olá! Sou seu Assistente IA de produto. Posso te ajudar com:\n" +
  "• Priorização inteligente do backlog\n" +
  "• Análise de carga e alocação do time\n" +
  "• Identificação de riscos e bloqueios\n" +
  "• Sugestões proativas de melhoria\n\n" +
  "Escolha uma sugestão ou faça sua própria pergunta.";

// Contrato dos blocos retornados pela edge function `chat`.
// Mantido aqui (e não em mock-data) porque é específico da resposta da IA.
type ChatBlock =
  | { type: "text"; content: string }
  | { type: "insight"; content: string }
  | { type: "issues"; items: Array<{ key: string; title?: string; issueType?: string; priority?: string; riceScore?: number; impactScore?: number; effortScore?: number }> }
  | { type: "actions"; items: Array<{ label: string; primary?: boolean }> };

const ISSUE_TYPE_BADGE: Record<string, string> = {
  Bug:   "bg-destructive/10 text-destructive border-destructive/20",
  Task:  "bg-muted text-muted-foreground border-border",
  Story: "bg-success/10 text-success border-success/20",
  Epic:  "bg-accent/10 text-accent border-accent/20",
};

// ─────────────────────────────────────────────────────────────
// Insights gerados a partir do backlog real
// ─────────────────────────────────────────────────────────────

interface InsightCard {
  tone: "red" | "green" | "amber";
  icon: typeof AlertTriangle;
  title: string;
}

// Jaccard sobre tokens de 4+ caracteres do título — conta tickets distintos
// que aparecem em pelo menos um par com similaridade > 0.5.
function countLikelyDuplicates(issues: Issue[]): number {
  const tokens = issues.map(i =>
    new Set((i.title.toLowerCase().match(/[a-záéíóúâêîôûãõç]{4,}/g) ?? []) as string[]),
  );
  const involved = new Set<number>();
  for (let i = 0; i < issues.length; i++) {
    for (let j = i + 1; j < issues.length; j++) {
      const a = tokens[i];
      const b = tokens[j];
      if (a.size === 0 || b.size === 0) continue;
      let inter = 0;
      a.forEach(w => { if (b.has(w)) inter++; });
      const union = a.size + b.size - inter;
      if (union > 0 && inter / union > 0.5) {
        involved.add(i);
        involved.add(j);
      }
    }
  }
  return involved.size;
}

function buildInsights(issues: Issue[]): InsightCard[] {
  const cards: InsightCard[] = [];

  const critWithoutAssignee = issues.filter(
    i => (i.priority === "Highest" || i.priority === "High") && !i.assignee,
  ).length;
  if (critWithoutAssignee > 0) {
    cards.push({
      tone: "red",
      icon: AlertTriangle,
      title: `Atenção: ${critWithoutAssignee} ticket${critWithoutAssignee > 1 ? "s" : ""} crítico${critWithoutAssignee > 1 ? "s" : ""} sem responsável`,
    });
  }

  const quickWins = issues.filter(
    i => i.impact >= 7 && i.effort <= 4 && i.riceScore >= 50,
  ).length;
  if (quickWins > 0) {
    cards.push({
      tone: "green",
      icon: TrendingUp,
      title: `${quickWins} Quick Win${quickWins > 1 ? "s" : ""} identificado${quickWins > 1 ? "s" : ""} — baixo esforço, alto impacto`,
    });
  }

  const strategicEpics = issues.filter(
    i => i.issueType === "Epic" && i.effort >= 8,
  ).length;
  if (strategicEpics > 0) {
    cards.push({
      tone: "amber",
      icon: Lightbulb,
      title: `${strategicEpics} projeto${strategicEpics > 1 ? "s" : ""} estratégico${strategicEpics > 1 ? "s" : ""} preci${strategicEpics > 1 ? "sam" : "sa"} de planejamento`,
    });
  }

  const dups = countLikelyDuplicates(issues);
  if (dups > 0) {
    cards.push({
      tone: "amber",
      icon: Lightbulb,
      title: `Possíveis duplicatas detectadas (${dups} tickets)`,
    });
  }

  return cards;
}

// ─────────────────────────────────────────────────────────────
// UI building blocks
// ─────────────────────────────────────────────────────────────

const IssueCard = forwardRef<HTMLButtonElement, { issue: Issue; onSelect?: (issue: Issue) => void }>(
  ({ issue, onSelect }, ref) => (
    <button
      ref={ref}
      type="button"
      onClick={() => onSelect?.(issue)}
      className="flex w-full items-center gap-3 rounded-xl border bg-bg-surface-1 px-3 py-2.5 mt-1 text-left transition-colors hover:border-accent/40 hover:bg-bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <span className="font-mono text-xs text-muted-foreground flex-shrink-0">{issue.key}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{issue.title}</p>
        <span className={cn("inline-flex mt-1 rounded border px-1.5 py-0.5 text-[10px] font-medium", ISSUE_TYPE_BADGE[issue.issueType])}>
          {issue.issueType}
        </span>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-sm font-bold text-accent">{issue.riceScore}</p>
        <p className="text-[10px] text-muted-foreground">RICE</p>
      </div>
    </button>
  ),
);
IssueCard.displayName = "IssueCard";

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-accent-glow">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="rounded-2xl rounded-bl-sm bg-bg-surface-1 border px-4 py-3">
        <div className="flex items-center gap-1.5">
          {[0, 150, 300].map(delay => (
            <span
              key={delay}
              className="block h-2 w-2 rounded-full bg-muted-foreground"
              style={{ animation: `bounce 1.2s ease-in-out ${delay}ms infinite` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const MessageBubble = forwardRef<
  HTMLDivElement,
  { message: ChatMessage; issues: Issue[]; onIssueSelect?: (issue: Issue) => void }
>(
  ({ message, issues, onIssueSelect }, ref) => {
    const isUser = message.role === "user";
    const linkedIssues = message.linkedIssues
      ?.map(id => issues.find(i => i.id === id))
      .filter(Boolean) as Issue[];

    const time = new Date(message.timestamp).toLocaleTimeString("pt-BR", {
      hour: "2-digit", minute: "2-digit",
    });

    if (isUser) {
      return (
        <div ref={ref} className="flex justify-end">
          <div className="max-w-[85%]">
            <div className="rounded-2xl rounded-br-sm bg-accent px-4 py-3 text-white shadow-accent-glow">
              <p className="text-sm leading-relaxed">{message.content}</p>
            </div>
            <p className="mt-1 text-right text-[10px] text-muted-foreground">{time}</p>
          </div>
        </div>
      );
    }

    return (
      <div ref={ref} className="flex items-end gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-accent-glow">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="max-w-[85%]">
          <div className="rounded-2xl rounded-bl-sm bg-bg-surface-1 border px-4 py-3">
            <div className="text-sm leading-relaxed space-y-1">
              {message.content.split("\n\n").map((para, i) => (
                <p key={i} dangerouslySetInnerHTML={{
                  __html: para
                    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                    .replace(/\n/g, "<br/>"),
                }} />
              ))}
            </div>
            {linkedIssues && linkedIssues.length > 0 && (
              <div className="mt-3 space-y-1.5 border-t pt-3">
                {linkedIssues.map(issue => (
                  <IssueCard key={issue.id} issue={issue} onSelect={onIssueSelect} />
                ))}
              </div>
            )}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">{time}</p>
        </div>
      </div>
    );
  },
);
MessageBubble.displayName = "MessageBubble";

function ToneCard({ tone, icon: Icon, title }: InsightCard) {
  const cls =
    tone === "red"
      ? "border-destructive/30 bg-destructive/5 text-destructive"
      : tone === "green"
      ? "border-success/30 bg-success/5 text-success"
      : "border-warning/30 bg-warning/5 text-warning";
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border p-3", cls)}>
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <p className="text-sm font-medium leading-snug text-foreground">{title}</p>
    </div>
  );
}

function SuggestionChip({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border bg-bg-surface-1 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:border-accent/40 hover:text-accent transition-colors text-left leading-tight whitespace-normal"
    >
      {text}
    </button>
  );
}

function CategorySuggestions({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-xl border border-accent/20 bg-accent/5 p-2.5">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-accent text-white shadow-accent-glow">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground leading-tight">
            Insights do Assistente IA
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
            Sugestões de perguntas baseadas no seu backlog.
          </p>
        </div>
      </div>

      {SUGGESTION_CATEGORIES.map(cat => (
        <div key={cat.label}>
          <p className="px-1 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {cat.label}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {cat.items.map(item => (
              <SuggestionChip key={item} text={item} onClick={() => onPick(item)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TipsAccordion() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-accent transition-colors"
        aria-expanded={open}
      >
        <span aria-hidden>💡</span>
        Dicas de uso
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5 rounded-xl border bg-bg-surface-1 p-3">
          {TIPS.map(tip => (
            <li key={tip} className="text-[11px] leading-snug text-muted-foreground">
              {tip}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BlockedState({
  icon, title, text, ctaLabel, onCta,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  ctaLabel: string;
  onCta: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center px-8 py-10 gap-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-bg-surface-1 border text-muted-foreground">
        {icon}
      </div>
      <div className="space-y-2 max-w-xs">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{text}</p>
      </div>
      <button
        onClick={onCta}
        className="mt-2 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-accent-glow hover:brightness-110 transition-all"
      >
        {ctaLabel}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

type DrawerView = "loading" | "no-jira" | "no-analysis" | "welcome" | "history" | "chat";

export default function FloatingChat() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDemoMode } = useDemo();
  const activeProject = useActiveProject();
  // Mesma fonte que o Backlog: a key vem da URL quando o usuario esta
  // numa rota /repository/:key/... — nao depende de localStorage estar
  // populado, entao funciona logo apos um remix. Fallback para o
  // activeProject (lido do LS) quando o usuario esta em outra rota.
  // Bonus: compartilha a MESMA cacheKey do Backlog/Matriz/Cronograma —
  // sem isso o chat tinha cache proprio "all:..." e mandava backlog:[]
  // para a edge function chat.
  const projectKeyFromUrl =
    location.pathname.match(/^\/repository\/([^/]+)/)?.[1];
  const { issues, project, loading: issuesLoading } = useProjectIssues(projectKeyFromUrl ?? activeProject?.key);

  // Backlog "pronto pra conversar": nao esta carregando E pelo menos um
  // ticket ja foi pontuado pela IA. Sem isso, mandariamos backlog:[] ou
  // backlog com riceScore=0 pra edge function chat — a IA nao tem o que
  // recomendar. Bloqueia input + sendMessage e mostra spinner.
  const backlogSynchronizing =
    issuesLoading ||
    (issues.length > 0 && issues.every(i => (i.riceScore ?? 0) === 0));

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<DrawerView>("chat");
  // Drawer de detalhes do ticket reaproveitado do Backlog. Empilha acima do
  // chat (z-[80] vs z-[70]) e gerencia seu próprio overlay/ESC via Radix.
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [jiraConnected, setJiraConnected] = useState(readJiraConnected);
  const [backlogAnalyzed, setBacklogAnalyzed] = useState(readBacklogAnalyzed);
  const [notifSeen, setNotifSeen] = useState(readNotifSeen);
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Persiste sessões
  useEffect(() => { saveSessions(sessions); }, [sessions]);

  // Re-lê flags ao abrir o drawer
  useEffect(() => {
    if (open) {
      setJiraConnected(readJiraConnected());
      setBacklogAnalyzed(readBacklogAnalyzed());
      setNotifSeen(readNotifSeen());
    }
  }, [open]);

  // Listener global de storage (Backlog dispara após "Priorizar com IA")
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === LS_BACKLOG_ANALYZED) setBacklogAnalyzed(readBacklogAnalyzed());
      if (!e.key || e.key === LS_ACTIVE_PROJECT) setJiraConnected(readJiraConnected());
      if (!e.key || e.key === LS_NOTIF_SEEN) setNotifSeen(readNotifSeen());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Permite que outras páginas abram o chat via evento global.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("openFloatingChat", onOpen);
    return () => window.removeEventListener("openFloatingChat", onOpen);
  }, []);

  // ESC fecha
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      // Quando o IssueDrawer está aberto, o ESC pertence a ele (Radix fecha
      // primeiro). Não fechar o chat por trás.
      if (e.key === "Escape" && !selectedIssue) setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, selectedIssue]);

  const activeSession = useMemo(
    () => (activeSessionId ? sessions.find(s => s.id === activeSessionId) ?? null : null),
    [activeSessionId, sessions],
  );

  // Auto-scroll na chat view
  useEffect(() => {
    if (open && view === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeSession?.messages.length, isTyping, open, view]);

  // Dados derivados
  const ready = isDemoMode || (jiraConnected && backlogAnalyzed);
  const hasNotification = ready && !notifSeen && backlogAnalyzed;
  const insights = useMemo(
    () => (view === "welcome" ? buildInsights(issues) : []),
    [view, issues],
  );
  const sortedSessions = useMemo(
    () => sessions.slice().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [sessions],
  );

  // Sessão clicada no histórico — controla o modal de "Reabrir / Nova conversa".
  const [reopenPromptSession, setReopenPromptSession] = useState<ChatSession | null>(null);

  // ── Actions ────────────────────────────────────────────

  const sendMessage = useCallback(async (sessionId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (backlogSynchronizing) {
      console.warn("[FloatingChat] backlog ainda sincronizando — envio ignorado");
      return;
    }

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    // Histórico real da conversa (sem a saudação automática), construído ANTES
    // de comprometer o userMsg no estado para evitar dependência de timing.
    const currentSession = sessions.find(s => s.id === sessionId);
    const priorReal = (currentSession?.messages ?? []).filter(
      m => !m.id.startsWith("welcome-"),
    );
    const conversationHistory = [...priorReal, userMsg].map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Backlog enviado ao modelo: campos do contrato BacklogItem da edge fn.
    // Os 3 scores RICE viajam com nomes explícitos para que o prompt possa
    // referenciá-los e a IA possa devolvê-los nos cards de resposta.
    const backlog = issues.map(i => ({
      key: i.key,
      title: i.title,
      issueType: i.issueType,
      priority: i.priority,
      status: i.status,
      riceScore: i.riceScore,
      impactScore: i.impact,
      effortScore: i.effort,
      components: i.components,
      assignee: i.assignee,
    }));

    setSessions(prev => prev.map(s =>
      s.id === sessionId
        ? {
            ...s,
            messages: [...s.messages, userMsg],
            preview: trimmed,
            title: s.title === "Nova conversa" ? truncate(trimmed, 60) : s.title,
          }
        : s,
    ));
    setInput("");
    setIsTyping(true);

    try {
      const { data, error } = await supabase.functions.invoke("chat", {
        body: {
          messages: conversationHistory,
          backlog,
          projectKey: activeProject?.key,
        },
      });

      if (error) throw new Error(error.message ?? String(error));
      const payload = data as { blocks?: ChatBlock[]; error?: string } | null;
      if (payload?.error) throw new Error(payload.error);

      const blocks = payload?.blocks ?? [];
      const textParts: string[] = [];
      const linkedIds: string[] = [];

      for (const block of blocks) {
        if (block.type === "text" && typeof block.content === "string") {
          textParts.push(block.content);
        } else if (block.type === "insight" && typeof block.content === "string") {
          textParts.push(`💡 **Observação:** ${block.content}`);
        } else if (block.type === "issues" && Array.isArray(block.items)) {
          for (const item of block.items) {
            const found = issues.find(i => i.key === item.key);
            if (found && !linkedIds.includes(found.id)) linkedIds.push(found.id);
          }
        }
        // "actions" ignorado — o drawer ainda não tem UI para botões de ação.
      }

      const aiMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: textParts.join("\n\n").trim() || "Não consegui gerar uma resposta.",
        timestamp: new Date().toISOString(),
        linkedIssues: linkedIds.length > 0 ? linkedIds : undefined,
      };

      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, messages: [...s.messages, aiMsg] } : s,
      ));
    } catch (e) {
      const detail = e instanceof Error ? e.message : "Erro desconhecido.";
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `Não consegui gerar uma resposta agora. ${detail}`,
        timestamp: new Date().toISOString(),
      };
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, messages: [...s.messages, errMsg] } : s,
      ));
    } finally {
      setIsTyping(false);
    }
  }, [sessions, issues, activeProject?.key, backlogSynchronizing]);

  const startSession = useCallback((initialMessage?: string) => {
    const id = `session-${Date.now()}`;
    const now = new Date().toISOString();
    const greeting: ChatMessage = {
      id: `welcome-${Date.now()}`,
      role: "assistant",
      content: WELCOME_MESSAGE,
      timestamp: now,
    };
    const session: ChatSession = {
      id,
      title: "Nova conversa",
      preview: "Pergunte sobre o backlog…",
      createdAt: now,
      messages: [greeting],
    };
    setSessions(prev => [session, ...prev]);
    setActiveSessionId(id);
    setView("chat");
    if (initialMessage) {
      // Os updaters de setSessions garantem que a sessão recém-criada já está
      // visível na próxima chamada via prev.
      sendMessage(id, initialMessage);
    }
  }, [sendMessage]);

  const markNotificationSeen = useCallback(() => {
    try {
      localStorage.setItem(LS_NOTIF_SEEN, "true");
      window.dispatchEvent(new StorageEvent("storage", { key: LS_NOTIF_SEEN }));
    } catch { /* ignore */ }
    setNotifSeen(true);
  }, []);

  // A tela inicial é SEMPRE "welcome" (insights + sugestões) quando o
  // assistente está pronto. O histórico passou a ser uma view secundária
  // acessada pelo botão Clock no header.
  //
  // Enquanto o backlog ainda esta carregando (fetch inicial OU todos os
  // scores em zero), nao podemos confiar em jiraConnected/backlogAnalyzed
  // — esses flags sao lidos de localStorage que pode estar desatualizado.
  // Caimos em "loading" pra mostrar spinner em vez de "Conecte sua conta
  // Jira" indevido.
  const decideInitialView = useCallback((): DrawerView => {
    if (!isDemoMode && backlogSynchronizing) return "loading";
    if (!isDemoMode && !jiraConnected) return "no-jira";
    if (!isDemoMode && !backlogAnalyzed) return "no-analysis";
    return "welcome";
  }, [isDemoMode, jiraConnected, backlogAnalyzed, backlogSynchronizing]);

  const handleOpen = () => {
    setOpen(true);
    const next = decideInitialView();
    setView(next);
    // Marca a notificação como vista assim que o usuário entra na tela
    // principal pós-análise — o badge some na primeira abertura.
    if (next === "welcome") markNotificationSeen();
  };

  // Re-avalia a view quando o estado de carregamento termina. Sem isso,
  // ficariamos travados em "loading" depois que o backlog terminou de
  // sincronizar. Tambem corrige o caso onde "no-jira"/"no-analysis"
  // foram escolhidos com base em flags desatualizados.
  useEffect(() => {
    if (!open) return;
    if (view !== "loading" && view !== "no-jira" && view !== "no-analysis") return;
    const next = decideInitialView();
    if (next === view) return;
    setView(next);
    if (next === "welcome") markNotificationSeen();
    // markNotificationSeen e estavel — ignorar warning de exhaustive-deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, backlogSynchronizing, jiraConnected, backlogAnalyzed, view]);

  const handleWelcomeChip = (text: string) => {
    startSession(text);
  };

  const handleStartFromWelcome = () => {
    startSession();
  };

  const handleConfirmReopen = () => {
    if (!reopenPromptSession) return;
    setActiveSessionId(reopenPromptSession.id);
    setReopenPromptSession(null);
    setView("chat");
  };

  const handleNewFromPrompt = () => {
    setReopenPromptSession(null);
    startSession();
  };

  const handleSendCurrent = () => {
    if (!activeSessionId || isTyping) return;
    sendMessage(activeSessionId, input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendCurrent();
    }
  };

  const isHidden = HIDDEN_ROUTES.some(r => location.pathname.startsWith(r));
  if (isHidden) return null;

  // ── Render ─────────────────────────────────────────────

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={handleOpen}
          aria-label="Abrir Assistente IA"
          className="fixed bottom-6 right-6 z-[60] flex items-center justify-center rounded-full bg-accent text-white shadow-accent-glow hover:brightness-110 transition-all hover:scale-105"
          style={{ width: 56, height: 56 }}
        >
          <Sparkles className="h-6 w-6" />
          {hasNotification && (
            <span
              aria-hidden
              className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-card animate-pulse"
            />
          )}
        </button>
      )}

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/40 animate-fade-up" onClick={() => setOpen(false)} />
          <aside
            className="absolute right-0 top-0 h-full bg-card border-l shadow-2xl flex flex-col animate-fade-up"
            style={{ width: "min(420px, 100vw)" }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 border-b bg-bg-surface-1 px-4 py-3">
              {view === "history" ? (
                <button
                  onClick={() => setView("welcome")}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-bg-surface-2 hover:text-foreground transition-colors"
                  aria-label="Voltar para insights"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Voltar
                </button>
              ) : view === "chat" ? (
                <button
                  onClick={() => setView("welcome")}
                  className="rounded-md p-1.5 hover:bg-bg-surface-2 text-muted-foreground"
                  aria-label="Voltar para insights"
                  title="Voltar para insights"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              ) : (
                <span style={{ width: 32 }} />
              )}

              {view !== "history" && (
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent shadow-accent-glow">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                {view === "history" ? (
                  <>
                    <p className="text-sm font-semibold truncate">Conversas anteriores</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {sessions.length} {sessions.length === 1 ? "conversa" : "conversas"}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold truncate">
                      {ready && view === "chat" && activeSession ? activeSession.title : "Assistente IA"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {ready ? `${project.key} · ${project.name}` : "Assistente de backlog"}
                    </p>
                  </>
                )}
              </div>

              {ready && view !== "history" && sessions.length > 0 && (
                <button
                  onClick={() => setView("history")}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-bg-surface-2 hover:text-foreground transition-colors"
                  aria-label="Conversas anteriores"
                  title="Conversas anteriores"
                >
                  <Clock className="h-4 w-4" />
                </button>
              )}

              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 hover:bg-bg-surface-2 text-muted-foreground"
                aria-label="Fechar Assistente IA"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body por view */}
            {view === "loading" && (
              <div
                className="flex flex-1 flex-col items-center justify-center gap-4 px-8 py-10 text-center"
                role="status"
                aria-live="polite"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
                  <Loader2 className="h-7 w-7 animate-spin text-accent" />
                </div>
                <div>
                  <p className="text-base font-semibold">Carregando seu backlog…</p>
                  <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                    Sincronizando com o Jira para preparar o Assistente.
                  </p>
                </div>
              </div>
            )}

            {view === "no-jira" && (
              <BlockedState
                icon={<KanbanSquare style={{ width: 40, height: 40 }} />}
                title="Conecte sua conta Jira"
                text="Conecte sua conta Jira para ativar o Assistente IA."
                ctaLabel="Conectar Jira"
                onCta={() => { setOpen(false); navigate("/conectar-jira"); }}
              />
            )}

            {view === "no-analysis" && (
              <BlockedState
                icon={<Lock style={{ width: 40, height: 40 }} />}
                title="Backlog não analisado"
                text="Clique em Priorizar com IA no Backlog para ativar o Assistente."
                ctaLabel="Ir para o Backlog"
                onCta={() => {
                  setOpen(false);
                  navigate(activeProject?.key ? `/repository/${activeProject.key}/backlog` : "/dashboard");
                }}
              />
            )}

            {view === "welcome" && (
              <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
                <header>
                  <h2 className="text-lg font-bold tracking-tight">
                    ✨ Seu backlog foi analisado!
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    O Assistente IA gerou insights sobre seus {issues.length} tickets. Veja o que encontrei:
                  </p>
                </header>

                {insights.length > 0 ? (
                  <div className="space-y-2.5">
                    {insights.map((c, i) => <ToneCard key={i} {...c} />)}
                  </div>
                ) : (
                  <div className="rounded-2xl border bg-bg-surface-1 p-4 text-sm text-muted-foreground">
                    Tudo equilibrado por aqui — não detectei riscos óbvios neste backlog.
                  </div>
                )}

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                    Perguntas sugeridas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {WELCOME_SUGGESTIONS.map(s => (
                      <SuggestionChip key={s} text={s} onClick={() => handleWelcomeChip(s)} />
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleStartFromWelcome}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-accent-glow hover:brightness-110 transition-all"
                >
                  Iniciar conversa
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {view === "history" && (
              <div className="flex-1 overflow-y-auto px-4 py-5 space-y-2">
                {sortedSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-16 gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bg-surface-1 border text-muted-foreground">
                      <Clock className="h-5 w-5" />
                    </div>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Você ainda não tem conversas. Comece uma nova a partir dos insights.
                    </p>
                    <button
                      onClick={() => setView("welcome")}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      Voltar aos insights
                    </button>
                  </div>
                ) : (
                  sortedSessions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setReopenPromptSession(s)}
                      className="w-full rounded-2xl border bg-card p-3 text-left hover:border-accent/40 hover:bg-bg-surface-1 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-bg-surface-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{s.title}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {s.preview}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {formatRelativeDate(s.createdAt)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Modal de confirmação ao clicar numa conversa do histórico */}
            {reopenPromptSession && (
              <div
                className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 px-6"
                onClick={() => setReopenPromptSession(null)}
              >
                <div
                  className="w-full max-w-sm rounded-2xl border bg-card shadow-2xl p-5"
                  onClick={e => e.stopPropagation()}
                >
                  <h3 className="text-base font-semibold">Reabrir esta conversa?</h3>
                  <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                    {reopenPromptSession.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {formatRelativeDate(reopenPromptSession.createdAt)}
                  </p>
                  <div className="mt-4 space-y-2">
                    <button
                      onClick={handleConfirmReopen}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-accent-glow hover:brightness-110 transition-all"
                    >
                      Reabrir esta conversa
                    </button>
                    <button
                      onClick={handleNewFromPrompt}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl border bg-bg-surface-1 px-4 py-2.5 text-sm font-medium hover:bg-bg-surface-2 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Nova conversa
                    </button>
                    <button
                      onClick={() => setReopenPromptSession(null)}
                      className="w-full text-xs text-muted-foreground py-1 hover:text-foreground transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {view === "chat" && activeSession && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
                  {activeSession.messages.map(msg => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      issues={issues}
                      onIssueSelect={setSelectedIssue}
                    />
                  ))}
                  {isTyping && <TypingIndicator />}
                  <div ref={messagesEndRef} />
                </div>

                {/* Suggestions só com a saudação inicial */}
                {activeSession.messages.length <= 1 && (
                  <div className="px-4 pb-2">
                    <CategorySuggestions onPick={text => sendMessage(activeSession.id, text)} />
                  </div>
                )}

                {/* Input — substituido por indicador enquanto o backlog
                    nao esta pronto (loading ou todos os scores em zero) */}
                <div className="border-t bg-bg-surface-1 px-4 pt-3 pb-3 space-y-2">
                  {backlogSynchronizing ? (
                    <div
                      className="flex items-center gap-2 rounded-2xl border bg-bg-elevated px-3 py-2.5 text-sm text-muted-foreground"
                      role="status"
                      aria-live="polite"
                    >
                      <Loader2 className="h-4 w-4 animate-spin text-accent flex-shrink-0" />
                      Sincronizando seu backlog…
                    </div>
                  ) : (
                    <div className="flex items-end gap-2 rounded-2xl border bg-bg-elevated px-3 py-2 focus-within:ring-2 focus-within:ring-accent/30 transition-all">
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Pergunte sobre o backlog… (Enter para enviar)"
                        rows={1}
                        className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground min-h-[24px] max-h-32"
                        style={{ scrollbarWidth: "none" }}
                      />
                      <button
                        onClick={handleSendCurrent}
                        disabled={!input.trim() || isTyping}
                        className={cn(
                          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-all",
                          input.trim() && !isTyping
                            ? "bg-accent text-white shadow-accent-glow hover:brightness-110"
                            : "bg-muted text-muted-foreground cursor-not-allowed",
                        )}
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <TipsAccordion />
                </div>
              </>
            )}

            {/* Fallback: chat view sem sessão ativa (não deve acontecer, mas defensivo) */}
            {view === "chat" && !activeSession && (
              <div className="flex flex-1 items-center justify-center text-center px-8 py-10">
                <div className="space-y-3">
                  <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground opacity-60" />
                  <button
                    onClick={() => startSession()}
                    className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-accent-glow hover:brightness-110 transition-all"
                  >
                    Iniciar conversa
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* Drawer de detalhes do ticket — Radix Portal renderiza fora do aside,
          então o stacking depende do z-[80] passado via topMost. */}
      <IssueDrawer
        issue={selectedIssue}
        allIssues={issues}
        onClose={() => setSelectedIssue(null)}
        topMost
      />
    </>
  );
}
