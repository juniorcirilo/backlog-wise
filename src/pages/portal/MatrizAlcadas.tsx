import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCommercialRequests } from "@/hooks/useCommercialRequests";
import RequestDrawer from "@/components/portal/RequestDrawer";
import {
  BRL,
  PCT,
  RISK_LABEL,
  computeMetrics,
  isOpen,
  resolveAuthority,
  riskClasses,
} from "@/lib/commercial-engine";
import { ROLE_LABEL, type CommercialRequest } from "@/types/commercial";
import { cn } from "@/lib/utils";

const MAX_DISCOUNT = 22;

export default function MatrizAlcadas() {
  const { user, profile } = useAuth();
  const { requests } = useCommercialRequests();
  const [selected, setSelected] = useState<CommercialRequest | null>(null);
  const userName = profile?.full_name || user?.email?.split("@")[0] || "Aprovador";

  const open = useMemo(() => requests.filter(isOpen), [requests]);
  const maxNet = Math.max(100000, ...open.map(r => computeMetrics(r).net));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-12 lg:py-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Matriz de Alçadas & Margem Crítica</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Volume do pedido (R$) contra desconto solicitado. A cor indica o risco de margem.
        </p>
      </header>

      <div className="mt-6 rounded-2xl border bg-bg-elevated p-6 shadow-elevation-2">
        <div className="flex gap-3">
          <div className="flex w-16 flex-col justify-between py-1 text-right text-[11px] text-muted-foreground">
            <span>{MAX_DISCOUNT}%</span>
            <span>12%</span>
            <span>5%</span>
            <span>0%</span>
          </div>

          <div className="relative h-[420px] flex-1 overflow-hidden rounded-xl border border-border-subtle bg-bg-surface-1">
            {/* Faixas de alçada */}
            <div className="absolute inset-x-0 top-0 h-[45.5%] bg-destructive/5" />
            <div className="absolute inset-x-0 top-[45.5%] h-[31.8%] bg-warning/5" />
            <div className="absolute inset-x-0 bottom-0 h-[22.7%] bg-success/5" />
            <div className="absolute inset-x-0 top-[45.5%] border-t border-dashed border-destructive/40" />
            <div className="absolute inset-x-0 top-[77.3%] border-t border-dashed border-warning/50" />

            <span className="absolute left-3 top-2 text-[11px] font-semibold text-destructive">Diretoria (acima de 12%)</span>
            <span className="absolute left-3 top-[47%] text-[11px] font-semibold text-warning-foreground">Financeiro (5% a 12%)</span>
            <span className="absolute left-3 bottom-2 text-[11px] font-semibold text-success">Comercial (até 5%)</span>

            {open.map(r => {
              const m = computeMetrics(r);
              const a = resolveAuthority(r);
              const x = Math.min(94, (m.net / maxNet) * 92 + 3);
              const y = Math.min(94, Math.max(2, 100 - (r.discountPercent / MAX_DISCOUNT) * 100));
              const color =
                a.risk === "critico"
                  ? "bg-destructive"
                  : a.risk === "alto"
                    ? "bg-orange-500"
                    : a.risk === "medio"
                      ? "bg-warning"
                      : "bg-success";
              return (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  title={`${r.id} · ${r.customer}`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  className={cn(
                    "absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-[10px] font-bold text-white shadow-elevation-2 transition-transform hover:scale-110",
                    color,
                  )}
                >
                  {r.id.slice(-3)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="ml-16 mt-2 flex justify-between text-[11px] text-muted-foreground">
          <span>R$ 0</span>
          <span>Volume líquido do pedido</span>
          <span>{BRL(maxNet)}</span>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {open.map(r => {
          const m = computeMetrics(r);
          const a = resolveAuthority(r);
          return (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className="rounded-xl border bg-bg-elevated p-4 text-left shadow-elevation-1 transition-colors hover:border-accent/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-semibold text-text-secondary">{r.id}</span>
                <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-semibold", riskClasses(a.risk))}>
                  {RISK_LABEL[a.risk]}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold leading-snug">{r.customer}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {BRL(m.net)} · desconto {PCT(r.discountPercent)} · margem {PCT(m.marginPercent)} · {ROLE_LABEL[a.level]}
              </p>
            </button>
          );
        })}
      </div>

      <RequestDrawer request={selected} onOpenChange={o => !o && setSelected(null)} actorName={userName} />
    </div>
  );
}
