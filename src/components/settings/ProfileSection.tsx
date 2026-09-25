import { useEffect, useState } from "react";
import { Loader2, Mail, KeyRound, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { usersRepo } from "@/services/mockStorage";

export default function ProfileSection() {
  const { user, profile, refreshProfile } = useAuth();

  // ── Nome completo ─────────────────────────────────────
  const [name, setName] = useState(profile?.full_name ?? "");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    setName(profile?.full_name ?? "");
  }, [profile?.full_name]);

  const dirty = name.trim() !== (profile?.full_name ?? "");

  const handleSaveName = async () => {
    if (!user || !dirty) return;
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      toast.error("Nome não pode ficar em branco");
      return;
    }
    setSavingName(true);
    let error: Error | null = null;
    try { await usersRepo.update(user.id, { full_name: trimmed }); } catch (e) { error = e as Error; }
    setSavingName(false);
    if (error) {
      toast.error("Não foi possível salvar", { description: error.message });
      return;
    }
    await refreshProfile();
    toast.success("Perfil atualizado");
  };

  // ── Trocar senha ──────────────────────────────────────
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const closePwdForm = () => {
    setShowPwdForm(false);
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("A nova senha precisa ter ao menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setSavingPassword(true);
    const error = null as Error | null; // modo local: sem senha real
    setSavingPassword(false);
    if (error) {
      toast.error("Não foi possível alterar a senha", { description: error.message });
      return;
    }
    closePwdForm();
    toast.success("Senha alterada com sucesso");
  };

  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">Meu Perfil</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Atualize seu nome e gerencie a senha de acesso.
      </p>

      {/* ── Card: nome + email ────────────────────────── */}
      <div className="mt-5 rounded-2xl border bg-card p-5 space-y-5">
        <div>
          <label
            className="block text-xs font-medium text-muted-foreground mb-1.5"
            htmlFor="profile-name"
          >
            Nome completo
          </label>
          <input
            id="profile-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Seu nome"
            className="w-full rounded-xl border bg-bg-elevated px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </div>

        <div>
          <label
            className="block text-xs font-medium text-muted-foreground mb-1.5"
            htmlFor="profile-email"
          >
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              id="profile-email"
              type="email"
              value={user?.email ?? ""}
              readOnly
              className="w-full rounded-xl border border-input bg-muted/40 pl-10 pr-3.5 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            O email é a sua identidade de login e não pode ser alterado por aqui.
          </p>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={handleSaveName}
            disabled={!dirty || savingName}
            className="lp-btn-primary-indigo disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingName && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar alterações
          </button>
        </div>
      </div>

      {/* ── Card: alterar senha ──────────────────────── */}
      <div className="mt-5 rounded-2xl border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              Alterar senha
            </h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-md">
              Defina uma nova senha de acesso. Você continuará logado nesta sessão.
            </p>
          </div>
          {!showPwdForm && (
            <button
              type="button"
              onClick={() => setShowPwdForm(true)}
              className="inline-flex items-center gap-2 rounded-xl border bg-bg-surface-1 px-4 py-2 text-sm font-medium hover:bg-bg-surface-2 transition-colors flex-shrink-0"
            >
              Alterar senha
            </button>
          )}
        </div>

        {showPwdForm && (
          <div className="mt-4 pt-4 border-t space-y-3">
            <div>
              <label
                className="block text-xs font-medium text-muted-foreground mb-1.5"
                htmlFor="profile-new-password"
              >
                Nova senha
              </label>
              <input
                id="profile-new-password"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Mín. 6 caracteres"
                autoComplete="new-password"
                className="w-full rounded-xl border bg-bg-elevated px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
            </div>
            <div>
              <label
                className="block text-xs font-medium text-muted-foreground mb-1.5"
                htmlFor="profile-confirm-password"
              >
                Confirme a nova senha
              </label>
              <input
                id="profile-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
                autoComplete="new-password"
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleChangePassword();
                  }
                }}
                className="w-full rounded-xl border bg-bg-elevated px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={closePwdForm}
                disabled={savingPassword}
                className="inline-flex items-center gap-1.5 rounded-xl border bg-bg-surface-1 px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-bg-surface-2 disabled:opacity-50 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleChangePassword}
                disabled={savingPassword || !newPassword || !confirmPassword}
                className="lp-btn-primary-indigo disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar nova senha
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
