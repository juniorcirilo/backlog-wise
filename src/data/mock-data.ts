// BacklogAI — mock de tickets Jira para os 3 perfis demo.
// Estrutura espelha os campos lidos do Jira: summary (title), description (body),
// issuetype, priority, status, assignee, components, labels.

export type IssueType = 'Bug' | 'Task' | 'Story' | 'Epic';
export type Priority = 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';
export type IssueStatus = 'To Do' | 'In Progress' | 'Done' | 'Blocked';

export interface Issue {
  id: string;
  key: string;                  // ex. "PLAT-58"
  title: string;                // Jira: summary
  body: string;                 // Jira: description
  issueType: IssueType;
  priority: Priority;
  status: IssueStatus;
  components: string[];
  labels: string[];
  assignee?: string;
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  riceScore: number;
  aiSummary: string;
  urgencyScore: number;
  dependencies: string[];
  suggestedSprint: number;
  createdAt: string;
}

function rice(r: number, i: number, c: number, e: number): number {
  return Math.round((r * i * (c / 100)) / e);
}

export const MOCK_ISSUES: Issue[] = [
  // ── Plataforma SaaS (Scrum software) ──────────────────
  {
    id: '12', key: 'PLAT-58',
    title: 'Taxa de conversão no onboarding caiu 12%',
    body: 'Analytics mostram queda de 12% na taxa de completude do onboarding após o último deploy.',
    issueType: 'Bug', priority: 'Highest', status: 'In Progress',
    components: ['Onboarding', 'Analytics'], labels: ['production', 'revenue-impact'],
    reach: 100, impact: 9, confidence: 85, effort: 2,
    riceScore: rice(100, 9, 85, 2),
    aiSummary: 'Impacto direto em conversão e receita. Alta confiança — bug identificado na etapa 2 do onboarding após mudança de UX. Correção rápida com retorno imediato em novos usuários ativados. Recomendo resolver antes de qualquer feature nova.',
    urgencyScore: 10, dependencies: [], suggestedSprint: 1,
    assignee: 'Pedro Mendes', createdAt: '2026-04-10',
  },
  {
    id: '3', key: 'PLAT-51',
    title: 'Crash ao exportar PDF com tabelas grandes',
    body: 'Quando o usuário exporta relatórios com mais de 500 linhas, a aplicação trava. Relatado por 38 usuários na última semana.',
    issueType: 'Bug', priority: 'High', status: 'To Do',
    components: ['Reports', 'Export'], labels: ['production', 'crash'],
    reach: 38, impact: 9, confidence: 100, effort: 3,
    riceScore: rice(38, 9, 100, 3),
    aiSummary: 'Bug crítico com impacto direto na experiência de usuário. Alta confiança no diagnóstico — problema localizado no módulo de renderização. Correção relativamente simples com alto retorno de satisfação.',
    urgencyScore: 10, dependencies: [], suggestedSprint: 1,
    assignee: 'Pedro Mendes', createdAt: '2026-04-01',
  },
  {
    id: '15', key: 'PLAT-61',
    title: 'Lentidão na listagem com mais de 100 projetos',
    body: 'Usuários com muitos projetos reportam loadings de 8-12 segundos na tela de dashboard.',
    issueType: 'Bug', priority: 'High', status: 'To Do',
    components: ['Dashboard', 'API'], labels: ['performance', 'enterprise'],
    reach: 25, impact: 8, confidence: 95, effort: 2,
    riceScore: rice(25, 8, 95, 2),
    aiSummary: 'Performance crítica para clientes enterprise. Query sem paginação e índice ausente já identificados. Correção rápida com grande impacto em satisfação de clientes de alto valor.',
    urgencyScore: 8, dependencies: [], suggestedSprint: 1,
    assignee: 'Carlos Rocha', createdAt: '2026-04-08',
  },
  {
    id: '6', key: 'PLAT-55',
    title: 'Filtro de datas no histórico de atividades',
    body: 'Adicionar filtros de período (últimos 7 dias, 30 dias, personalizado) na tela de histórico.',
    issueType: 'Task', priority: 'Medium', status: 'To Do',
    components: ['History', 'Filters'], labels: ['ux', 'sprint-42'],
    reach: 70, impact: 5, confidence: 95, effort: 2,
    riceScore: rice(70, 5, 95, 2),
    aiSummary: 'Quick win claro: baixo esforço, alta confiança, feature muito pedida em feedback de usuários. Pode ser entregue dentro de um sprint junto com outras melhorias de UX.',
    urgencyScore: 5, dependencies: [], suggestedSprint: 1,
    assignee: 'Mariana Costa', createdAt: '2026-03-28',
  },
  {
    id: '1', key: 'PLAT-42',
    title: 'Autenticação com 2FA via TOTP',
    body: 'Adicionar suporte a autenticação de dois fatores usando TOTP (Google Authenticator, Authy).',
    issueType: 'Story', priority: 'High', status: 'To Do',
    components: ['Auth', 'Security'], labels: ['enterprise', 'compliance'],
    reach: 95, impact: 9, confidence: 90, effort: 6,
    riceScore: rice(95, 9, 90, 6),
    aiSummary: 'Feature crítica de segurança altamente demandada por clientes enterprise. A ausência de 2FA é o principal motivo de churn em contas corporativas. Implementação padrão via biblioteca TOTP. Depende do refactor de auth.',
    urgencyScore: 9, dependencies: ['8'], suggestedSprint: 2,
    assignee: 'Ana Lima', createdAt: '2026-03-15',
  },
  {
    id: '7', key: 'PLAT-44',
    title: 'Modo escuro (Dark Mode)',
    body: 'Implementar dark mode completo seguindo preferências do SO e com toggle manual.',
    issueType: 'Story', priority: 'Medium', status: 'To Do',
    components: ['UI', 'Theming'], labels: ['ux', 'retention'],
    reach: 85, impact: 6, confidence: 90, effort: 4,
    riceScore: rice(85, 6, 90, 4),
    aiSummary: 'Feature de alta demanda com bom potencial de retenção. Design system já parcialmente estruturado facilita a implementação. Esforço moderado com resultado de alto apelo visual.',
    urgencyScore: 4, dependencies: [], suggestedSprint: 2,
    assignee: 'Mariana Costa', createdAt: '2026-03-05',
  },
  {
    id: '11', key: 'PLAT-39',
    title: 'Busca full-text em tickets e comentários',
    body: 'Implementar busca global com indexação full-text para encontrar tickets por palavras-chave.',
    issueType: 'Story', priority: 'Medium', status: 'To Do',
    components: ['Search'], labels: ['productivity'],
    reach: 90, impact: 7, confidence: 80, effort: 6,
    riceScore: rice(90, 7, 80, 6),
    aiSummary: 'Feature de produtividade com alto alcance. Reduz tempo de navegação e melhora descoberta de conteúdo. Moderadamente complexo — requer configuração de índice full-text (PostgreSQL FTS ou Algolia).',
    urgencyScore: 6, dependencies: [], suggestedSprint: 2,
    createdAt: '2026-02-28',
  },
  {
    id: '8', key: 'PLAT-22',
    title: 'Refatorar auth para OAuth 2.0 + PKCE',
    body: 'Modernizar o fluxo de auth para suportar OAuth 2.0 completo, PKCE e preparar para SSO.',
    issueType: 'Epic', priority: 'High', status: 'In Progress',
    components: ['Auth', 'Architecture'], labels: ['tech-debt', 'sso'],
    reach: 100, impact: 8, confidence: 70, effort: 10,
    riceScore: rice(100, 8, 70, 10),
    aiSummary: 'Refactor estratégico necessário para SSO corporativo e 2FA. Alta complexidade e dependência de outros times. ROI claro a longo prazo, mas esforço elevado e incerteza técnica considerável.',
    urgencyScore: 7, dependencies: [], suggestedSprint: 3,
    assignee: 'Ana Lima', createdAt: '2026-01-15',
  },
  {
    id: '5', key: 'PLAT-33',
    title: 'Migrar infra de polling para WebSockets',
    body: 'Substituir polling de 30s por WebSockets. Reduzirá carga no servidor e melhorará UX.',
    issueType: 'Task', priority: 'Medium', status: 'To Do',
    components: ['Infra', 'Realtime'], labels: ['tech-debt'],
    reach: 100, impact: 4, confidence: 75, effort: 9,
    riceScore: rice(100, 4, 75, 9),
    aiSummary: 'Melhoria de infraestrutura com alto esforço e incerteza técnica. Habilita outras features (dashboard real-time), mas impacto direto ao usuário é baixo. Deve ser planejado para um sprint dedicado.',
    urgencyScore: 5, dependencies: [], suggestedSprint: 3,
    createdAt: '2026-02-10',
  },
  {
    id: '13', key: 'PLAT-60',
    title: 'Internacionalização: en, es, pt-BR',
    body: 'Internacionalizar a aplicação para suportar inglês, espanhol e português do Brasil.',
    issueType: 'Epic', priority: 'Low', status: 'To Do',
    components: ['i18n'], labels: ['expansion', 'long-term'],
    reach: 50, impact: 4, confidence: 70, effort: 8,
    riceScore: rice(50, 4, 70, 8),
    aiSummary: 'Expansão geográfica estratégica para o longo prazo. Esforço elevado e requer alinhamento com design e conteúdo. Recomendado após estabilização do produto core nos mercados atuais.',
    urgencyScore: 3, dependencies: [], suggestedSprint: 4,
    createdAt: '2026-02-05',
  },

  // ── Cliente Varejo (Kanban software / agência) ────────
  {
    id: '20', key: 'AGENCY-12',
    title: 'Atrasos na publicação de conteúdos no portal do cliente',
    body: 'O fluxo de aprovação tem 4 níveis e está represando publicações urgentes. Reduzir para 2 níveis para campanhas relâmpago.',
    issueType: 'Task', priority: 'High', status: 'To Do',
    components: ['CMS', 'Workflow'], labels: ['client-blocker'],
    reach: 30, impact: 7, confidence: 85, effort: 3,
    riceScore: rice(30, 7, 85, 3),
    aiSummary: 'Bloqueio operacional do cliente. Workflow excessivo está gerando reclamações em sprints semanais. Simplificar para 2 níveis com aprovação condicional resolve sem perder governança. Esforço baixo via configuração.',
    urgencyScore: 8, dependencies: [], suggestedSprint: 1,
    assignee: 'Lucas Almeida', createdAt: '2026-04-12',
  },
  {
    id: '21', key: 'AGENCY-19',
    title: 'Redesign do portal do cliente — Sprint 2',
    body: 'Atualizar identidade visual e fluxos do portal seguindo o novo brandbook entregue em março.',
    issueType: 'Story', priority: 'Medium', status: 'In Progress',
    components: ['Portal', 'Design'], labels: ['rebrand'],
    reach: 50, impact: 6, confidence: 75, effort: 7,
    riceScore: rice(50, 6, 75, 7),
    aiSummary: 'Trabalho contratual previsto. Esforço alto mas com escopo bem definido. Pode ser quebrado em ondas (header → catálogo → checkout) para entregar valor incremental.',
    urgencyScore: 5, dependencies: [], suggestedSprint: 2,
    assignee: 'Carolina Souza', createdAt: '2026-03-20',
  },

  // ── Marketing & Growth (Business / Kanban) ────────────
  {
    id: '30', key: 'GROW-7',
    title: 'Lançamento da campanha Q2 — multicanal',
    body: 'Estratégia integrada Email + Ads + Conteúdo orgânico para o Q2. Inclui 3 lançamentos e 2 webinars.',
    issueType: 'Epic', priority: 'High', status: 'In Progress',
    components: ['Email', 'Paid Media', 'Content'], labels: ['q2-2026', 'multicanal'],
    reach: 80, impact: 7, confidence: 70, effort: 8,
    riceScore: rice(80, 7, 70, 8),
    aiSummary: 'Iniciativa cross-funcional crítica para meta trimestral. Esforço elevado distribuído entre subtarefas. Risco de slip se faltar coordenação semanal. Recomendo squad dedicado para os 60 dias iniciais.',
    urgencyScore: 8, dependencies: [], suggestedSprint: 1,
    assignee: 'Beatriz Ribeiro', createdAt: '2026-03-25',
  },
  {
    id: '31', key: 'GROW-11',
    title: 'Reformular calendário editorial mensal',
    body: 'Migrar calendário editorial para Notion com templates por canal (blog, LinkedIn, YouTube). Definir cadência semanal de revisão.',
    issueType: 'Task', priority: 'Medium', status: 'To Do',
    components: ['Content', 'Tooling'], labels: ['process'],
    reach: 15, impact: 6, confidence: 90, effort: 2,
    riceScore: rice(15, 6, 90, 2),
    aiSummary: 'Melhoria de processo interno com retorno em produtividade. Quick win de organização — equipe pequena, esforço baixo, alta confiança. Reduz retrabalho semanal.',
    urgencyScore: 4, dependencies: [], suggestedSprint: 1,
    assignee: 'Beatriz Ribeiro', createdAt: '2026-04-05',
  },

  // ── Customer Success (Kanban business) ────────────────
  {
    id: '40', key: 'CS-22',
    title: 'Dashboard de health score do cliente travando',
    body: 'O dashboard usado pelo time de CS para detectar churn está com falha intermitente desde a última sincronização do Stripe.',
    issueType: 'Bug', priority: 'High', status: 'In Progress',
    components: ['Dashboards', 'Integrations'], labels: ['cs-blocker', 'churn-risk'],
    reach: 12, impact: 9, confidence: 80, effort: 3,
    riceScore: rice(12, 9, 80, 3),
    aiSummary: 'Cega o time de CS para sinais de churn. Pequeno alcance interno mas impacto alto: cada cliente perdido tem ARR significativo. Dependência de integração Stripe sugere checar webhook + retry. Resolver nesta semana.',
    urgencyScore: 9, dependencies: [], suggestedSprint: 1,
    assignee: 'Renata Dias', createdAt: '2026-04-15',
  },

  // ── Operações de Pessoas (Business) ───────────────────
  {
    id: '50', key: 'PEOPLE-3',
    title: 'Contratar 2 engenheiros sêniores até junho',
    body: 'Abrir vagas, conduzir triagem, technical screen e onboarding de 2 engenheiros sêniores para reforçar squad de plataforma.',
    issueType: 'Task', priority: 'Medium', status: 'To Do',
    components: ['Hiring'], labels: ['headcount', 'q2-2026'],
    reach: 40, impact: 8, confidence: 60, effort: 9,
    riceScore: rice(40, 8, 60, 9),
    aiSummary: 'Iniciativa que destrava capacidade do squad de plataforma para H2. Confiança média — pipeline de candidatos sêniores está apertado. Esforço alto distribuído em 90 dias. Comece a divulgação imediatamente.',
    urgencyScore: 6, dependencies: [], suggestedSprint: 2,
    assignee: 'Helena Vargas', createdAt: '2026-03-30',
  },
];

// ── Projetos Jira disponíveis na importação ────────────
export type JiraProjectTemplate = 'Scrum software' | 'Kanban software' | 'Kanban business' | 'Business';

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  template: JiraProjectTemplate;
  description: string;
  lead?: string;
  issueCount: number;
  lastSyncedAt: string;
}

export const MOCK_JIRA_PROJECTS: JiraProject[] = [
  {
    id: 'p-plat', key: 'PLAT', name: 'Plataforma SaaS',
    template: 'Scrum software',
    description: 'Frontend e API da plataforma B2B principal',
    lead: 'Ana Lima', issueCount: 87,
    lastSyncedAt: '2026-04-23T10:12:00Z',
  },
  {
    id: 'p-agency', key: 'AGENCY', name: 'Cliente Varejo',
    template: 'Kanban software',
    description: 'Projeto contratual de redesign do portal do varejo',
    lead: 'Lucas Almeida', issueCount: 32,
    lastSyncedAt: '2026-04-22T16:00:00Z',
  },
  {
    id: 'p-grow', key: 'GROW', name: 'Marketing & Growth',
    template: 'Kanban business',
    description: 'Campanhas, conteúdo e iniciativas de aquisição',
    lead: 'Beatriz Ribeiro', issueCount: 24,
    lastSyncedAt: '2026-04-21T08:30:00Z',
  },
  {
    id: 'p-cs', key: 'CS', name: 'Customer Success',
    template: 'Kanban business',
    description: 'Saúde da base, churn e expansão de contas',
    lead: 'Renata Dias', issueCount: 19,
    lastSyncedAt: '2026-04-22T11:45:00Z',
  },
  {
    id: 'p-people', key: 'PEOPLE', name: 'Operações de Pessoas',
    template: 'Business',
    description: 'Hiring, onboarding e desenvolvimento do time',
    lead: 'Helena Vargas', issueCount: 11,
    lastSyncedAt: '2026-04-20T14:00:00Z',
  },
];

// ── Sessões e respostas mock do chat ───────────────────
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  linkedIssues?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  preview: string;
  createdAt: string;
  messages: ChatMessage[];
}

export const MOCK_SESSIONS: ChatSession[] = [
  {
    id: 'session-1',
    title: 'Análise do Sprint 1',
    preview: 'Quais tickets devemos priorizar para o Sprint 1?',
    createdAt: '2026-04-20T10:00:00Z',
    messages: [
      {
        id: 'm1', role: 'user',
        content: 'Quais são os tickets mais urgentes para o Sprint 1?',
        timestamp: '2026-04-20T10:01:00Z',
      },
      {
        id: 'm2', role: 'assistant',
        content: 'Com base na análise RICE do seu backlog, recomendo priorizar esses 3 tickets para o Sprint 1. Eles combinam alta urgência com esforço baixo — o que chamamos de **Quick Wins críticos**:\n\n**Por que esses?** A queda de conversão no onboarding (PLAT-58) está diretamente impactando receita hoje. O crash de PDF (PLAT-51) tem 38 usuários afetados com solução conhecida. A lentidão de dashboard (PLAT-61) está degradando a experiência de clientes enterprise.',
        timestamp: '2026-04-20T10:01:12Z',
        linkedIssues: ['12', '3', '15'],
      },
      {
        id: 'm3', role: 'user',
        content: 'Faz sentido incluir o 2FA nesse sprint também?',
        timestamp: '2026-04-20T10:04:00Z',
      },
      {
        id: 'm4', role: 'assistant',
        content: 'O 2FA (PLAT-42) tem RICE alto, mas **depende do refactor de auth (PLAT-22)**, que tem esforço 10. Incluir os dois no Sprint 1 sobrecarregaria a capacidade do time.\n\n**Recomendação:** coloque o refactor de auth (PLAT-22) no Sprint 2 e o 2FA (PLAT-42) logo depois, no Sprint 3. Assim você entrega os quick wins agora sem criar débito técnico.',
        timestamp: '2026-04-20T10:04:18Z',
        linkedIssues: ['1', '8'],
      },
    ],
  },
  {
    id: 'session-2',
    title: 'Bugs críticos — Semana 15',
    preview: 'Quero entender o impacto dos bugs abertos',
    createdAt: '2026-04-15T14:30:00Z',
    messages: [
      {
        id: 'm5', role: 'user',
        content: 'Quero entender o impacto dos bugs abertos no sistema.',
        timestamp: '2026-04-15T14:31:00Z',
      },
      {
        id: 'm6', role: 'assistant',
        content: 'Você tem **3 bugs abertos** com prioridade alta ou crítica. O mais grave é o crash de exportação PDF (PLAT-51) — 38 usuários afetados com confiança de 100% no diagnóstico. Recomendo resolver essa semana.',
        timestamp: '2026-04-15T14:31:20Z',
        linkedIssues: ['3', '12', '15'],
      },
    ],
  },
  {
    id: 'session-3',
    title: 'Planejamento Q2 2026',
    preview: 'Como organizar o roadmap do próximo trimestre?',
    createdAt: '2026-04-10T09:00:00Z',
    messages: [
      {
        id: 'm7', role: 'user',
        content: 'Como devo organizar o roadmap para o Q2 2026?',
        timestamp: '2026-04-10T09:01:00Z',
      },
      {
        id: 'm8', role: 'assistant',
        content: 'Para o Q2 sugiro 3 sprints com foco progressivo:\n\n**Sprint 1:** Quick wins de bugs críticos (onboarding, PDF, performance)\n**Sprint 2:** Stories de retenção (2FA, Dark Mode, busca full-text)\n**Sprint 3:** Épicos de infraestrutura (refactor de auth, WebSockets)\n\nEssa ordem maximiza o impacto visível nos primeiros 30 dias.',
        timestamp: '2026-04-10T09:01:30Z',
      },
    ],
  },
];

// ── Demo profiles ──────────────────────────────────────
export type DemoProfile = 'pm-saas' | 'tech-lead' | 'product-owner';

export function getDemoProject(profile: DemoProfile): JiraProject {
  if (profile === 'tech-lead') return MOCK_JIRA_PROJECTS[1]; // AGENCY
  if (profile === 'product-owner') return MOCK_JIRA_PROJECTS[2]; // GROW
  return MOCK_JIRA_PROJECTS[0]; // PLAT
}

export function getDemoIssues(profile: DemoProfile): Issue[] {
  if (profile === 'tech-lead') {
    return MOCK_ISSUES.filter(i => i.key.startsWith('PLAT-') || i.key.startsWith('AGENCY-'));
  }
  if (profile === 'product-owner') {
    return MOCK_ISSUES.filter(i => ['Story', 'Epic', 'Task'].includes(i.issueType));
  }
  return MOCK_ISSUES;
}

// Default project quando não está em demo mode (corresponde ao MOCK_ISSUES inteiro).
export const MOCK_PROJECT: JiraProject = MOCK_JIRA_PROJECTS[0];

// ── Atividades mock para o dashboard em modo demo ──────
export interface DemoActivity {
  id: string;
  sync_type: string;
  status: string;
  started_at: string;
}

// Sincronizações simuladas como se viessem do Jira. O `profile` é parâmetro
// para futura variação por perfil; hoje retornamos a mesma sequência.
export function getDemoActivities(_profile: DemoProfile): DemoActivity[] {
  const now = Date.now();
  const min = 60 * 1000;
  return [
    { id: 'a1', sync_type: 'jira_full_sync',     status: 'completed', started_at: new Date(now - 12 * min).toISOString() },
    { id: 'a2', sync_type: 'ai_analysis',        status: 'completed', started_at: new Date(now - 45 * min).toISOString() },
    { id: 'a3', sync_type: 'jira_incremental',   status: 'completed', started_at: new Date(now - 3 * 60 * min).toISOString() },
    { id: 'a4', sync_type: 'ai_analysis',        status: 'running',   started_at: new Date(now - 5 * min).toISOString() },
    { id: 'a5', sync_type: 'jira_full_sync',     status: 'completed', started_at: new Date(now - 24 * 60 * min).toISOString() },
  ];
}

// ── Respostas mock para o chat (modo simulado) ─────────
export const AI_RESPONSES = [
  {
    content: 'Com base no RICE score do seu backlog, os tickets com melhor relação impacto/esforço neste momento são os listados abaixo. Recomendo começar pelos bugs críticos antes de iniciar stories novas — eles têm alta confiança e esforço baixo.',
    linkedIssues: ['12', '3', '15'],
  },
  {
    content: 'Analisando as dependências do backlog, o **2FA (PLAT-42)** depende do refactor de auth (PLAT-22). Para desbloqueá-lo sem risco, sugiro resolver o refactor primeiro no próximo sprint, e só então implementar o 2FA.',
    linkedIssues: ['1', '8'],
  },
  {
    content: 'Para maximizar velocidade nesse sprint, foque nos **Quick Wins**: tickets com esforço ≤ 3 e impact ≥ 6. Eles têm o melhor RICE e podem ser entregues de forma independente, sem dependências bloqueantes.',
    linkedIssues: ['6', '3', '15'],
  },
  {
    content: 'O backlog tem **2 itens no quadrante Questionáveis** (alto esforço, baixo impacto direto). Recomendo reavaliá-los: a migração para WebSockets (PLAT-33) e o épico de i18n (PLAT-60) podem ser adiados ou quebrados em entregas menores para reduzir risco.',
    linkedIssues: ['5', '13'],
  },
];
