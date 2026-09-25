import { Navigate } from "react-router-dom";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { ShieldAlert } from "lucide-react";

interface Props {
  children: JSX.Element;
  allowedRoles?: AppRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user, loading, profile, role, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <div className="h-10 w-10 rounded-full border-4 border-accent/30 border-t-accent animate-spin" />
        <p className="text-sm text-muted-foreground">Verificando autenticação...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Profile ainda não carregou — aguarda
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 rounded-full border-4 border-accent/30 border-t-accent animate-spin" />
      </div>
    );
  }

  if (profile.is_active === false) {
    signOut();
    return <Navigate to="/login" replace />;
  }

  if (profile.is_approved === false) {
    return <Navigate to="/pending-approval" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && (!role || !allowedRoles.includes(role))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md text-center rounded-2xl border bg-card p-10 shadow-elevation-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">Acesso negado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Você não tem permissão para acessar esta página. Fale com um administrador se acredita que isso é um erro.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
