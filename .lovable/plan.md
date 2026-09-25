## Diagnóstico

O Assistente de IA disse "backlog vazio" mesmo com 16 tickets carregados no Backlog porque ele e o Backlog usam **caches separados** do mesmo hook `useProjectIssues`.

**Causa raiz** (`src/components/chat/FloatingChat.tsx`, linha 448):

```tsx
const { issues } = useProjectIssues();  // sem projectKey → cacheKey = "all:..."
```

Enquanto o Backlog faz:

```tsx
const { issues } = useProjectIssues(repository_id);  // cacheKey = "PDVDI"
```

São duas chaves de cache diferentes em `sessionStorage`:
- `backlogai_issues_PDVDI` (Backlog/Matriz/Cronograma)
- `backlogai_issues_all:PDVDI` (FloatingChat)

Cada uma dispara seu próprio fetch. Se o fetch do chat ainda não terminou — ou falhou silenciosamente por race com refresh de sessão — o `issues` fica `[]`, e o payload mandado para a edge function `chat` é:

```json
{ "backlog": [], "projectKey": "PDVDI" }
```

A IA recebe "Backlog atual: (vazio)" e responde corretamente que não há tickets.

## Correção (1 linha)

Em `src/components/chat/FloatingChat.tsx`, passar a chave do projeto ativo para o hook, fazendo o chat compartilhar **a mesma cacheKey** do Backlog/Matriz/Cronograma:

```tsx
const activeProject = useActiveProject();
const { issues, project } = useProjectIssues(activeProject?.key);
```

(antes: `useProjectIssues()` sem argumento)

## Resultado esperado

- O Floating Chat passa a ler do mesmo `sessionStorage.backlogai_issues_PDVDI` que o Backlog populou.
- Os tickets já estão lá no momento em que você abre o chat (cache de 5 min, hidratado pela visita ao Backlog).
- Como o `list-jira-issues` agora também devolve os scores RICE persistidos no banco (mudança aprovada na rodada anterior), o chat vai receber tickets com `riceScore`, `impact` e `effort` reais.
- A pergunta "O que devo priorizar agora?" passa a retornar uma recomendação real baseada no backlog do PDVDI.

## Arquivos afetados

- `src/components/chat/FloatingChat.tsx` (3 linhas trocadas: a ordem de declaração de `activeProject` e o argumento de `useProjectIssues`)
