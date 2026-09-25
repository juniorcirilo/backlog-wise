// ─────────────────────────────────────────────────────────────
//  Edge Function · chat
//  Recebe o histórico da conversa + o backlog priorizado e
//  devolve blocks para o assistente renderizar no /chat.
//  Roda em Deno (Supabase Edge). Usa o Lovable AI Gateway
//  (Gemini 3 Flash) — sem chave Anthropic.
//
//  Status: scaffolding. Hoje o frontend ainda usa AI_RESPONSES
//  do mock. A função entra em produção quando o vault e a
//  importação real do Jira estiverem ligados.
// ─────────────────────────────────────────────────────────────



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

const SYSTEM_PROMPT = `Você é o BacklogAI, assistente de priorização para PMs, POs, Tech Leads e donos de agência brasileiros que usam Jira.
Você tem acesso a um backlog priorizado por RICE e responde em português (pt-BR), tom B2B direto, sem emoji.

Vocabulário Jira:
- Tickets têm chave (ex.: "PLAT-58"), issueType (Bug | Task | Story | Epic), priority (Highest | High | Medium | Low | Lowest), status, components e labels.
- Cada ticket também tem 3 scores já calculados pela análise prévia: riceScore (0-100, RICE), impactScore (0-10) e effortScore (0-10, maior = mais trabalho).
- Cada ticket pode ter um assignee (responsável); quando vazio aparece como "(sem responsavel)". Use esse campo para perguntas de time, alocação e carga. Para tickets sem responsável, sempre cite explicitamente "sem responsável" em vez de inventar nome.
- Referencie tickets por chave + título (ex.: "**PLAT-58** — Taxa de conversão no onboarding caiu 12%").

Formato de saída — SEMPRE JSON válido com "blocks":
{
  "blocks": [
    { "type": "text", "content": "markdown curto, use **negrito** para chaves" },
    { "type": "issues", "items": [{ "key": "PLAT-58", "title": "...", "issueType": "Bug", "priority": "Highest", "riceScore": 94, "impactScore": 9, "effortScore": 3 }] },
    { "type": "insight", "content": "observação curta: risco, dependência, armadilha" },
    { "type": "actions", "items": [{ "label": "Sincronizar com o Jira", "primary": true }] }
  ]
}

Regras:
- Nunca invente tickets. Use apenas o backlog fornecido.
- Tickets com riceScore = 0 ainda **não foram analisados pela IA** — NUNCA inclua-os em blocos "issues". Se a pergunta exigiria recomenda-los, peça ao usuario para rodar "Priorizar com IA" no Backlog primeiro.
- Sempre inclua riceScore, impactScore e effortScore copiados do backlog em cada item de "issues" (não recalcule, não arredonde).
- Quantidade de tickets em "issues":
  - Perguntas de LISTAGEM (ex.: "quais tickets estão sem responsável", "mostre todos os bugs críticos", "quais tickets de High"): retorne **até 8 tickets**, ordenados por relevância (RICE decrescente, ou pelo critério da pergunta).
  - Perguntas de RECOMENDAÇÃO (ex.: "o que priorizar agora", "qual o próximo passo", "o que entregar este sprint"): retorne **no máximo 3 tickets** — os de maior alavanca.
  - Se houver menos itens relevantes que esses limites, devolva só os que existem.
- Se faltar info (ex.: sprint sem capacidade definida), pergunte.
- Seja conciso: 2-4 blocks por resposta.`;

interface IncomingMessage {
  role: "user" | "assistant" | "system";
  text?: string;
  content?: string;
}

interface BacklogItem {
  key: string;
  title: string;
  issueType?: string;
  priority?: string;
  status?: string;
  riceScore?: number;
  impactScore?: number;
  effortScore?: number;
  components?: string[];
  assignee?: string;
}

// Heuristico no titulo/conteudo da pergunta atual: pergunta sobre time,
// alocacao ou responsabilidade. Usado para o fallback "todos sem
// responsavel" — sem precisar queimar tokens no LLM quando o Jira nao
// tem assignees preenchidos.
const TEAM_QUESTION_KEYWORDS = [
  "responsável", "responsavel", "responsáveis", "responsaveis",
  "atribuíd", "atribuid", "assignee",
  "time", "equipe",
  "alocaç", "alocac", "carga", "sobrecarreg",
  "distribuiç", "distribuic",
  "quem está", "quem esta", "quem tem", "quem é o", "quem cuida",
];

function isTeamQuestion(text: string): boolean {
  const t = text.toLowerCase();
  return TEAM_QUESTION_KEYWORDS.some(k => t.includes(k));
}

function isUnassigned(t: BacklogItem | null | undefined): boolean {
  if (!t) return true;
  const a = t.assignee;
  return !a || String(a).trim() === "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, backlog } = await req.json() as {
      messages: IncomingMessage[];
      backlog?: BacklogItem[];
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error("Lista de mensagens vazia");
    }

    // ── Fallback server-side ────────────────────────────────────
    // Sem backlog ou com todos riceScore=0, a IA nao tem o que recomendar.
    // Devolvemos resposta canônica direto, sem queimar tokens no LLM.
    const scoredBacklog = (backlog ?? []).filter(
      t => t && Number(t.riceScore ?? 0) > 0,
    );
    if (scoredBacklog.length === 0) {
      const empty = !backlog || backlog.length === 0;
      const content = empty
        ? "Seu backlog ainda está vazio. **Conecte e importe um projeto Jira** para que eu possa ajudar a priorizar."
        : "Seu backlog foi importado, mas ainda **não foi analisado pela IA**. Clique em **Priorizar com IA** no Backlog para que eu possa recomendar prioridades, Quick Wins e riscos.";
      return new Response(JSON.stringify({
        blocks: [
          { type: "text", content },
          { type: "insight", content: "Sem scores RICE calculados, não consigo recomendar tickets específicos." },
        ],
        meta: { fallback: empty ? "empty_backlog" : "no_scored_backlog" },
      }), { headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    // ── Fallback: pergunta sobre time + nenhum assignee preenchido ──
    // Sem responsaveis no Jira, qualquer recomendacao de carga/aloca-
    // cao do time seria invencao. Resposta canonica direta.
    const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
    const userText = (lastUserMsg?.text ?? lastUserMsg?.content ?? "");
    const allUnassigned = (backlog ?? []).every(isUnassigned);
    if (
      (backlog ?? []).length > 0 &&
      allUnassigned &&
      isTeamQuestion(userText)
    ) {
      return new Response(JSON.stringify({
        blocks: [
          {
            type: "text",
            content:
              "Todos os tickets estão sem responsável no Jira. Atribua responsáveis no Jira e sincronize para ver a distribuição do time.",
          },
        ],
        meta: { fallback: "no_assignees" },
      }), { headers: { ...corsHeaders, "content-type": "application/json" } });
    }

    const backlogSummary = (backlog ?? []).slice(0, 40).map(t =>
      `${t.key} [${t.issueType ?? "?"} · ${t.priority ?? "?"}] ${t.title}` +
      ` · riceScore=${t.riceScore ?? "—"} impactScore=${t.impactScore ?? "?"} effortScore=${t.effortScore ?? "?"}` +
      ` · assignee=${t.assignee && String(t.assignee).trim() ? t.assignee : "(sem responsavel)"}` +
      (t.components?.length ? ` · components=${t.components.join(",")}` : "")
    ).join("\n");

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    // Monta as mensagens em formato OpenAI: system primeiro (com o backlog
    // anexado), depois o histórico do usuário.
    const systemContent = `${SYSTEM_PROMPT}\n\nBacklog atual:\n${backlogSummary || "(vazio)"}`;
    const conversation = messages.map(m => ({
      role: m.role === "assistant" ? "assistant" : m.role === "system" ? "system" : "user",
      content: m.text ?? m.content ?? "",
    }));

    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemContent },
          ...conversation,
        ],
        temperature: 0.4,
        max_tokens: 1500,
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) throw new Error(`Lovable AI Gateway ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "";

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
    }), { headers: { ...corsHeaders, "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
