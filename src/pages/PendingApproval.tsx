import { Clock, RefreshCw, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";

export default function PendingApproval() {
  const { profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    await refreshProfile();
    setChecking(false);
    // se aprovou, ProtectedRoute já libera no próximo render
    setTimeout(() => {
      // se ainda aqui, mostrar feedback
      toast.message("Ainda aguardando aprovação", {
        description: "Tente novamente em alguns instantes.",
      });
    }, 200);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-elevation-3 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/15 text-warning">
          <Clock className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Aguardando Aprovação</h1>
        <p className="mt-3 text-sm text-foreground">
          Olá, <span className="font-semibold">{profile?.full_name || "Usuário"}</span>! Sua conta foi
          criada com sucesso, mas ainda precisa ser aprovada por um administrador.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Você receberá acesso assim que um administrador aprovar sua conta.
        </p>
        <div className="mt-4 rounded-lg border border-border bg-bg-surface-2 p-3 text-left text-xs text-muted-foreground">
          <strong className="text-foreground">Acabou de se cadastrar?</strong> Verifique sua caixa de entrada
          (e a pasta de spam) e clique no link de confirmação de e-mail antes de tentar acessar.
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={handleCheck}
            disabled={checking}
            className="lp-btn-primary-indigo w-full justify-center disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
            Verificar novamente
          </button>
          <button
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-bg-surface-2 transition"
          >
            <LogOut className="h-4 w-4" /> Fazer Logout
          </button>
        </div>
      </div>
    </div>
  );
}
