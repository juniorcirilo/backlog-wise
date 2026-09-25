import { useEffect, useState } from "react";
import {
  History,
  Clock,
  CheckCircle2,
  Loader2,
  XCircle,
  RefreshCw,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDemo } from "@/contexts/DemoContext";
import { supabase } from "@/integrations/supabase/client";
import { getDemoActivities } from "@/data/mock-data";
import { cn } from "@/lib/utils";

interface SyncLogRow {
  id: string;
  sync_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  issues_processed: number | null;
  error_message: string | null;
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
  return { Icon: Loader2, cls: "bg-warning/15 text-warning-foreground border-warning/20", label: "em execução" };
}

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

export default function Historico() {
  const { user } = useAuth();
  const { isDemoMode, demoProfile } = useDemo();
  const [logs, setLogs] = useState<SyncLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoMode) {
      // Reaproveita os mocks do demo no dashboard.
      const demo = getDemoActivities(demoProfile).map(a => ({
        id: a.id,
        sync_type: a.sync_type,
        status: a.status,
        started_at: a.started_at,
        completed_at: null,
        issues_processed: null,
        error_message: null,
      }));
      setLogs(demo);
      setLoading(false);
      return;
    }
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from("sync_logs")
          .select("id, sync_type, status, started_at, completed_at, issues_processed, error_message")
          .order("started_at", { ascending: false })
          .limit(200);
        if (cancelled) return;
        if (err) throw err;
        setLogs((data ?? []) as SyncLogRow[]);
      } catch (e) {
        if (!cancelled) setError("Não foi possível carregar o histórico. Tente recarregar a página.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, isDemoMode, demoProfile]);

  return (
    <div className="px-6 py-8 lg:px-12 lg:py-10 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Histórico</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Análises de IA e sincronizações realizadas nos seus projetos.
        </p>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-destructive/20 bg-destructive/10 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="mt-8 animate-pulse rounded-2xl border bg-bg-elevated h-64" />
      ) : logs.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed bg-bg-elevated px-8 py-16 text-center shadow-elevation-1">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-surface-2 text-muted-foreground">
            <History className="h-12 w-12" />
          </div>
          <p className="mt-4 text-base font-semibold">Nenhum registro ainda</p>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
            Seu histórico de análises e sincronizações aparecerá aqui.
          </p>
        </div>
      ) : (
        <ul className="mt-6 rounded-2xl border bg-bg-elevated divide-y divide-border shadow-elevation-1 overflow-hidden">
          {logs.map(l => {
            const Icon = syncIcon(l.sync_type);
            const { Icon: SIcon, cls, label } = statusBadge(l.status);
            const title = SYNC_LABELS[l.sync_type] ?? l.sync_type.replace(/_/g, " ");
            return (
              <li
                key={l.id}
                className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-bg-surface-1"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-surface-1 text-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{title}</p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelative(l.started_at)}
                      </span>
                      {typeof l.issues_processed === "number" && l.issues_processed > 0 && (
                        <span>· {l.issues_processed} tickets</span>
                      )}
                    </p>
                    {l.error_message && (
                      <p className="text-[11px] text-destructive mt-0.5 truncate">{l.error_message}</p>
                    )}
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
      )}
    </div>
  );
}
