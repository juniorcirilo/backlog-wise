import { useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCommercialRequests } from "@/hooks/useCommercialRequests";
import {
  BRL,
  BRL2,
  PCT,
  RISK_LABEL,
  computeMetrics,
  itemArea,
  itemWeightKg,
  resolveAuthority,
  riskClasses,
  statusClasses,
} from "@/lib/commercial-engine";
import {
  PRODUCT_LINE_LABEL,
  REQUEST_TYPE_LABEL,
  ROLE_LABEL,
  STATUS_LABEL,
  type CommercialRequest,
} from "@/types/commercial";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Factory,
  Layers,
  ShieldAlert,
  User,
  XCircle,
} from "lucide-react";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export default function RequestDrawer({
  request,
  onOpenChange,
  actorName,
}: {
  request: CommercialRequest | null;
  onOpenChange: (open: boolean) => void;
  actorName: string;
}) {
  const { decide } = useCommercialRequests();
  const { toast } = useToast();
  const [justification, setJustification] = useState("");

  const metrics = useMemo(() => (request ? computeMetrics(request) : null), [request]);
  const authority = useMemo(() => (request ? resolveAuthority(request) : null), [request]);

  if (!request || !metrics || !authority) {
    return <Sheet open={false} onOpenChange={onOpenChange}><SheetContent /></Sheet>;
  }

  const act = (action: "aprovou" | "rejeitou" | "solicitou_ajuste") => {
    if (justification.trim().length < 10) {
      toast({
        title: "Justificativa obrigatória",
        description: "Descreva em pelo menos 10 caracteres o motivo da sua decisão.",
        variant: "destructive",
      });
      return;
    }
    decide(request.id, {
      action,
      justification: justification.trim(),
      actor: actorName,
      role: authority.level === "diretoria" ? "diretoria" : authority.level,
    });
    toast({
      title:
        action === "aprovou"
          ? "Solicitação aprovada"
          : action === "rejeitou"
            ? "Solicitação rejeitada"
            : "Ajuste solicitado",
      description: `${request.id} · ${request.customer}`,
    });
    setJustification("");
    onOpenChange(false);
  };

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-bg-surface-2 px-2 py-0.5 font-mono text-[11px] font-semibold text-text-secondary">
              {request.id}
            </span>
            <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-semibold", statusClasses(request.status))}>
              {STATUS_LABEL[request.status]}
            </span>
            <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-semibold", riskClasses(authority.risk))}>
              {RISK_LABEL[authority.risk]}
            </span>
          </div>
          <SheetTitle className="text-xl leading-snug">{request.title}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {request.customer} · {request.customerSegment} · {REQUEST_TYPE_LABEL[request.type]}
          </p>
        </SheetHeader>

        {/* Números da operação */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Valor líquido" value={BRL(metrics.net)} />
          <Metric
            label="Margem líquida"
            value={PCT(metrics.marginPercent)}
            tone={metrics.marginPercent < 18 ? "text-destructive" : metrics.marginPercent < 28 ? "text-warning-foreground" : "text-success"}
          />
          <Metric label="Área total" value={`${metrics.area.toFixed(1)} m²`} />
          <Metric label="Peso estimado" value={`${Math.round(metrics.weightKg).toLocaleString("pt-BR")} kg`} />
        </div>

        {/* Alçada */}
        <section className="mt-6 rounded-xl border bg-bg-surface-1 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldAlert className="h-4 w-4 text-accent" />
            Alçada necessária: {ROLE_LABEL[authority.level]}
          </div>
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            {authority.reasons.map(r => (
              <li key={r} className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-warning-foreground" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {authority.required.map(r => (
              <span key={r} className="rounded-md border border-border bg-bg-elevated px-2 py-0.5 text-[11px] font-medium">
                {ROLE_LABEL[r]}
              </span>
            ))}
          </div>
        </section>

        {/* Comercial e crédito */}
        <section className="mt-4 grid gap-3 sm:grid-cols-2">
          <InfoRow label="Desconto solicitado" value={PCT(request.discountPercent)} />
          <InfoRow label="Prazo de pagamento" value={`${request.paymentTermDays} dias`} />
          <InfoRow label="Preço médio praticado" value={`${BRL2(metrics.averagePricePerM2)} / m²`} />
          <InfoRow label="Custo industrial" value={BRL(metrics.cost)} />
          <InfoRow label="Limite de crédito" value={BRL(request.creditLimit)} />
          <InfoRow
            label="Exposição após o pedido"
            value={metrics.creditExposure > 0 ? `Excede ${BRL(metrics.creditExposure)}` : "Dentro do limite"}
            tone={metrics.creditExposure > 0 ? "text-destructive" : "text-success"}
          />
          <InfoRow label="Pontualidade do cliente" value={`${request.paymentPunctuality}%`} tone={request.paymentPunctuality < 75 ? "text-destructive" : undefined} />
          <InfoRow label="Entrega prevista" value={fmtDate(request.deliveryDate)} />
        </section>

        {/* Itens */}
        <section className="mt-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Layers className="h-4 w-4 text-accent" /> Itens do pedido
          </h3>
          <div className="mt-3 space-y-2">
            {request.items.map(item => (
              <div key={item.id} className="rounded-xl border bg-bg-elevated p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight">{item.description}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {PRODUCT_LINE_LABEL[item.line]} · {item.thicknessMm}mm · {item.widthMm}×{item.heightMm}mm · {item.quantity} pçs
                    </p>
                  </div>
                  <p className="flex-shrink-0 text-sm font-bold tabular-nums">
                    {BRL(itemArea(item) * item.unitPricePerM2)}
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                  <span>{itemArea(item).toFixed(1)} m²</span>
                  <span>{Math.round(itemWeightKg(item)).toLocaleString("pt-BR")} kg</span>
                  <span>{BRL2(item.unitPricePerM2)}/m²</span>
                  <span>custo {BRL2(item.costPerM2)}/m²</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Fábrica e justificativa */}
        <section className="mt-4 space-y-3">
          <div className="rounded-xl border bg-bg-surface-1 p-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Factory className="h-3.5 w-3.5" /> Observações da fábrica
            </p>
            <p className="mt-1.5 text-sm">{request.plantNotes}</p>
          </div>
          <div className="rounded-xl border bg-bg-surface-1 p-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <User className="h-3.5 w-3.5" /> Justificativa do vendedor ({request.salesRep})
            </p>
            <p className="mt-1.5 text-sm">{request.justification}</p>
          </div>
        </section>

        {/* Trilha de auditoria */}
        <section className="mt-6">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="h-4 w-4 text-accent" /> Trilha de auditoria
          </h3>
          <ol className="mt-3 space-y-3 border-l border-border pl-4">
            {request.history.map(step => (
              <li key={step.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent" />
                <p className="text-sm font-medium">
                  {step.actor} · {ROLE_LABEL[step.role]}{" "}
                  <span className="font-normal text-muted-foreground">{step.action.replace("_", " ")}</span>
                </p>
                <p className="text-xs text-muted-foreground">{fmtDate(step.at)}</p>
                <p className="mt-1 text-sm">{step.justification}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Decisão */}
        <section className="mt-6 rounded-xl border bg-bg-elevated p-4">
          <h3 className="text-sm font-semibold">Registrar decisão</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            A justificativa é obrigatória e fica registrada na trilha de auditoria.
          </p>
          <Textarea
            value={justification}
            onChange={e => setJustification(e.target.value)}
            placeholder="Ex.: Aprovado considerando recorrência do cliente e ocupação de forno no período."
            className="mt-3 min-h-24"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => act("aprovou")} className="gap-2">
              <CheckCircle2 className="h-4 w-4" /> Aprovar
            </Button>
            <Button variant="outline" onClick={() => act("solicitou_ajuste")} className="gap-2">
              <AlertTriangle className="h-4 w-4" /> Solicitar ajuste
            </Button>
            <Button variant="destructive" onClick={() => act("rejeitou")} className="gap-2">
              <XCircle className="h-4 w-4" /> Rejeitar
            </Button>
          </div>
        </section>
      </SheetContent>
    </Sheet>
  );
}

function Metric({ label, value, tone = "text-foreground" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border bg-bg-surface-1 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-lg font-bold leading-tight tabular-nums", tone)}>{value}</p>
    </div>
  );
}

function InfoRow({ label, value, tone = "text-foreground" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-bg-surface-1 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-semibold tabular-nums", tone)}>{value}</span>
    </div>
  );
}
