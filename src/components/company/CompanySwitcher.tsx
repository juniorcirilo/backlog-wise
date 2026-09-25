import { useCompany } from "@/contexts/CompanyContext";
import { CONSOLIDATED } from "@/types/company";
import { Building2 } from "lucide-react";

export default function CompanySwitcher({ className = "" }: { className?: string }) {
  const { allowedCompanies, activeCompanyId, setActiveCompanyId, canConsolidate } = useCompany();

  return (
    <label className={`flex items-center gap-2 rounded-xl border border-border bg-bg-surface-1 px-3 py-1.5 ${className}`}>
      <Building2 className="h-4 w-4 flex-shrink-0 text-accent" />
      <span className="sr-only">Unidade ativa</span>
      <select
        value={activeCompanyId}
        onChange={e => setActiveCompanyId(e.target.value)}
        className="w-0 min-w-0 flex-1 truncate bg-transparent text-sm font-medium outline-none"
      >
        {canConsolidate && <option value={CONSOLIDATED}>Visão consolidada — todas as unidades</option>}
        {allowedCompanies.map(c => (
          <option key={c.id} value={c.id}>
            {c.code} · {c.tradeName}
          </option>
        ))}
      </select>
    </label>
  );
}
