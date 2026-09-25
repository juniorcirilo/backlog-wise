import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useCommercialRequests } from "@/hooks/useCommercialRequests";
import RequestCard from "@/components/portal/RequestCard";
import RequestDrawer from "@/components/portal/RequestDrawer";
import NewRequestDialog from "@/components/portal/NewRequestDialog";
import { Button } from "@/components/ui/button";
import { BRL, computeMetrics, isOpen, resolveAuthority } from "@/lib/commercial-engine";
import {
  PRODUCT_LINE_LABEL,
  REQUEST_TYPE_LABEL,
  type CommercialRequest,
  type GlassProductLine,
  type RequestType,
} from "@/types/commercial";
import { cn } from "@/lib/utils";
import { Plus, Search } from "lucide-react";

type Filter = "abertas" | "diretoria" | "financeira" | "comercial" | "finalizadas" | "todas";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "abertas", label: "Em aberto" },
  { id: "comercial", label: "Alçada comercial" },
  { id: "financeira", label: "Alçada financeira" },
  { id: "diretoria", label: "Alçada diretoria" },
  { id: "finalizadas", label: "Finalizadas" },
  { id: "todas", label: "Todas" },
];

export default function Solicitacoes() {
  const { user, profile } = useAuth();
  const { requests } = useCommercialRequests();
  const [filter, setFilter] = useState<Filter>("abertas");
  const [line, setLine] = useState<GlassProductLine | "todas">("todas");
  const [type, setType] = useState<RequestType | "todos">("todos");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CommercialRequest | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const userName = profile?.full_name || user?.email?.split("@")[0] || "Aprovador";

  const list = useMemo(() => {
    return requests.filter(r => {
      const level = resolveAuthority(r).level;
      if (filter === "abertas" && !isOpen(r)) return false;
      if (filter === "finalizadas" && isOpen(r)) return false;
      if (filter === "comercial" && !(isOpen(r) && level === "gerente_comercial")) return false;
      if (filter === "financeira" && !(isOpen(r) && level === "gerente_financeiro")) return false;
      if (filter === "diretoria" && !(isOpen(r) && level === "diretoria")) return false;
      if (line !== "todas" && !r.items.some(i => i.line === line)) return false;
      if (type !== "todos" && r.type !== type) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        const hay = `${r.id} ${r.title} ${r.customer} ${r.salesRep}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [requests, filter, line, type, query]);

  const total = list.reduce((s, r) => s + computeMetrics(r).net, 0);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-12 lg:py-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Solicitações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {list.length} solicitações · {BRL(total)} em valor líquido
        </p>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              filter === f.id
                ? "border-accent bg-accent text-white"
                : "border-border bg-bg-surface-1 text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por cliente, número ou vendedor"
            className="h-10 w-full rounded-xl border border-border bg-bg-surface-1 pl-9 pr-3 text-sm outline-none focus:border-accent"
          />
        </div>
        <select
          value={line}
          onChange={e => setLine(e.target.value as GlassProductLine | "todas")}
          className="h-10 rounded-xl border border-border bg-bg-surface-1 px-3 text-sm outline-none focus:border-accent"
        >
          <option value="todas">Todas as linhas</option>
          {(Object.keys(PRODUCT_LINE_LABEL) as GlassProductLine[]).map(l => (
            <option key={l} value={l}>{PRODUCT_LINE_LABEL[l]}</option>
          ))}
        </select>
        <select
          value={type}
          onChange={e => setType(e.target.value as RequestType | "todos")}
          className="h-10 rounded-xl border border-border bg-bg-surface-1 px-3 text-sm outline-none focus:border-accent"
        >
          <option value="todos">Todos os tipos</option>
          {(Object.keys(REQUEST_TYPE_LABEL) as RequestType[]).map(t => (
            <option key={t} value={t}>{REQUEST_TYPE_LABEL[t]}</option>
          ))}
        </select>
      </div>

      <div className="mt-6 space-y-3">
        {list.length === 0 && (
          <p className="rounded-xl border bg-bg-surface-1 p-8 text-center text-sm text-muted-foreground">
            Nenhuma solicitação encontrada com esses filtros.
          </p>
        )}
        {list.map(r => (
          <RequestCard key={r.id} request={r} onClick={() => setSelected(r)} />
        ))}
      </div>

      <RequestDrawer request={selected} onOpenChange={o => !o && setSelected(null)} actorName={userName} />
    </div>
  );
}
