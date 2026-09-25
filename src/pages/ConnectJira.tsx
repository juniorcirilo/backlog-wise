import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, ExternalLink, Eye, EyeOff, KanbanSquare, Loader2, Save, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

const JIRA_TOKEN_URL = "https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/";
const LEGACY_LS_KEY = "backlogai_jira_credentials";
const LS_DRAFT_KEY = "backlogai_jira_connect_draft";

type Draft = { domain?: string; email?: string };

function readDraft(): Draft {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LS_DRAFT_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return {
      domain: typeof parsed?.domain === "string" ? parsed.domain : undefined,
      email: typeof parsed?.email === "string" ? parsed.email : undefined,
    };
  } catch {
    return {};
  }
}

function writeDraft(draft: Draft) {
  if (typeof window === "undefined") return;
  try {
    if (!draft.domain && !draft.email) {
      window.localStorage.removeItem(LS_DRAFT_KEY);
      return;
    }
    window.localStorage.setItem(LS_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota / private mode errors */
  }
}

function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LS_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

type ConnectionState = "form" | "connecting" | "success";

export default function ConnectJira() {
  const navigate = useNavigate();
  const initialDraft = readDraft();
  const [state, setState] = useState<ConnectionState>("form");
  const [domain, setDomain] = useState(initialDraft.domain ?? "");
  const [email, setEmail] = useState(initialDraft.email ?? "");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasRestoredDraft = Boolean(initialDraft.domain || initialDraft.email);

  // Cleanup do localStorage antigo: o token agora vai para o vault.
  useEffect(() => {
    localStorage.removeItem(LEGACY_LS_KEY);
  }, []);

  // Persiste rascunho (domínio + email) enquanto o usuário digita, para
  // não perder o que já preencheu ao sair da aba para gerar o API token.
  // O token nunca é persistido, por segurança.
  useEffect(() => {
    if (state === "success") return;
    writeDraft({ domain, email });
  }, [domain, email, state]);


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedDomain = domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    const trimmedEmail = email.trim();
    const trimmedToken = token.trim();

    if (!trimmedDomain || !trimmedEmail || !trimmedToken) {
      setError("Preencha todos os campos para continuar.");
      return;
    }
    if (!trimmedDomain.includes(".atlassian.net")) {
      setError("O domínio deve ter o formato sua-empresa.atlassian.net.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Informe um email válido.");
      return;
    }
    if (trimmedToken.length < 20) {
      setError("O API token parece curto demais — confira se copiou inteiro.");
      return;
    }

    setState("connecting");

    // Token vai para o Vault via edge function. Domain e email (não-secretos)
    // ficam em api_keys_registry.metadata para a UI consumir.
    const { error: invokeError } = await supabase.functions.invoke("store-api-key", {
      body: {
        service_name: "jira",
        value: trimmedToken,
        label: "Jira",
        metadata: { domain: trimmedDomain, email: trimmedEmail },
      },
    });

    if (invokeError) {
      setState("form");
      const msg = invokeError.message?.includes("Forbidden")
        ? "Apenas administradores podem conectar uma conta Jira."
        : "Não foi possível salvar as credenciais. Tente novamente.";
      setError(msg);
      return;
    }

    setState("success");
    clearDraft();
    setTimeout(() => navigate("/importar-jira"), 900);
  };

  return (
    <div className="px-6 py-10 lg:px-12 lg:py-14 max-w-3xl mx-auto">
      {/* Hero */}
      <div className="rounded-2xl border bg-card overflow-hidden shadow-elevation-2">
        <div className="bg-gradient-to-br from-primary to-bg-darkest text-white px-8 py-10 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 border border-white/15 mb-5">
            <KanbanSquare className="h-8 w-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Conecte sua conta Jira</h1>
          <p className="mt-3 text-white/75 max-w-md mx-auto leading-relaxed text-sm">
            Informe seu domínio Atlassian, email e API token. O BacklogAI lê os tickets do
            seu projeto, pontua por RICE e devolve um backlog priorizado.
          </p>
          <div className="flex items-center justify-center gap-5 mt-6 text-xs text-white/70">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Somente leitura
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" /> Revogável a qualquer momento
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          {hasRestoredDraft && state === "form" && (
            <div className="flex items-start gap-2 rounded-xl border border-accent/20 bg-accent/5 px-3.5 py-2.5 text-xs text-muted-foreground">
              <Save className="h-3.5 w-3.5 mt-0.5 text-accent flex-shrink-0" />
              <span>
                <span className="font-semibold text-foreground">Rascunho restaurado.</span>{" "}
                Domínio e email salvos automaticamente · o API token não é guardado por segurança.
              </span>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label htmlFor="jira-domain" className="text-sm font-semibold">
                Domínio Atlassian
              </Label>
            </div>
            <input
              id="jira-domain"
              type="text"
              value={domain}
              onChange={e => setDomain(e.target.value)}
              placeholder="minha-empresa.atlassian.net"
              autoComplete="off"
              disabled={state !== "form"}
              className="w-full rounded-xl border bg-bg-elevated px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:opacity-60"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              É o endereço da sua instância Jira na Atlassian.
            </p>
          </div>

          <div>
            <Label htmlFor="jira-email" className="text-sm font-semibold mb-1.5 block">
              Email
            </Label>
            <input
              id="jira-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu.email@empresa.com"
              autoComplete="email"
              disabled={state !== "form"}
              className="w-full rounded-xl border bg-bg-elevated px-3.5 py-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:opacity-60"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Mesmo email que você usa para entrar no Jira.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label htmlFor="jira-token" className="text-sm font-semibold">
                API token
              </Label>
              <a
                href={JIRA_TOKEN_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
              >
                Como gerar meu token <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="relative">
              <input
                id="jira-token"
                type={showToken ? "text" : "password"}
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="ATATT3xFfGF0..."
                autoComplete="off"
                disabled={state !== "form"}
                className="w-full rounded-xl border bg-bg-elevated px-3.5 py-2.5 pr-11 text-sm outline-none transition-all placeholder:text-muted-foreground focus:ring-2 focus:ring-accent/30 focus:border-accent disabled:opacity-60 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowToken(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                aria-label={showToken ? "Ocultar token" : "Mostrar token"}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Gerado em <span className="font-mono">id.atlassian.com</span> · armazenado criptografado no Supabase Vault.
            </p>
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="pt-2">
            {state === "form" && (
              <button type="submit" className="lp-btn-primary-indigo w-full justify-center">
                Conectar Jira <ArrowRight className="h-4 w-4" />
              </button>
            )}
            {state === "connecting" && (
              <button type="button" disabled className={cn(
                "lp-btn-primary-indigo w-full justify-center cursor-not-allowed opacity-80"
              )}>
                <Loader2 className="h-4 w-4 animate-spin" /> Validando credenciais…
              </button>
            )}
            {state === "success" && (
              <button type="button" disabled className="flex w-full items-center justify-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-sm font-semibold text-success">
                <Check className="h-4 w-4" /> Conectado · redirecionando para a importação
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
