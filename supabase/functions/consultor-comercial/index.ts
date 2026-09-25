// Consultor Comercial & de Risco — indústria vidreira.
// Recebe a carteira de solicitações de alçada e responde em pt-BR.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const SYSTEM_PROMPT = `Você é o Consultor Comercial & de Risco de uma indústria de beneficiamento e distribuição de vidros.
Responde em português (pt-BR), tom executivo, direto, sem emoji, em markdown curto.

Contexto do negócio:
- Linhas: temperado incolor/colorido, laminado comum e temperado, espelho prata, insulado termoacústico e linha box.
- Custo industrial considera energia do forno de têmpera, insumos (PVB, chapa bruta), lapidação/furação e quebra normativa de 3% a 5%.
- Margem líquida mínima viável: 18%. Faixa saudável: acima de 28%.
- Alçadas: até 5% de desconto e margem acima de 28% = Gerente Comercial; 5% a 12%, prazo acima de 45 dias ou crédito = Gerente Comercial + Financeiro; acima de 12%, pedido retido acima de R$ 50.000 ou margem abaixo de 18% = Diretoria.
- Pontualidade do cliente abaixo de 75% é sinal de risco de crédito.

Regras:
- Use somente as solicitações fornecidas. Nunca invente cliente, número ou valor.
- Cite solicitações por número e cliente (ex.: "SOL-2026-008 — Grupo Arcos").
- Ao recomendar aprovação ou recusa, justifique com margem, exposição de crédito e impacto fabril.
- Seja conciso: no máximo 6 linhas mais uma lista curta quando fizer sentido.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, carteira } = await req.json() as {
      messages: { role: string; content: string }[];
      carteira?: string;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("Lista de mensagens vazia");
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: `${SYSTEM_PROMPT}\n\nCarteira atual de solicitações:\n${carteira || "(nenhuma solicitação carregada)"}`,
          },
          ...messages.map(m => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
        ],
        temperature: 0.3,
        max_tokens: 900,
      }),
    });

    if (res.status === 429) {
      return new Response(
        JSON.stringify({ error: "limite_de_uso", reply: "Muitas consultas seguidas. Aguarde alguns instantes e tente novamente." }),
        { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
      );
    }
    if (!res.ok) throw new Error(`Gateway ${res.status}: ${await res.text()}`);

    const data = await res.json();
    const reply: string = data.choices?.[0]?.message?.content ?? "Não consegui gerar uma análise agora.";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ reply: "Não consegui analisar a carteira agora. Tente novamente em instantes.", error: String(e) }),
      { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }
});
