import { KanbanSquare, type LucideIcon } from "lucide-react";

// Vault de chaves do BacklogAI.
//
// Para serviços com credenciais simples (1 campo), o card abre o
// `ApiKeyDialog` inline. Para credenciais multi-campo (Jira: domain +
// email + token), use `connectPath` para direcionar a uma página
// dedicada — a edge function `store-api-key` aceita `metadata` jsonb
// para os campos não-secretos.

export interface ServiceDefinition {
  id: string;
  name: string;
  description: string;
  placeholder: string;
  docsUrl: string;
  icon: LucideIcon;
  /** Rota dedicada para credenciais multi-campo. Se presente, o card linka pra cá em vez de abrir o ApiKeyDialog. */
  connectPath?: string;
}

export const SUPPORTED_SERVICES: ServiceDefinition[] = [
  {
    id: "jira",
    name: "Jira",
    description: "Importação de tickets do Jira (Scrum, Kanban ou Business) por API token.",
    placeholder: "ATATT3xFfGF0...",
    docsUrl: "https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/",
    icon: KanbanSquare,
    connectPath: "/conectar-jira",
  },
];

export interface RegistryEntry {
  id: string;
  service_name: string;
  label: string | null;
  is_active: boolean;
  last_validated_at: string | null;
  last_validation_status: "valid" | "invalid" | "untested";
  updated_at: string;
}
