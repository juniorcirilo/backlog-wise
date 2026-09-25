import type {
  ApprovalStatus,
  CommercialItem,
  CommercialRequest,
  UserRole,
} from "@/types/commercial";

export const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const BRL2 = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

export const PCT = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;

/** Área total em m² da linha do pedido. */
export function itemArea(item: CommercialItem): number {
  return (item.widthMm / 1000) * (item.heightMm / 1000) * item.quantity;
}

/** Peso estimado: vidro ~2,5 kg por m² por mm de espessura. */
export function itemWeightKg(item: CommercialItem): number {
  return itemArea(item) * item.thicknessMm * 2.5;
}

export function itemGross(item: CommercialItem): number {
  return itemArea(item) * item.unitPricePerM2;
}

export function itemCost(item: CommercialItem): number {
  return itemArea(item) * item.costPerM2;
}

export interface RequestMetrics {
  area: number;
  weightKg: number;
  gross: number;
  net: number;
  cost: number;
  marginValue: number;
  marginPercent: number;
  creditExposure: number;
  averagePricePerM2: number;
}

export function computeMetrics(req: CommercialRequest): RequestMetrics {
  const area = req.items.reduce((s, i) => s + itemArea(i), 0);
  const weightKg = req.items.reduce((s, i) => s + itemWeightKg(i), 0);
  const gross = req.items.reduce((s, i) => s + itemGross(i), 0);
  const cost = req.items.reduce((s, i) => s + itemCost(i), 0);
  const net = gross * (1 - req.discountPercent / 100);
  const marginValue = net - cost;
  const marginPercent = net > 0 ? (marginValue / net) * 100 : 0;
  return {
    area,
    weightKg,
    gross,
    net,
    cost,
    marginValue,
    marginPercent,
    creditExposure: req.creditUsed + net - req.creditLimit,
    averagePricePerM2: area > 0 ? net / area : 0,
  };
}

export type RiskLevel = "baixo" | "medio" | "alto" | "critico";

export interface AuthorityDecision {
  required: UserRole[];
  level: "gerente_comercial" | "gerente_financeiro" | "diretoria";
  risk: RiskLevel;
  reasons: string[];
}

/**
 * Motor de alçadas:
 *  - desconto ≤ 5% e margem > 28% .......... Gerente Comercial
 *  - desconto 5–12%, prazo > 45d ou crédito. Comercial + Financeiro
 *  - desconto > 12%, pedido retido > R$ 50k
 *    ou margem < 18% ....................... Diretoria
 */
export function resolveAuthority(req: CommercialRequest): AuthorityDecision {
  const m = computeMetrics(req);
  const reasons: string[] = [];
  let level: AuthorityDecision["level"] = "gerente_comercial";

  if (req.discountPercent > 12) {
    reasons.push(`Desconto de ${PCT(req.discountPercent)} acima do teto comercial de 12%`);
    level = "diretoria";
  } else if (req.discountPercent > 5) {
    reasons.push(`Desconto de ${PCT(req.discountPercent)} na faixa financeira (5% a 12%)`);
    level = "gerente_financeiro";
  } else {
    reasons.push(`Desconto de ${PCT(req.discountPercent)} dentro da alçada comercial`);
  }

  if (m.marginPercent < 18) {
    reasons.push(`Margem líquida de ${PCT(m.marginPercent)} abaixo do mínimo viável de 18%`);
    level = "diretoria";
  } else if (m.marginPercent <= 28 && level === "gerente_comercial") {
    reasons.push(`Margem de ${PCT(m.marginPercent)} não atinge os 28% da alçada comercial`);
    level = "gerente_financeiro";
  }

  if (req.orderHeld && m.net > 50000) {
    reasons.push(`Pedido retido de ${BRL(m.net)} acima de R$ 50.000`);
    level = "diretoria";
  }

  if (req.type === "credito_emergencial" || req.paymentTermDays > 45) {
    reasons.push(
      req.type === "credito_emergencial"
        ? "Liberação de crédito exige aval financeiro"
        : `Prazo de ${req.paymentTermDays} dias acima do padrão de 45 dias`,
    );
    if (level === "gerente_comercial") level = "gerente_financeiro";
  }

  if (m.creditExposure > 0) {
    reasons.push(`Excede o limite de crédito em ${BRL(m.creditExposure)}`);
    if (level === "gerente_comercial") level = "gerente_financeiro";
  }

  const required: UserRole[] =
    level === "diretoria"
      ? ["gerente_comercial", "gerente_financeiro", "diretoria"]
      : level === "gerente_financeiro"
        ? ["gerente_comercial", "gerente_financeiro"]
        : ["gerente_comercial"];

  const risk: RiskLevel =
    m.marginPercent < 12 || req.discountPercent > 18
      ? "critico"
      : level === "diretoria"
        ? "alto"
        : level === "gerente_financeiro"
          ? "medio"
          : "baixo";

  return { required, level, risk, reasons };
}

export const RISK_LABEL: Record<RiskLevel, string> = {
  baixo: "Risco baixo",
  medio: "Risco moderado",
  alto: "Risco alto",
  critico: "Risco crítico",
};

export function riskClasses(risk: RiskLevel): string {
  switch (risk) {
    case "critico":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "alto":
      return "bg-orange-500/10 text-orange-500 border-orange-500/30";
    case "medio":
      return "bg-warning/15 text-warning-foreground border-warning/30";
    default:
      return "bg-success/10 text-success border-success/30";
  }
}

export function statusClasses(status: ApprovalStatus): string {
  switch (status) {
    case "aprovado":
      return "bg-success/10 text-success border-success/30";
    case "rejeitado":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "ajuste_solicitado":
      return "bg-warning/15 text-warning-foreground border-warning/30";
    case "analise_diretoria":
      return "bg-orange-500/10 text-orange-500 border-orange-500/30";
    case "analise_financeira":
      return "bg-accent/10 text-accent border-accent/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

/** Status inicial de fila conforme a alçada exigida. */
export function statusForRole(role: "gerente_comercial" | "gerente_financeiro" | "diretoria"): ApprovalStatus {
  return role === "diretoria" ? "analise_diretoria" : role === "gerente_financeiro" ? "analise_financeira" : "analise_comercial";
}

export function queueStatus(req: CommercialRequest): ApprovalStatus {
  if (req.assignedTo) return statusForRole(req.assignedTo);
  const { level } = resolveAuthority(req);
  if (level === "diretoria") return "analise_diretoria";
  if (level === "gerente_financeiro") return "analise_financeira";
  return "analise_comercial";
}

export const OPEN_STATUSES: ApprovalStatus[] = [
  "analise_comercial",
  "analise_financeira",
  "analise_diretoria",
  "ajuste_solicitado",
];

export function isOpen(req: CommercialRequest) {
  return OPEN_STATUSES.includes(req.status);
}
