import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const FLAG = "auth_trigger_checked";

/**
 * Auto-reparo de remix: na primeira montagem do app por sessão,
 * chama a Edge Function `ensure-auth-trigger` que verifica/recria
 * os triggers em auth.users (que o Lovable não replica em remix).
 *
 * Não bloqueia o app — roda em background.
 */
export function useEnsureAuthTrigger() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(FLAG)) return;

    sessionStorage.setItem(FLAG, "1");

    supabase.functions
      .invoke("ensure-auth-trigger")
      .then(({ data, error }) => {
        if (error) {
          console.warn("[Auth Setup] Edge function error:", error);
          return;
        }
        if (data?.ok === false) {
          console.warn("[Auth Setup] Trigger check failed:", data?.message);
          // Aviso discreto — o usuário comum não verá nada se tudo estiver ok
          toast.error("Atenção: setup de auth", {
            description:
              data?.message ||
              "O trigger de cadastro pode estar ausente. Veja o README.",
            duration: 10000,
          });
        } else if (data?.created) {
          console.info("[Auth Setup] Trigger recriado:", data?.message);
        }
      })
      .catch((err) => {
        console.warn("[Auth Setup] Network error:", err);
      });
  }, []);
}
