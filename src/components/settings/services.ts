import { Factory, type LucideIcon } from "lucide-react";

// Vault de chaves de integração do portal.
// Serviços com credencial simples abrem o `ApiKeyDialog` inline.

export interface ServiceDefinition {
  id: string;
  name: string;
  description: string;
  placeholder: string;
  docsUrl: string;
  icon: LucideIcon;
  /** Rota dedicada para credenciais multi-campo. */
  connectPath?: string;
}

export const SUPPORTED_SERVICES: ServiceDefinition[] = [
  {
    id: "erp",
    name: "ERP Industrial",
    description: "Chave de integração para importar pedidos, tabelas de preço e limites de crédito.",
    placeholder: "erp_live_...",
    docsUrl: "https://docs.lovable.dev",
    icon: Factory,
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
