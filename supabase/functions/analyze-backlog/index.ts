// ─────────────────────────────────────────────────────────────
//  Edge Function · analyze-backlog
//  Recebe uma lista de tickets Jira + pesos RICE e devolve cada
//  ticket com score, rationale e dependências detectadas.
//  Roda em Deno (Supabase Edge). Usa o Lovable AI Gateway
//  (Gemini 3 Flash) — sem chave Anthropic.
//
//  Status: scaffolding. A chamada real é disparada quando a
//  integração com a API do Jira estiver ligada — hoje o frontend
//  ainda simula o fluxo no Backlog.tsx.
// ─────────────────────────────────────────────────────────────
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Lovable AI Gateway ──────────────────────────────────────
// Padrão OpenAI Chat Completions. Gemini 3 Flash é o modelo padrão e
// não requer configuração de chave: quando a função roda no runtime do
// Lovable Cloud, a autenticação é injetada automaticamente. LOVABLE_API_KEY
// fica como fallback opcional (útil em testes locais com `supabase functions serve`).
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

const SYSTEM_PROMPT = `Você é um assistente de priorização de backlog para times brasileiros que usam Jira (Scrum, Kanban ou Business).
Sua tarefa é analisar tickets e atribuir um score RICE.

Cada ticket vem com os campos lidos do Jira:
- key (ex.: "PLAT-58")
- summary (título)
- description (corpo)
- issueType: Bug | Task | Story | Epic
- priority: Highest | High | Medium | Low | Lowest
- status: To Do | In Progress | Done | Blocked
- components: lista de componentes
- labels: lista de labels

Para CADA ticket você devolve:
- reach (0-10): alcance estimado (quantos usuários/processos afetados)
- impact (0-10): profundidade do impacto
- confidence (0-10): confiança na estimativa
- effort (0-10): esforço percebido (maior = mais trabalho)
- score (0-100): fórmula ponderada pelos pesos do usuário
- rationale (pt-BR, 2-3 frases): explicação curta e direta
- dependencies.blockedBy / dependencies.blocks: chaves Jira de outros tickets mencionados (ex.: ["PLAT-22"])

Heurísticas:
- Bug + priority Highest/High → impact alto, urgência alta.
- Epic → effort tipicamente alto; valor estratégico vai em impact e reach.
- Task com labels operacionais (ex.: "process", "internal") → reach geralmente baixo, impact médio.
- Story → balanceie pelo conteúdo da description.
- components ajudam a estimar reach (ex.: "Auth" afeta toda a base; "Reports/Export" afeta um subconjunto).

Responda APENAS JSON válido, sem prefixos nem markdown:
{
  "items": [
    {
      "key": "PLAT-58",
      "reach": 9,
      "impact": 9,
      "confidence": 9,
      "effort": 2,
      "score": 91.2,
      "rationale": "…",
      "dependencies": { "blockedBy": [], "blocks": ["PLAT-12"] }
    }
  ]
}

Português (pt-BR), tom B2B direto, sem emoji.`;

interface IncomingTicket {
  key: string;
  summary: string;
  description?: string;
  issueType: "Bug" | "Task" | "Story" | "Epic";
  priority: "Highest" | "High" | "Medium" | "Low" | "Lowest";
  status?: string;
  components?: string[];
  labels?: string[];
}

interface RicePreset {
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { tickets, preset } = await req.json() as {
      tickets: IncomingTicket[];
      preset: RicePreset;
    };

    if (!Array.isArray(tickets) || tickets.length === 0) throw new Error("Lista de tickets vazia");

    const userPrompt = `Pesos RICE (0-100): R=${preset.reach} I=${preset.impact} C=${preset.confidence} E=${preset.effort}

Tickets a analisar (${tickets.length}):
${tickets.map(t => `${t.key} [${t.issueType} · ${t.priority}] ${t.summary}
  status: ${t.status ?? "?"}
  components: ${(t.components ?? []).join(", ") || "—"}
  labels: ${(t.labels ?? []).join(", ") || "—"}
  description: ${String(t.description ?? "").slice(0, 400)}`).join("\n\n")}

Devolva o JSON com scores, rationales e dependências para TODOS os tickets.`;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) throw new Error(`Lovable AI Gateway ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";

    // Defesa em profundidade: o modelo costuma respeitar response_format=json_object,
    // mas em alguns casos pode envolver em ```json — extrai o primeiro objeto.
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Resposta sem JSON");
    const parsed = JSON.parse(match[0]);

    return new Response(JSON.stringify({
      ...parsed,
      meta: {
        model: MODEL,
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
      },
    }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
