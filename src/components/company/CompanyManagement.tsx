import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { COMPANY_KIND_LABEL, type Company, type CompanyKind } from "@/types/company";
import { cn } from "@/lib/utils";
import { Pencil, Plus } from "lucide-react";

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-bg-surface-1 px-2.5 text-sm outline-none focus:border-accent";

const schema = z.object({
  code: z.string().trim().min(2, "Informe o código").max(20),
  corporateName: z.string().trim().min(3, "Informe a razão social").max(150),
  tradeName: z.string().trim().min(2, "Informe o nome fantasia").max(100),
  cnpj: z.string().trim().regex(/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/, "CNPJ inválido (00.000.000/0000-00)"),
  stateRegistration: z.string().trim().max(30),
  city: z.string().trim().min(2, "Informe a cidade").max(80),
  state: z.string().trim().length(2, "UF com 2 letras"),
});

const empty = (): Company => ({
  id: "",
  code: "",
  corporateName: "",
  tradeName: "",
  cnpj: "",
  stateRegistration: "",
  isHeadquarter: false,
  kind: "fabrica",
  address: { city: "", state: "" },
  active: true,
});

export default function CompanyManagement() {
  const { companies, saveCompany, activeCompanyId } = useCompany();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Company | null>(null);

  const set = (patch: Partial<Company>) => setEditing(e => (e ? { ...e, ...patch } : e));

  const submit = () => {
    if (!editing) return;
    const r = schema.safeParse({ ...editing, city: editing.address.city, state: editing.address.state });
    if (!r.success) {
      toast({ title: "Revise o cadastro", description: r.error.issues[0]?.message, variant: "destructive" });
      return;
    }
    if (!editing.active && editing.id === activeCompanyId) {
      toast({ title: "Unidade em uso", description: "Troque a unidade ativa antes de inativá-la.", variant: "destructive" });
      return;
    }
    saveCompany({
      ...editing,
      id: editing.id || `cmp-${Date.now().toString(36)}`,
      code: r.data.code.toUpperCase(),
      address: { ...editing.address, state: r.data.state.toUpperCase() },
    });
    toast({ title: editing.id ? "Unidade atualizada" : "Unidade cadastrada", description: editing.tradeName });
    setEditing(null);
  };

  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Empresas e Filiais</h2>
          <p className="text-sm text-muted-foreground mt-1">Matriz, fábricas, centros de distribuição e escritórios comerciais.</p>
        </div>
        <Button className="gap-1.5" onClick={() => setEditing(empty())}>
          <Plus className="h-4 w-4" /> Nova unidade
        </Button>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr className="border-b">
              <th className="px-4 py-3">Unidade</th>
              <th className="px-4 py-3">CNPJ</th>
              <th className="px-4 py-3">Cidade/UF</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {companies.map(c => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{c.code}</span>
                    {c.isHeadquarter && (
                      <span className="rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">MATRIZ</span>
                    )}
                  </div>
                  <p className="font-medium">{c.tradeName}</p>
                  <p className="text-xs text-muted-foreground">{COMPANY_KIND_LABEL[c.kind]}</p>
                </td>
                <td className="px-4 py-3 tabular-nums">{c.cnpj}</td>
                <td className="px-4 py-3">{c.address.city}/{c.address.state}</td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-semibold", c.active ? "border-success/30 text-success" : "text-muted-foreground")}>
                    {c.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(c)} className="gap-1">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar unidade" : "Nova unidade"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Código"><input value={editing.code} onChange={e => set({ code: e.target.value })} placeholder="FILIAL-04" className={inputCls} /></Field>
              <Field label="Tipo">
                <select value={editing.isHeadquarter ? "matriz" : "filial"} onChange={e => set({ isHeadquarter: e.target.value === "matriz" })} className={inputCls}>
                  <option value="matriz">Matriz</option>
                  <option value="filial">Filial</option>
                </select>
              </Field>
              <Field label="Razão social" wide><input value={editing.corporateName} onChange={e => set({ corporateName: e.target.value })} className={inputCls} /></Field>
              <Field label="Nome fantasia"><input value={editing.tradeName} onChange={e => set({ tradeName: e.target.value })} className={inputCls} /></Field>
              <Field label="Atividade">
                <select value={editing.kind} onChange={e => set({ kind: e.target.value as CompanyKind })} className={inputCls}>
                  {(Object.keys(COMPANY_KIND_LABEL) as CompanyKind[]).map(k => <option key={k} value={k}>{COMPANY_KIND_LABEL[k]}</option>)}
                </select>
              </Field>
              <Field label="CNPJ"><input value={editing.cnpj} onChange={e => set({ cnpj: e.target.value })} placeholder="00.000.000/0000-00" className={inputCls} /></Field>
              <Field label="Inscrição estadual"><input value={editing.stateRegistration} onChange={e => set({ stateRegistration: e.target.value })} className={inputCls} /></Field>
              <Field label="Cidade"><input value={editing.address.city} onChange={e => set({ address: { ...editing.address, city: e.target.value } })} className={inputCls} /></Field>
              <Field label="UF"><input value={editing.address.state} maxLength={2} onChange={e => set({ address: { ...editing.address, state: e.target.value } })} className={inputCls} /></Field>
              <Field label="Status">
                <select value={editing.active ? "1" : "0"} onChange={e => set({ active: e.target.value === "1" })} className={inputCls}>
                  <option value="1">Ativo</option>
                  <option value="0">Inativo</option>
                </select>
              </Field>
            </div>
          )}
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={submit}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={cn("space-y-1", wide && "sm:col-span-2")}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
