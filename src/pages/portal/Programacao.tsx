import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCommercialRequests } from "@/hooks/useCommercialRequests";
import RequestDrawer from "@/components/portal/RequestDrawer";
import { BRL, computeMetrics, isOpen, statusClasses } from "@/lib/commercial-engine";
import { STATUS_LABEL, type CommercialRequest } from "@/types/commercial";
import { cn } from "@/lib/utils";
import { CalendarDays, PackageX, Truck } from "lucide-react";

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

const daysUntil = (iso: string) =>
  Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);

export default function Programacao() {
  const { user, profile } = useAuth();
  const { requests } = useCommercialRequests();
  const [selected, setSelected] = useState<CommercialRequest | null>(null);
  const userName = profile?.full_name || user?.email?.split("@")[0] || "Aprovador";

  const sorted = useMemo(
    () => [...requests].sort((a, b) => +new Date(a.deliveryDate) - +new Date(b.deliveryDate)),
    [requests],
  );
  const held = sorted.filter(r => r.orderHeld && isOpen(r));
  const heldValue = held.reduce((s, r) => s + computeMetrics(r).net, 0);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-12 lg:py-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Programação & Pedidos Retidos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sequência de entrega da fábrica e cargas travadas aguardando aprovação.
        </p>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card Icon={PackageX} label="Cargas retidas" value={String(held.length)} sub="aguardando liberação" tone="text-destructive" />
        <Card Icon={Truck} label="Valor travado" value={BRL(heldValue)} sub="parado na expedição" tone="text-destructive" />
        <Card Icon={CalendarDays} label="Entregas programadas" value={String(sorted.length)} sub="nos próximos 30 dias" />
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-bold tracking-tight">Linha do tempo de entrega</h2>
        <ol className="mt-4 space-y-3 border-l border-border pl-5">
          {sorted.map(r => {
            const m = computeMetrics(r);
            const d = daysUntil(r.deliveryDate);
            return (
              <li key={r.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[26px] top-4 h-3 w-3 rounded-full border-2 border-background",
                    r.orderHeld && isOpen(r) ? "bg-destructive" : "bg-accent",
                  )}
                />
                <button
                  onClick={() => setSelected(r)}
                  className="w-full rounded-xl border bg-bg-elevated p-4 text-left shadow-elevation-1 transition-colors hover:border-accent/40"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold text-text-secondary">{r.id}</span>
                    <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-semibold", statusClasses(r.status))}>
                      {STATUS_LABEL[r.status]}
                    </span>
                    {r.orderHeld && isOpen(r) && (
                      <span className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                        Retido na expedição
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm font-semibold">{r.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {r.customer} · entrega {fmt(r.deliveryDate)} ({d >= 0 ? `em ${d} dias` : `${Math.abs(d)} dias em atraso`}) · {BRL(m.net)} · {m.area.toFixed(0)} m²
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{r.plantNotes}</p>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <RequestDrawer request={selected} onOpenChange={o => !o && setSelected(null)} actorName={userName} />
    </div>
  );
}

function Card({
  Icon,
  label,
  value,
  sub,
  tone = "text-foreground",
}: {
  Icon: typeof Truck;
  label: string;
  value: string;
  sub: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border bg-bg-elevated p-5 shadow-elevation-2">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg-surface-1">
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <p className={cn("mt-3 text-2xl font-bold tabular-nums", tone)}>{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
