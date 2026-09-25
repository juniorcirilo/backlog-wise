import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCommercialRequests } from "@/hooks/useCommercialRequests";
import RequestCard from "@/components/portal/RequestCard";
import RequestDrawer from "@/components/portal/RequestDrawer";
import {
  BRL,
  PCT,
  computeMetrics,
  isOpen,
  resolveAuthority,
} from "@/lib/commercial-engine";
import { PRODUCT_LINE_LABEL, type CommercialRequest, type GlassProductLine } from "@/types/commercial";
import { cn } from "@/lib/utils";
import { AlertTriangle, Clock3, PackageX, Wallet } from "lucide-react";

export default function Cockpit() {
  const { user, profile } = useAuth();
  const { requests } = useCommercialRequests();
  const [selected, setSelected] = useState<CommercialRequest | null>(null);

  const userName = profile?.full_name || user?.email?.split("@")[0] || "";
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  })();
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  const kpis = useMemo(() => {
    const open = requests.filter(isOpen);
    const pendingValue = open.reduce((s, r) => s + computeMetrics(r).net, 0);
    const held = open.filter(r => r.orderHeld);
    const heldValue = held.reduce((s, r) => s + computeMetrics(r).net, 0);
    const margins = open.map(r => computeMetrics(r).marginPercent);
    const avgMargin = margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;
    const critical = open.filter(r => {
      const risk = resolveAuthority(r).risk;
      return risk === "alto" || risk === "critico";
    });
    const ticket = open.length ? pendingValue / open.length : 0;
    return { open, pendingValue, held, heldValue, avgMargin, critical, ticket };
  }, [requests]);

  const byLine = useMemo(() => {
    const acc = new Map<GlassProductLine, { net: number; cost: number }>();
    requests.filter(isOpen).forEach(r => {
      const factor = 1 - r.discountPercent / 100;
      r.items.forEach(i => {
        const area = (i.widthMm / 1000) * (i.heightMm / 1000) * i.quantity;
        const cur = acc.get(i.line) ?? { net: 0, cost: 0 };
        cur.net += area * i.unitPricePerM2 * factor;
        cur.cost += area * i.costPerM2;
        acc.set(i.line, cur);
      });
    });
    return [...acc.entries()]
      .map(([line, v]) => ({
        line,
        net: v.net,
        margin: v.net > 0 ? ((v.net - v.cost) / v.net) * 100 : 0,
      }))
      .sort((a, b) => b.net - a.net);
  }, [requests]);

  const maxNet = Math.max(1, ...byLine.map(l => l.net));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-12 lg:py-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {greeting}, {userName}
        </h1>
        <p className="mt-1 text-sm capitalize text-muted-foreground">{today}</p>
        <p className="mt-2 text-sm font-medium text-text-secondary">
          {kpis.open.length} solicitações aguardando decisão · {BRL(kpis.pendingValue)} em jogo
        </p>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          Icon={Wallet}
          label="Pendente de aprovação"
          value={BRL(kpis.pendingValue)}
          sub={`${kpis.open.length} solicitações abertas`}
        />
        <Kpi
          Icon={Clock3}
          label="Tíquete médio"
          value={BRL(kpis.ticket)}
          sub="por solicitação em análise"
        />
        <Kpi
          Icon={AlertTriangle}
          label="Margem média"
          value={PCT(kpis.avgMargin)}
          sub="mínimo viável: 18%"
          tone={kpis.avgMargin < 18 ? "text-destructive" : kpis.avgMargin < 28 ? "text-warning-foreground" : "text-success"}
          iconBg={kpis.avgMargin < 18 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}
        />
        <Kpi
          Icon={PackageX}
          label="Pedidos retidos"
          value={String(kpis.held.length)}
          sub={`${BRL(kpis.heldValue)} parados na expedição`}
          tone="text-destructive"
          iconBg="bg-destructive/10 text-destructive"
        />
      </div>

      <section className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <h2 className="text-lg font-bold tracking-tight">Decisões urgentes</h2>
          <p className="text-sm text-muted-foreground">Margem crítica, desconto fora de alçada ou carga retida.</p>
          <div className="mt-4 space-y-3">
            {kpis.critical.length === 0 && (
              <p className="rounded-xl border bg-bg-surface-1 p-6 text-sm text-muted-foreground">
                Nenhuma solicitação de risco alto no momento.
              </p>
            )}
            {kpis.critical.map(r => (
              <RequestCard key={r.id} request={r} onClick={() => setSelected(r)} />
            ))}
          </div>
        </div>

        <div className="lg:col-span-2">
          <h2 className="text-lg font-bold tracking-tight">Margem por linha de produto</h2>
          <p className="text-sm text-muted-foreground">Valor líquido em análise e margem resultante.</p>
          <div className="mt-4 space-y-3 rounded-2xl border bg-bg-elevated p-4 shadow-elevation-2">
            {byLine.map(l => (
              <div key={l.line}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{PRODUCT_LINE_LABEL[l.line]}</span>
                  <span className="tabular-nums text-muted-foreground">{BRL(l.net)}</span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-bg-surface-2">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      l.margin < 18 ? "bg-destructive" : l.margin < 28 ? "bg-warning" : "bg-success",
                    )}
                    style={{ width: `${Math.max(6, (l.net / maxNet) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">margem {PCT(l.margin)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RequestDrawer
        request={selected}
        onOpenChange={o => !o && setSelected(null)}
        actorName={userName || "Aprovador"}
      />
    </div>
  );
}

function Kpi({
  Icon,
  label,
  value,
  sub,
  tone = "text-foreground",
  iconBg = "bg-bg-surface-1 text-foreground",
}: {
  Icon: typeof Wallet;
  label: string;
  value: string;
  sub: string;
  tone?: string;
  iconBg?: string;
}) {
  return (
    <div className="rounded-2xl border bg-bg-elevated p-5 shadow-elevation-2">
      <div className="flex items-center gap-2">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", iconBg)}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <p className={cn("mt-3 text-2xl font-bold leading-none tabular-nums", tone)}>{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}
