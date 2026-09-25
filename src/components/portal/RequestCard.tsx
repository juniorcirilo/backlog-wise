import { cn } from "@/lib/utils";
import {
  BRL,
  PCT,
  RISK_LABEL,
  computeMetrics,
  resolveAuthority,
  riskClasses,
  statusClasses,
} from "@/lib/commercial-engine";
import {
  REQUEST_TYPE_LABEL,
  ROLE_LABEL,
  STATUS_LABEL,
  type CommercialRequest,
} from "@/types/commercial";
import { PackageX, Percent, Ruler } from "lucide-react";

export default function RequestCard({
  request,
  onClick,
}: {
  request: CommercialRequest;
  onClick: () => void;
}) {
  const m = computeMetrics(request);
  const a = resolveAuthority(request);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border bg-bg-elevated p-4 text-left shadow-elevation-2 transition-all hover:border-accent/40 hover:shadow-elevation-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-bg-surface-2 px-2 py-0.5 font-mono text-[11px] font-semibold text-text-secondary">
          {request.id}
        </span>
        <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-semibold", statusClasses(request.status))}>
          {STATUS_LABEL[request.status]}
        </span>
        <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-semibold", riskClasses(a.risk))}>
          {RISK_LABEL[a.risk]}
        </span>
        {request.orderHeld && (
          <span className="flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
            <PackageX className="h-3 w-3" /> Pedido retido
          </span>
        )}
      </div>

      <p className="mt-2 text-base font-bold leading-snug">{request.title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {request.customer} · {REQUEST_TYPE_LABEL[request.type]} · {request.salesRep}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Mini label="Valor líquido" value={BRL(m.net)} />
        <Mini
          label="Margem"
          value={PCT(m.marginPercent)}
          tone={m.marginPercent < 18 ? "text-destructive" : m.marginPercent < 28 ? "text-warning-foreground" : "text-success"}
          Icon={Percent}
        />
        <Mini label="Área" value={`${m.area.toFixed(0)} m²`} Icon={Ruler} />
        <Mini label="Alçada" value={ROLE_LABEL[a.level]} />
      </div>
    </button>
  );
}

function Mini({
  label,
  value,
  tone = "text-foreground",
  Icon,
}: {
  label: string;
  value: string;
  tone?: string;
  Icon?: typeof Percent;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface-1 px-3 py-2">
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </p>
      <p className={cn("mt-0.5 truncate text-sm font-bold leading-tight tabular-nums", tone)}>{value}</p>
    </div>
  );
}
