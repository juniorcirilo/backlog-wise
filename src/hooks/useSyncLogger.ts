import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type SyncType = "jira_full_sync" | "jira_incremental" | "ai_analysis";
export type SyncStatus = "running" | "completed" | "failed";

/**
 * Hook fino para registrar eventos no histórico (`sync_logs`).
 *
 * Uso:
 *   const { logSync, completeSync } = useSyncLogger();
 *   const id = await logSync("ai_analysis");
 *   ...
 *   await completeSync(id, { status: "completed", issuesProcessed: 32 });
 *
 * Falhas são silenciosas para não quebrar o fluxo principal.
 */
export function useSyncLogger() {
  const { user } = useAuth();

  const logSync = useCallback(
    async (syncType: SyncType): Promise<string | null> => {
      if (!user) return null;
      try {
        const { data, error } = await supabase
          .from("sync_logs")
          .insert({
            user_id: user.id,
            sync_type: syncType,
            status: "running",
          })
          .select("id")
          .single();
        if (error) {
          console.warn("[useSyncLogger] insert failed", error);
          return null;
        }
        return data?.id ?? null;
      } catch (e) {
        console.warn("[useSyncLogger] insert exception", e);
        return null;
      }
    },
    [user],
  );

  const completeSync = useCallback(
    async (
      id: string | null,
      opts: { status: SyncStatus; issuesProcessed?: number; errorMessage?: string },
    ): Promise<void> => {
      if (!id) return;
      try {
        const { error } = await supabase
          .from("sync_logs")
          .update({
            status: opts.status,
            completed_at: new Date().toISOString(),
            issues_processed:
              typeof opts.issuesProcessed === "number" ? opts.issuesProcessed : 0,
            error_message: opts.errorMessage ? opts.errorMessage.slice(0, 500) : null,
          })
          .eq("id", id);
        if (error) console.warn("[useSyncLogger] update failed", error);
      } catch (e) {
        console.warn("[useSyncLogger] update exception", e);
      }
    },
    [],
  );

  return { logSync, completeSync };
}
