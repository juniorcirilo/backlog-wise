import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Info, AlertTriangle, X, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

const DOMAIN_REGEX = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;

interface ConfigRow { key: string; value: string }

interface SecuritySettingsProps {
  /** Quando true, omite o container externo e usa headings menores —
   *  para uso embutido na pagina de Configuracoes. */
  embedded?: boolean;
}

export default function SecuritySettings({ embedded = false }: SecuritySettingsProps = {}) {
  const [loading, setLoading] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);
  const [restrictDomain, setRestrictDomain] = useState(false);
  const [domains, setDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("project_config")
        .select("key,value");
      if (error) {
        toast.error("Erro ao carregar configurações");
      } else {
        const map = Object.fromEntries((data as ConfigRow[]).map(r => [r.key, r.value]));
        setRequireApproval(map.require_account_approval === "true");
        setRestrictDomain(map.restrict_signup_by_domain === "true");
        setDomains((map.allowed_email_domains || "").split(",").map(d => d.trim()).filter(Boolean));
      }
      setLoading(false);
    })();
  }, []);

  const updateConfig = async (key: string, value: string) => {
    setSaving(true);
    const { error } = await supabase.from("project_config").update({ value }).eq("key", key);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar");
      return false;
    }
    toast.success("Configuração atualizada");
    return true;
  };

  const toggleApproval = async (v: boolean) => {
    setRequireApproval(v);
    await updateConfig("require_account_approval", v ? "true" : "false");
  };

  const toggleDomainRestriction = async (v: boolean) => {
    setRestrictDomain(v);
    await updateConfig("restrict_signup_by_domain", v ? "true" : "false");
  };

  const addDomain = async () => {
    const d = newDomain.trim().toLowerCase();
    if (!DOMAIN_REGEX.test(d)) {
      toast.error("Formato de domínio inválido");
      return;
    }
    if (domains.includes(d)) {
      toast.error("Domínio já adicionado");
      return;
    }
    const next = [...domains, d];
    setDomains(next);
    setNewDomain("");
    await updateConfig("allowed_email_domains", next.join(","));
  };

  const removeDomain = async (d: string) => {
    const next = domains.filter(x => x !== d);
    setDomains(next);
    await updateConfig("allowed_email_domains", next.join(","));
  };

  if (loading) {
    const skeleton = (
      <>
        <div className="animate-pulse bg-muted h-8 w-64 rounded-lg" />
        <div className="mt-6 animate-pulse bg-muted h-40 rounded-2xl" />
      </>
    );
    if (embedded) return skeleton;
    return (
      <div className="px-6 py-10 max-w-3xl mx-auto">
        {skeleton}
      </div>
    );
  }

  const content = (
    <>
      <div>
        {embedded ? (
          <h2 className="text-xl font-semibold tracking-tight">Segurança</h2>
        ) : (
          <h1 className="text-3xl font-bold tracking-tight">Segurança</h1>
        )}
        <p className="mt-1 text-sm text-muted-foreground">
          Controle quem pode se cadastrar e como novas contas são aprovadas.
        </p>
      </div>

      {/* Aprovação */}
      <section className={`${embedded ? "mt-5" : "mt-8"} rounded-2xl border bg-card p-6 shadow-elevation-2`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Exigir aprovação para novas contas</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Quando ativo, novos usuários precisarão ser aprovados por um administrador antes de acessar a plataforma.
            </p>
          </div>
          <Switch checked={requireApproval} onCheckedChange={toggleApproval} disabled={saving} />
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-accent/10 border border-accent/20 p-3 text-xs text-foreground">
          <Info className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
          <span>O primeiro usuário cadastrado (administrador) é sempre aprovado automaticamente.</span>
        </div>
      </section>

      {/* Domínio */}
      <section className="mt-6 rounded-2xl border bg-card p-6 shadow-elevation-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Restringir cadastro por domínio de email</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Quando ativo, apenas emails dos domínios listados abaixo poderão se cadastrar.
            </p>
          </div>
          <Switch checked={restrictDomain} onCheckedChange={toggleDomainRestriction} disabled={saving} />
        </div>

        {restrictDomain && (
          <div className="mt-5">
            <div className="flex gap-2">
              <input
                type="text"
                value={newDomain}
                onChange={(e) => setNewDomain(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDomain())}
                placeholder="empresa.com"
                className="flex-1 rounded-xl border border-input bg-background px-3.5 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
              <button onClick={addDomain} className="lp-btn-primary-indigo">
                <Plus className="h-4 w-4" /> Adicionar
              </button>
            </div>

            {domains.length === 0 ? (
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>Atenção: nenhum domínio configurado. Nenhum novo cadastro será permitido.</span>
              </div>
            ) : (
              <ul className="mt-4 flex flex-wrap gap-2">
                {domains.map(d => (
                  <li key={d} className="inline-flex items-center gap-2 rounded-md bg-accent/10 text-accent text-xs font-semibold px-2.5 py-1">
                    {d}
                    <button onClick={() => removeDomain(d)} className="hover:text-destructive" aria-label={`Remover ${d}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-accent/10 border border-accent/20 p-3 text-xs text-foreground">
          <Info className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
          <span>O primeiro usuário (administrador) sempre pode se cadastrar independente do domínio.</span>
        </div>
      </section>

      {saving && (
        <div className="fixed bottom-6 right-6 inline-flex items-center gap-2 rounded-xl bg-card border px-4 py-2 shadow-elevation-3 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
        </div>
      )}
    </>
  );

  if (embedded) return content;
  return (
    <div className="px-6 py-8 lg:px-12 lg:py-10 max-w-3xl mx-auto">
      {content}
    </div>
  );
}
