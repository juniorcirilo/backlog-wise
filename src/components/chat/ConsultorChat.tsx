import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCommercialRequests } from "@/hooks/useCommercialRequests";
import { BRL, PCT, computeMetrics, isOpen, resolveAuthority } from "@/lib/commercial-engine";
import { REQUEST_TYPE_LABEL, STATUS_LABEL } from "@/types/commercial";
import { cn } from "@/lib/utils";
import { Loader2, MessageSquareText, Send, X } from "lucide-react";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Resumo executivo das solicitações pendentes",
  "Quais pedidos estão com margem abaixo do mínimo?",
  "Quais clientes apresentam risco de crédito?",
];

export default function ConsultorChat() {
  const { requests } = useCommercialRequests();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Sou o consultor comercial e de risco. Posso analisar margem, crédito e alçadas da carteira de solicitações.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const carteira = requests
    .map(r => {
      const m = computeMetrics(r);
      const a = resolveAuthority(r);
      return `${r.id} | ${r.customer} | ${REQUEST_TYPE_LABEL[r.type]} | status=${STATUS_LABEL[r.status]} | liquido=${BRL(m.net)} | desconto=${PCT(r.discountPercent)} | margem=${PCT(m.marginPercent)} | area=${m.area.toFixed(1)}m2 | prazo=${r.paymentTermDays}d | pontualidade=${r.paymentPunctuality}% | retido=${r.orderHeld ? "sim" : "nao"} | alcada=${a.level} | risco=${a.risk} | aberta=${isOpen(r) ? "sim" : "nao"}`;
    })
    .join("\n");

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const next = [...messages, { role: "user" as const, content: text.trim() }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("consultor-comercial", {
        body: { messages: next.map(m => ({ role: m.role, content: m.content })), carteira },
      });
      const reply =
        (data as { reply?: string })?.reply ??
        (error ? "Não consegui falar com o consultor agora. Tente novamente." : "Sem resposta.");
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Não consegui falar com o consultor agora. Tente novamente." }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir consultor comercial"
        className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-white shadow-elevation-3 transition-transform hover:scale-105"
      >
        <MessageSquareText className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex h-[560px] w-[min(94vw,420px)] flex-col overflow-hidden rounded-2xl border bg-bg-elevated shadow-elevation-3">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <p className="text-sm font-bold">Consultor Comercial & Risco</p>
          <p className="text-[11px] text-muted-foreground">Margem, crédito e alçadas da carteira</p>
        </div>
        <button onClick={() => setOpen(false)} aria-label="Fechar" className="rounded-md p-1.5 hover:bg-bg-surface-2">
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed",
                m.role === "user" ? "bg-accent text-white" : "bg-bg-surface-1 text-foreground",
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analisando a carteira...
          </div>
        )}
        {messages.length === 1 && (
          <div className="space-y-2 pt-2">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => send(s)}
                className="w-full rounded-xl border border-border bg-bg-surface-1 px-3 py-2 text-left text-xs hover:border-accent/40"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={e => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Pergunte sobre margem, crédito ou prazos"
          className="h-10 flex-1 rounded-xl border border-border bg-bg-surface-1 px-3 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-50"
          aria-label="Enviar"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
