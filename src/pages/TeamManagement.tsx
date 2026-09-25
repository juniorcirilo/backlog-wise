import { useEffect, useState, useCallback } from "react";
import { usersRepo } from "@/services/mockStorage";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { Check, X, ShieldOff, ShieldCheck, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Member {
  id: string;
  full_name: string;
  email: string;
  status: string;
  is_active: boolean;
  is_approved: boolean;
  created_at: string;
  role: AppRole | null;
}

const roleColors: Record<AppRole, string> = {
  admin: "bg-accent/15 text-accent",
  supervisor: "bg-warning/15 text-warning",
  agent: "bg-muted text-muted-foreground",
};

interface TeamManagementProps {
  /** Quando true, omite o container externo e usa headings menores —
   *  para uso embutido na pagina de Configuracoes. */
  embedded?: boolean;
}

export default function TeamManagement({ embedded = false }: TeamManagementProps = {}) {
  const { user: currentUser } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "active" | "inactive">("all");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await usersRepo.list();
    const merged: Member[] = list.map((u) => ({ ...u, role: u.role }));
    merged.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    setMembers(merged);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const adminCount = members.filter(m => m.role === "admin" && m.is_active).length;

  const approve = async (m: Member) => {
    setBusy(m.id);
    const error = await usersRepo.update(m.id, { is_approved: true }).then(() => null, (e) => e);
    setBusy(null);
    if (error) return toast.error("Não foi possível aprovar");
    toast.success(`${m.full_name} aprovado`);
    load();
  };

  const reject = async (m: Member) => {
    if (!confirm(`Rejeitar e excluir ${m.full_name}?`)) return;
    setBusy(m.id);
    // hard delete: profile + role (cascade do auth.users seria ideal mas requer service role)
    // marcamos como inativo + não aprovado:
    const error = await usersRepo.update(m.id, { is_approved: false, is_active: false }).then(() => null, (e) => e);
    setBusy(null);
    if (error) return toast.error("Erro ao rejeitar");
    toast.success("Membro rejeitado");
    load();
  };

  const changeRole = async (m: Member, newRole: AppRole) => {
    if (m.role === "admin" && newRole !== "admin" && adminCount <= 1) {
      return toast.error("Não é possível remover o único administrador");
    }
    setBusy(m.id);
    // delete + insert para garantir uniq
    const error = await usersRepo.update(m.id, { role: newRole }).then(() => null, (e) => e);
    setBusy(null);
    if (error) return toast.error("Erro ao alterar role");
    toast.success("Role atualizada");
    load();
  };

  const toggleActive = async (m: Member) => {
    if (m.id === currentUser?.id && m.is_active) {
      return toast.error("Você não pode desativar a si mesmo");
    }
    if (m.role === "admin" && m.is_active && adminCount <= 1) {
      return toast.error("Não é possível desativar o único administrador");
    }
    setBusy(m.id);
    const error = await usersRepo.update(m.id, { is_active: !m.is_active }).then(() => null, (e) => e);
    setBusy(null);
    if (error) return toast.error("Erro");
    toast.success(m.is_active ? "Membro desativado" : "Membro reativado");
    load();
  };

  const filtered = members.filter(m => {
    if (filter === "pending") return !m.is_approved;
    if (filter === "active") return m.is_active && m.is_approved;
    if (filter === "inactive") return !m.is_active;
    return true;
  });

  const content = (
    <>
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          {embedded ? (
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <Users className="h-5 w-5 text-accent" /> Equipe
            </h2>
          ) : (
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Users className="h-7 w-7 text-accent" /> Equipe
            </h1>
          )}
          <p className={embedded ? "text-sm text-muted-foreground mt-1" : "mt-1 text-sm text-muted-foreground"}>
            Aprove novos membros, gerencie roles e controle o acesso.
          </p>
        </div>
        <div className="flex gap-1 rounded-xl bg-bg-surface-2 p-1">
          {(["all", "pending", "active", "inactive"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                filter === f ? "bg-card text-foreground shadow-elevation-1" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "Todos" : f === "pending" ? "Pendentes" : f === "active" ? "Ativos" : "Inativos"}
            </button>
          ))}
        </div>
      </div>

      <div className={`${embedded ? "mt-5" : "mt-8"} rounded-2xl border bg-card shadow-elevation-2 overflow-hidden`}>
        {loading ? (
          <div className="p-10 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-accent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Nenhum membro encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg-surface-2 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-3">Membro</th>
                  <th className="text-left px-5 py-3">Role</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-right px-5 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(m => (
                  <tr key={m.id} className="hover:bg-bg-surface-1">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white text-xs font-semibold">
                          {m.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{m.full_name}</p>
                          <p className="text-xs text-muted-foreground">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {m.role ? (
                        <select
                          value={m.role}
                          onChange={(e) => changeRole(m, e.target.value as AppRole)}
                          disabled={busy === m.id}
                          className={`text-xs font-semibold rounded-md px-2 py-1 border-0 outline-none cursor-pointer ${roleColors[m.role]}`}
                        >
                          <option value="admin">admin</option>
                          <option value="supervisor">supervisor</option>
                          <option value="agent">agent</option>
                        </select>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {!m.is_approved ? (
                        <span className="badge-priority-medium">Pendente</span>
                      ) : !m.is_active ? (
                        <span className="badge-priority-high">Inativo</span>
                      ) : (
                        <span className="badge-priority-low text-success bg-success/10">Ativo</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {!m.is_approved && (
                          <>
                            <button
                              onClick={() => approve(m)}
                              disabled={busy === m.id}
                              className="inline-flex items-center gap-1 rounded-md bg-success/10 text-success px-2 py-1 text-xs font-semibold hover:bg-success/20"
                              title="Aprovar"
                            >
                              <Check className="h-3.5 w-3.5" /> Aprovar
                            </button>
                            <button
                              onClick={() => reject(m)}
                              disabled={busy === m.id}
                              className="inline-flex items-center gap-1 rounded-md bg-destructive/10 text-destructive px-2 py-1 text-xs font-semibold hover:bg-destructive/20"
                              title="Rejeitar"
                            >
                              <X className="h-3.5 w-3.5" /> Rejeitar
                            </button>
                          </>
                        )}
                        {m.is_approved && (
                          <button
                            onClick={() => toggleActive(m)}
                            disabled={busy === m.id}
                            className="inline-flex items-center gap-1 rounded-md bg-bg-surface-2 hover:bg-muted px-2 py-1 text-xs font-semibold"
                            title={m.is_active ? "Desativar" : "Reativar"}
                          >
                            {m.is_active ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                            {m.is_active ? "Desativar" : "Reativar"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );

  if (embedded) return content;
  return (
    <div className="px-6 py-8 lg:px-12 lg:py-10 max-w-6xl mx-auto">
      {content}
    </div>
  );
}
