import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usersRepo } from "@/services/mockStorage";
import { LogIn } from "lucide-react";

const ROLE_LABEL = { admin: "Administrador", supervisor: "Supervisor", agent: "Colaborador" } as const;

export default function Login() {
  const { user, signInAs } = useAuth();
  const navigate = useNavigate();
  if (user) return <Navigate to="/dashboard" replace />;
  const users = usersRepo.listSync().filter((u) => u.is_active);

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-elevation-2">
        <h1 className="text-2xl font-bold tracking-tight">TaskFlow</h1>
        <p className="mt-1 text-sm text-muted-foreground">Escolha com qual usuário deseja entrar.</p>
        <ul className="mt-6 space-y-2">
          {users.map((u) => (
            <li key={u.id}>
              <button
                onClick={() => { signInAs(u.id); navigate("/dashboard"); }}
                className="w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left hover:bg-muted transition"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground text-sm font-semibold">
                  {u.full_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{u.full_name}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email} · {ROLE_LABEL[u.role]}</p>
                </div>
                <LogIn className="h-4 w-4 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
