import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCatalog } from "@/hooks/useCatalog";
import { Lock, Plus, Trash2 } from "lucide-react";

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-bg-surface-1 px-2.5 text-sm outline-none focus:border-accent";

function Block({ kind, title, hint }: { kind: "types" | "lines"; title: string; hint: string }) {
  const cat = useCatalog();
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const labels = kind === "types" ? cat.typeLabels : cat.lineLabels;

  const submit = () => {
    const id = cat.add(kind, value);
    if (!id) {
      toast({ title: "Nome muito curto", description: "Use pelo menos 2 caracteres.", variant: "destructive" });
      return;
    }
    toast({ title: "Cadastrado", description: value.trim() });
    setValue("");
  };

  return (
    <section className="rounded-2xl border bg-card p-5">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>
      <div className="mt-4 flex gap-2">
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="Nome do novo cadastro"
          maxLength={60}
          className={inputCls}
        />
        <Button onClick={submit} className="gap-1.5"><Plus className="h-4 w-4" /> Adicionar</Button>
      </div>
      <ul className="mt-4 divide-y rounded-xl border">
        {Object.entries(labels).map(([id, label]) => {
          const locked = cat.isDefault(kind, id);
          return (
            <li key={id} className="flex items-center gap-2 px-3 py-2">
              {locked ? (
                <span className="flex-1 text-sm">{label}</span>
              ) : (
                <input
                  defaultValue={label}
                  onBlur={e => e.target.value !== label && cat.rename(kind, id, e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none"
                />
              )}
              {locked ? (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Lock className="h-3 w-3" /> padrão</span>
              ) : (
                <button onClick={() => cat.remove(kind, id)} className="text-muted-foreground hover:text-destructive" aria-label="Remover">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function CatalogSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Cadastros</h2>
        <p className="text-sm text-muted-foreground mt-1">Tipos de solicitação e linhas de produto disponíveis no formulário.</p>
      </div>
      <Block kind="types" title="Tipos de solicitação" hint="Ex.: Desconto Extra, Bonificação de Frete." />
      <Block kind="lines" title="Itens / linhas de produto" hint="Ex.: Temperado Incolor, Vidro Acidato." />
    </div>
  );
}
