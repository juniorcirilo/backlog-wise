import { useEffect, useState } from "react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useCommercialRequests } from "@/hooks/useCommercialRequests";
import { BRL2, itemArea, resolveAuthority } from "@/lib/commercial-engine";
import {
  APPROVER_ROLES,
  PRODUCT_LINE_LABEL,
  REQUEST_TYPE_LABEL,
  ROLE_LABEL,
  type ApproverRole,
  type CommercialRequest,
  type UserRole,
  type CommercialItem,
  type GlassProductLine,
  type RequestType,
} from "@/types/commercial";
import { Plus, Trash2 } from "lucide-react";

const itemSchema = z.object({
  line: z.string(),
  description: z.string().trim().min(3, "Descreva o item").max(120),
  thicknessMm: z.coerce.number().min(3, "Mín. 3mm").max(25, "Máx. 25mm"),
  widthMm: z.coerce.number().min(100, "Mín. 100mm").max(3300, "Máx. 3300mm"),
  heightMm: z.coerce.number().min(100, "Mín. 100mm").max(6000, "Máx. 6000mm"),
  quantity: z.coerce.number().int().min(1, "Mín. 1 peça").max(5000),
  unitPricePerM2: z.coerce.number().positive("Preço obrigatório").max(5000),
  costPerM2: z.coerce.number().positive("Custo obrigatório").max(5000),
});

const formSchema = z.object({
  type: z.string(),
  title: z.string().trim().min(5, "Título muito curto").max(120),
  customer: z.string().trim().min(2, "Informe o cliente").max(100),
  customerSegment: z.string().trim().min(2, "Informe o segmento").max(60),
  discountPercent: z.coerce.number().min(0).max(30, "Máx. 30%"),
  paymentTermDays: z.coerce.number().int().min(0).max(180),
  creditLimit: z.coerce.number().min(0),
  creditUsed: z.coerce.number().min(0),
  paymentPunctuality: z.coerce.number().min(0).max(100),
  deliveryDate: z.string().min(1, "Informe a entrega"),
  plantNotes: z.string().trim().max(500).default(""),
  justification: z.string().trim().min(10, "Justifique em pelo menos 10 caracteres").max(1000),
  items: z.array(itemSchema).min(1, "Adicione ao menos um item"),
});

type ItemDraft = {
  line: GlassProductLine;
  description: string;
  thicknessMm: string;
  widthMm: string;
  heightMm: string;
  quantity: string;
  unitPricePerM2: string;
  costPerM2: string;
};

const emptyItem = (): ItemDraft => ({
  line: "temperado_incolor",
  description: "",
  thicknessMm: "8",
  widthMm: "1000",
  heightMm: "2000",
  quantity: "1",
  unitPricePerM2: "",
  costPerM2: "",
});

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-bg-surface-1 px-2.5 text-sm outline-none focus:border-accent";

export default function NewRequestDialog({
  open,
  onOpenChange,
  salesRep,
  editing,
  editorRole = "vendedor",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesRep: string;
  editing?: CommercialRequest | null;
  editorRole?: UserRole;
}) {
  const { create, update } = useCommercialRequests();
  const [target, setTarget] = useState<ApproverRole | "auto">("auto");
  const [editNote, setEditNote] = useState("");
  const { toast } = useToast();

  const [type, setType] = useState<RequestType>("desconto_extra");
  const [title, setTitle] = useState("");
  const [customer, setCustomer] = useState("");
  const [segment, setSegment] = useState("");
  const [discount, setDiscount] = useState("0");
  const [term, setTerm] = useState("28");
  const [creditLimit, setCreditLimit] = useState("100000");
  const [creditUsed, setCreditUsed] = useState("0");
  const [punctuality, setPunctuality] = useState("90");
  const [delivery, setDelivery] = useState("");
  const [plantNotes, setPlantNotes] = useState("");
  const [justification, setJustification] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([emptyItem()]);

  useEffect(() => {
    if (!open || !editing) return;
    const e = editing;
    setType(e.type);
    setTitle(e.title);
    setCustomer(e.customer);
    setSegment(e.customerSegment);
    setDiscount(String(e.discountPercent));
    setTerm(String(e.paymentTermDays));
    setCreditLimit(String(e.creditLimit));
    setCreditUsed(String(e.creditUsed));
    setPunctuality(String(e.paymentPunctuality));
    setDelivery(e.deliveryDate.slice(0, 10));
    setPlantNotes(e.plantNotes);
    setJustification(e.justification);
    setTarget(e.assignedTo ?? "auto");
    setEditNote("");
    setItems(
      e.items.map(it => ({
        line: it.line,
        description: it.description,
        thicknessMm: String(it.thicknessMm),
        widthMm: String(it.widthMm),
        heightMm: String(it.heightMm),
        quantity: String(it.quantity),
        unitPricePerM2: String(it.unitPricePerM2),
        costPerM2: String(it.costPerM2),
      })),
    );
  }, [open, editing]);

  const setItem = (idx: number, patch: Partial<ItemDraft>) =>
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const resetForm = () => {
    setType("desconto_extra");
    setTitle("");
    setCustomer("");
    setSegment("");
    setDiscount("0");
    setTerm("28");
    setCreditLimit("100000");
    setCreditUsed("0");
    setPunctuality("90");
    setDelivery("");
    setPlantNotes("");
    setJustification("");
    setItems([emptyItem()]);
    setTarget("auto");
    setEditNote("");
  };

  const submit = () => {
    const parsed = formSchema.safeParse({
      type,
      title,
      customer,
      customerSegment: segment,
      discountPercent: discount,
      paymentTermDays: term,
      creditLimit,
      creditUsed,
      paymentPunctuality: punctuality,
      deliveryDate: delivery,
      plantNotes,
      justification,
      items,
    });

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast({
        title: "Revise o formulário",
        description: first?.message ?? "Há campos inválidos.",
        variant: "destructive",
      });
      return;
    }

    const d = parsed.data;
    const newItems: CommercialItem[] = d.items.map((it, i) => ({
      id: `i${i + 1}-${Date.now()}`,
      line: it.line as GlassProductLine,
      description: it.description,
      thicknessMm: it.thicknessMm,
      widthMm: it.widthMm,
      heightMm: it.heightMm,
      quantity: it.quantity,
      unitPricePerM2: it.unitPricePerM2,
      costPerM2: it.costPerM2,
    }));

    if (editing && editNote.trim().length < 10) {
      toast({ title: "Motivo da alteração obrigatório", description: "Descreva em pelo menos 10 caracteres o que foi alterado.", variant: "destructive" });
      return;
    }

    const payload = {
      type: d.type as RequestType,
      title: d.title,
      customer: d.customer,
      customerSegment: d.customerSegment,
      salesRep,
      discountPercent: d.discountPercent,
      paymentTermDays: d.paymentTermDays,
      creditLimit: d.creditLimit,
      creditUsed: d.creditUsed,
      paymentPunctuality: d.paymentPunctuality,
      orderHeld: false,
      deliveryDate: new Date(d.deliveryDate).toISOString(),
      plantNotes: d.plantNotes || "Sem observações da fábrica.",
      justification: d.justification,
      items: newItems,
      assignedTo: target === "auto" ? undefined : target,
    };

    if (editing) {
      update(editing.id, payload, salesRep, editorRole, editNote.trim());
      toast({ title: "Solicitação alterada", description: `${editing.id} atualizada e registrada na auditoria.` });
      onOpenChange(false);
      return;
    }

    const created = create(payload);
    toast({
      title: "Solicitação criada",
      description: `${created.id} enviada para ${ROLE_LABEL[target === "auto" ? resolveAuthority(created).level : target]}.`,
    });
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Alterar ${editing.id}` : "Nova solicitação de alçada"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Tipo</span>
            <select value={type} onChange={e => setType(e.target.value as RequestType)} className={inputCls}>
              {(Object.keys(REQUEST_TYPE_LABEL) as RequestType[]).map(t => (
                <option key={t} value={t}>{REQUEST_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Título</span>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex.: Desconto extra obra Torre Sul" className={inputCls} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Cliente</span>
            <input value={customer} onChange={e => setCustomer(e.target.value)} className={inputCls} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Segmento</span>
            <input value={segment} onChange={e => setSegment(e.target.value)} placeholder="Ex.: Construtora, Serralheria" className={inputCls} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Desconto (%)</span>
            <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} className={inputCls} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Prazo de pagamento (dias)</span>
            <input type="number" value={term} onChange={e => setTerm(e.target.value)} className={inputCls} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Limite de crédito (R$)</span>
            <input type="number" value={creditLimit} onChange={e => setCreditLimit(e.target.value)} className={inputCls} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Crédito já utilizado (R$)</span>
            <input type="number" value={creditUsed} onChange={e => setCreditUsed(e.target.value)} className={inputCls} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Pontualidade do cliente (%)</span>
            <input type="number" value={punctuality} onChange={e => setPunctuality(e.target.value)} className={inputCls} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Entrega prevista</span>
            <input type="date" value={delivery} onChange={e => setDelivery(e.target.value)} className={inputCls} />
          </label>
        </div>

        {/* Itens */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Itens do pedido</h3>
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setItems(p => [...p, emptyItem()])}>
              <Plus className="h-3.5 w-3.5" /> Adicionar item
            </Button>
          </div>
          <div className="mt-3 space-y-3">
            {items.map((it, idx) => {
              const area = itemArea({
                id: "tmp",
                line: it.line,
                description: it.description,
                thicknessMm: Number(it.thicknessMm) || 0,
                widthMm: Number(it.widthMm) || 0,
                heightMm: Number(it.heightMm) || 0,
                quantity: Number(it.quantity) || 0,
                unitPricePerM2: Number(it.unitPricePerM2) || 0,
                costPerM2: Number(it.costPerM2) || 0,
              });
              return (
                <div key={idx} className="rounded-xl border bg-bg-surface-1 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <select value={it.line} onChange={e => setItem(idx, { line: e.target.value as GlassProductLine })} className={inputCls}>
                      {(Object.keys(PRODUCT_LINE_LABEL) as GlassProductLine[]).map(l => (
                        <option key={l} value={l}>{PRODUCT_LINE_LABEL[l]}</option>
                      ))}
                    </select>
                    {items.length > 1 && (
                      <button type="button" onClick={() => setItems(p => p.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <input
                    value={it.description}
                    onChange={e => setItem(idx, { description: e.target.value })}
                    placeholder="Descrição do item (ex.: Temperado incolor 8mm lapidado)"
                    className={`${inputCls} mt-2`}
                  />
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground">Esp. (mm)</span>
                      <input type="number" value={it.thicknessMm} onChange={e => setItem(idx, { thicknessMm: e.target.value })} className={inputCls} />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground">Larg. (mm)</span>
                      <input type="number" value={it.widthMm} onChange={e => setItem(idx, { widthMm: e.target.value })} className={inputCls} />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground">Alt. (mm)</span>
                      <input type="number" value={it.heightMm} onChange={e => setItem(idx, { heightMm: e.target.value })} className={inputCls} />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground">Peças</span>
                      <input type="number" value={it.quantity} onChange={e => setItem(idx, { quantity: e.target.value })} className={inputCls} />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground">R$/m² venda</span>
                      <input type="number" value={it.unitPricePerM2} onChange={e => setItem(idx, { unitPricePerM2: e.target.value })} className={inputCls} />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-[10px] text-muted-foreground">R$/m² custo</span>
                      <input type="number" value={it.costPerM2} onChange={e => setItem(idx, { costPerM2: e.target.value })} className={inputCls} />
                    </label>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {area.toFixed(1)} m² · {area > 0 && it.unitPricePerM2 ? BRL2(area * Number(it.unitPricePerM2)) : "—"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <label className="mt-4 block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Observações da fábrica (opcional)</span>
          <Textarea value={plantNotes} onChange={e => setPlantNotes(e.target.value)} className="min-h-16" />
        </label>
        <label className="mt-3 block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Justificativa comercial (obrigatória)</span>
          <Textarea value={justification} onChange={e => setJustification(e.target.value)} placeholder="Ex.: Cliente estratégico com recorrência mensal; desconto viabiliza fechamento da obra." className="min-h-20" />
        </label>

        <label className="mt-3 block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Enviar para</span>
          <select value={target} onChange={e => setTarget(e.target.value as ApproverRole | "auto")} className={inputCls}>
            <option value="auto">Automático (pela regra de alçada)</option>
            {APPROVER_ROLES.map(r => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
        </label>
        {editing && (
          <label className="mt-3 block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Motivo da alteração (obrigatório)</span>
            <Textarea value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Ex.: Ajustado desconto para 8% conforme pedido do gerente." className="min-h-16" />
          </label>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>{editing ? "Salvar alterações" : "Enviar para aprovação"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
