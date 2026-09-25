# BacklogAI — Priorização de Backlog com IA

Plataforma SaaS que conecta ao Jira, importa tickets de qualquer tipo de projeto (Scrum, Kanban ou Business) e usa IA para pontuar impacto, esforço e urgência (RICE), gerando um roadmap priorizado.

Stack: React 18 + Vite + TypeScript + Tailwind + Lovable Cloud (Supabase).

---

## ⚠️ Após fazer remix deste projeto

Este projeto usa **triggers no schema `auth.users`** que o Lovable **não replica automaticamente** quando você faz remix. Sem eles, novos cadastros quebram: o usuário é criado em `auth.users`, mas nada aparece em `public.profiles` (e o app trata como "perfil não encontrado").

### Auto-reparo (camada automática)

Na primeira vez que o app carrega após o remix, o frontend chama a Edge Function [`ensure-auth-trigger`](supabase/functions/ensure-auth-trigger/index.ts), que detecta a ausência dos triggers e os recria via RPC SECURITY DEFINER. Você não precisa fazer nada — basta abrir o app uma vez.

Se algo der errado, você verá um toast de aviso ("Atenção: setup de auth") e um log `[Auth Setup]` no console.

### Fix manual (se o auto-reparo falhar)

1. Abra **Lovable Cloud → SQL Editor** (role `postgres`).
2. Cole e execute o conteúdo do arquivo de migration mais recente:
   - [`supabase/migrations/*_auth_profile_sync.sql`](supabase/migrations/) — recria `handle_new_user`, `check_email_domain` e os triggers.
3. Teste cadastrando um novo usuário em `/login`.

O SQL é **idempotente** (`DROP IF EXISTS` + `CREATE OR REPLACE`), então pode rodar quantas vezes quiser.

---

## Modelo de auth e roles

- **Tabela `profiles`**: dados públicos do usuário (full_name, email, avatar, status, is_active, is_approved).
- **Tabela `user_roles`** (separada por segurança): enum `app_role` com `admin`, `supervisor`, `agent`.
- **Função `has_role(user, role)`** SECURITY DEFINER: usada nas RLS policies para evitar recursão.
- **Aprovação manual ligada por padrão** (`require_account_approval = true`): o **primeiro usuário** vira admin auto-aprovado; demais ficam em `/pending-approval` até um admin aprovar em `/team`.
- **Restrição por domínio** (opcional): configurável em `/settings/security`. Validada em duas camadas — Edge Function `validate-signup` (UX) e trigger `check_email_domain` (segurança).

## Edge Functions

| Função | Para quê |
|---|---|
| `validate-signup` | Pré-validação de domínio antes do `signUp` (UX) |
| `check-user-active` | Verifica is_active/is_approved a cada sessão; força logout se inativo |
| `ensure-auth-trigger` | Auto-reparo dos triggers `auth.users` após remix |

## Desenvolvimento local

```sh
npm install
npm run dev
```

O `.env` é gerenciado pelo Lovable e contém `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`.
