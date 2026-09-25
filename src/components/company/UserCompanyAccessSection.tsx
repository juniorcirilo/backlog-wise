import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useCompany } from "@/contexts/CompanyContext";
import { Globe2, Pencil } from "lucide-react";

interface Row {
  id: string;
  name: string;
  email: string;
  sample?: boolean;
}

export default function UserCompanyAccessSection() {
  const { companies, accesses, userCfg, mockUsers, setUserAccess } = useCompany();
  const { toast } = useToast();
  const [users, setUsers] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Row | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [global, setGlobal] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name")
      .then(({ data }) => {
        const real = (data ?? []).map(p => ({ id: p.id, name: p.full_name, email: p.email }));
        setUsers([...real, ...mockUsers.map(u => ({ id: u.id, name: u.name, email: u.email, sample: true }))]);
      });
  }, [mockUsers]);

  const linksOf = (id: string) => accesses.filter(a => a.userId === id && a.active).map(a => a.companyId);
  const nameOf = (id: string | null | undefined) => companies.find(c => c.id === id)?.code ?? "—";

  const open = (u: Row) => {
    setEditing(u);
    setSelected(linksOf(u.id));
    setDefaultId(userCfg[u.id]?.defaultCompanyId ?? null);
    setGlobal(!!userCfg[u.id]?.globalAccess);
  };

  const toggle = (id: string) =>
    setSelected(s => {
      const next = s.includes(id) ? s.filter(x => x !== id) : [...s, id];
      if (!next.includes(defaultId ?? "")) setDefaultId(next[0] ?? null);
      return next;
    });

  const save = () => {
    if (!editing) return;
    const err = setUserAccess(editing.id, selected, defaultId, global);
    if (err) {
      toast({ title: "Não foi possível salvar", description: err, variant: "destructive" });
      return;
    }
    toast({ title: "Vínculos atualizados", description: editing.name });
    setEditing(null);
  };

  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold tracking-tight">Usuários e unidades vinculadas</h2>
      <p className="text-sm text-muted-foreground mt-1">Defina em quais unidades cada colaborador atua e qual é a unidade padrão ao entrar.</p>

      <div className="mt-5 divide-y rounded-2xl border bg-card">
        {users.map(u => {
          const cfg = userCfg[u.id];
          const links = linksOf(u.id);
          return (
            <div key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {u.name}
                  {u.sample && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">exemplo</span>}
                </p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {cfg?.globalAccess ? (
                  <span className="flex items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
                    <Globe2 className="h-3 w-3" /> Todas as filiais
                  </span>
                ) : links.length ? (
                  links.map(id => (
                    <span key={id} className="rounded-md border px-2 py-0.5 text-[11px]">
                      {nameOf(id)}{cfg?.defaultCompanyId === id ? " ★" : ""}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">Sem vínculo (usa a matriz)</span>
                )}
              </div>
              <Button variant="ghost" size="sm" className="gap-1" onClick={() => open(u)}>
                <Pencil className="h-3.5 w-3.5" /> Vínculos
              </Button>
            </div>
          );
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Unidades vinculadas — {editing?.name}</DialogTitle>
          </DialogHeader>
          <label className="flex items-center gap-2 rounded-xl border bg-bg-surface-1 px-3 py-2.5 text-sm font-medium">
            <input type="checkbox" checked={global} onChange={e => setGlobal(e.target.checked)} />
            Acesso a todas as filiais (global)
          </label>
          <div className={global ? "pointer-events-none opacity-50" : ""}>
            <p className="mb-2 text-xs text-muted-foreground">Marque as unidades e escolha a padrão (★).</p>
            <ul className="divide-y rounded-xl border">
              {companies.filter(c => c.active).map(c => (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
                  <span className="flex-1">
                    <span className="font-mono text-[11px] text-muted-foreground">{c.code}</span> {c.tradeName}
                  </span>
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="radio"
                      name="default-company"
                      disabled={!selected.includes(c.id)}
                      checked={defaultId === c.id}
                      onChange={() => setDefaultId(c.id)}
                    />
                    Padrão
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save}>Salvar vínculos</Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
