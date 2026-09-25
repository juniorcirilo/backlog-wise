// Multiempresa: Matriz, Filiais e vínculos de usuários

export type CompanyKind = "fabrica" | "distribuicao" | "escritorio";

export interface CompanyAddress {
  city: string;
  state: string; // UF
  street?: string;
}

export interface Company {
  id: string;
  code: string; // "MATRIZ", "FILIAL-01"
  corporateName: string; // Razão Social
  tradeName: string; // Nome Fantasia
  cnpj: string;
  stateRegistration: string; // IE
  isHeadquarter: boolean;
  kind: CompanyKind;
  address: CompanyAddress;
  active: boolean;
}

export type PortalUserRole = "vendedor" | "gerente_comercial" | "gerente_financeiro" | "diretoria" | "admin";

export interface PortalUser {
  id: string;
  name: string;
  email: string;
  role: PortalUserRole;
  defaultCompanyId: string | null;
  globalAccess: boolean;
}

export type PortalModule = "cockpit" | "solicitacoes" | "matriz" | "programacao";

export interface UserCompanyAccess {
  userId: string;
  companyId: string;
  roleInCompany?: PortalUserRole;
  allowedModules: PortalModule[];
  active: boolean;
}

export const CONSOLIDATED = "all" as const;
export type ActiveCompanyId = string | typeof CONSOLIDATED;

export const COMPANY_KIND_LABEL: Record<CompanyKind, string> = {
  fabrica: "Fábrica",
  distribuicao: "Distribuição",
  escritorio: "Escritório Comercial",
};

export const PORTAL_ROLE_LABEL: Record<PortalUserRole, string> = {
  vendedor: "Vendedor",
  gerente_comercial: "Gerente Comercial",
  gerente_financeiro: "Gerente Financeiro",
  diretoria: "Diretoria",
  admin: "Administrador",
};

export const ALL_MODULES: PortalModule[] = ["cockpit", "solicitacoes", "matriz", "programacao"];
