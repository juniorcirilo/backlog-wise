import { ALL_MODULES, type Company, type PortalUser, type UserCompanyAccess } from "@/types/company";

export const COMPANIES_MOCK: Company[] = [
  {
    id: "cmp-matriz",
    code: "MATRIZ",
    corporateName: "Vidros Brasil Indústria e Comércio S.A.",
    tradeName: "Vidros Brasil — Matriz",
    cnpj: "12.345.678/0001-90",
    stateRegistration: "110.042.490.114",
    isHeadquarter: true,
    kind: "fabrica",
    address: { city: "São Paulo", state: "SP", street: "Av. Industrial, 1500" },
    active: true,
  },
  {
    id: "cmp-f01",
    code: "FILIAL-01",
    corporateName: "Vidros Brasil Indústria e Comércio S.A.",
    tradeName: "Vidros Brasil — Fábrica Joinville",
    cnpj: "12.345.678/0002-71",
    stateRegistration: "254.873.216",
    isHeadquarter: false,
    kind: "fabrica",
    address: { city: "Joinville", state: "SC", street: "Rod. BR-101, km 45" },
    active: true,
  },
  {
    id: "cmp-f02",
    code: "FILIAL-02",
    corporateName: "Vidros Brasil Indústria e Comércio S.A.",
    tradeName: "Vidros Brasil — CD Recife",
    cnpj: "12.345.678/0003-52",
    stateRegistration: "0321456-78",
    isHeadquarter: false,
    kind: "distribuicao",
    address: { city: "Recife", state: "PE", street: "Av. Recife, 7800" },
    active: true,
  },
  {
    id: "cmp-f03",
    code: "FILIAL-03",
    corporateName: "Vidros Brasil Indústria e Comércio S.A.",
    tradeName: "Vidros Brasil — Escritório BH",
    cnpj: "12.345.678/0004-33",
    stateRegistration: "062.307.904.0081",
    isHeadquarter: false,
    kind: "escritorio",
    address: { city: "Belo Horizonte", state: "MG" },
    active: true,
  },
];

// Usuários de teste (exemplo). Usuários reais da plataforma também aparecem na gestão de vínculos.
export const USERS_MOCK: PortalUser[] = [
  { id: "mock-u1", name: "Carla Mendes", email: "carla.mendes@vidrosbrasil.com.br", role: "vendedor", defaultCompanyId: "cmp-f01", globalAccess: false },
  { id: "mock-u2", name: "Rafael Souza", email: "rafael.souza@vidrosbrasil.com.br", role: "gerente_comercial", defaultCompanyId: "cmp-matriz", globalAccess: false },
  { id: "mock-u3", name: "Helena Prado", email: "helena.prado@vidrosbrasil.com.br", role: "diretoria", defaultCompanyId: "cmp-matriz", globalAccess: true },
];

export const ACCESS_MOCK: UserCompanyAccess[] = [
  { userId: "mock-u1", companyId: "cmp-f01", allowedModules: ["solicitacoes", "programacao"], active: true },
  { userId: "mock-u2", companyId: "cmp-matriz", allowedModules: ALL_MODULES, active: true },
  { userId: "mock-u2", companyId: "cmp-f02", allowedModules: ALL_MODULES, active: true },
];

// Distribuição das solicitações de exemplo entre as unidades
export const REQUEST_COMPANY_MOCK: Record<string, string> = {
  "SOL-2026-001": "cmp-matriz",
  "SOL-2026-002": "cmp-f01",
  "SOL-2026-003": "cmp-f01",
  "SOL-2026-004": "cmp-f02",
  "SOL-2026-005": "cmp-matriz",
  "SOL-2026-006": "cmp-f02",
  "SOL-2026-007": "cmp-f03",
  "SOL-2026-008": "cmp-matriz",
};
