// Domínio do Portal de Alçadas Comerciais & Financeiras — Indústria Vidreira

export type RequestType =
  | "desconto_extra"
  | "tabela_condicao_especial"
  | "devolucao_avaria"
  | "credito_emergencial"
  | "garantia_bonificacao";

export type GlassProductLine =
  | "temperado_incolor"
  | "temperado_colorido"
  | "laminado_comum"
  | "laminado_temperado"
  | "espelho_prata"
  | "insulado_termoacustico"
  | "box_padrao";

export type ApprovalStatus =
  | "rascunho"
  | "analise_comercial"
  | "analise_financeira"
  | "analise_diretoria"
  | "aprovado"
  | "rejeitado"
  | "ajuste_solicitado";

export type UserRole =
  | "vendedor"
  | "gerente_comercial"
  | "gerente_financeiro"
  | "diretoria";

export interface ApprovalStep {
  id: string;
  role: UserRole;
  actor: string;
  action: "criou" | "aprovou" | "rejeitou" | "solicitou_ajuste" | "encaminhou";
  justification: string;
  at: string; // ISO
}

export interface CommercialItem {
  id: string;
  line: GlassProductLine;
  description: string;
  thicknessMm: number;
  widthMm: number;
  heightMm: number;
  quantity: number;
  unitPricePerM2: number; // R$/m² praticado
  costPerM2: number; // custo industrial R$/m² (forno, insumo, quebra)
}

export interface CommercialRequest {
  id: string; // SOL-2026-001
  type: RequestType;
  title: string;
  customer: string;
  customerSegment: string;
  salesRep: string;
  createdAt: string;
  status: ApprovalStatus;
  discountPercent: number;
  paymentTermDays: number;
  creditLimit: number;
  creditUsed: number;
  paymentPunctuality: number; // 0-100
  orderHeld: boolean;
  deliveryDate: string;
  plantNotes: string;
  justification: string;
  items: CommercialItem[];
  history: ApprovalStep[];
}

export const PRODUCT_LINE_LABEL: Record<GlassProductLine, string> = {
  temperado_incolor: "Temperado Incolor",
  temperado_colorido: "Temperado Colorido",
  laminado_comum: "Laminado Comum",
  laminado_temperado: "Laminado Temperado",
  espelho_prata: "Espelho Prata",
  insulado_termoacustico: "Insulado Termoacústico",
  box_padrao: "Linha Box Padrão",
};

export const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  desconto_extra: "Desconto Extra",
  tabela_condicao_especial: "Tabela / Condição Especial",
  devolucao_avaria: "Devolução / Avaria",
  credito_emergencial: "Crédito Emergencial",
  garantia_bonificacao: "Garantia / Bonificação",
};

export const STATUS_LABEL: Record<ApprovalStatus, string> = {
  rascunho: "Rascunho",
  analise_comercial: "Análise Comercial",
  analise_financeira: "Análise Financeira",
  analise_diretoria: "Análise Diretoria",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
  ajuste_solicitado: "Ajuste Solicitado",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  vendedor: "Vendedor",
  gerente_comercial: "Gerente Comercial",
  gerente_financeiro: "Gerente Financeiro",
  diretoria: "Diretoria",
};
