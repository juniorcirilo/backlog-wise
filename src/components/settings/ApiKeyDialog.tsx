import { useState } from "react";
import { Eye, EyeOff, Loader2, ExternalLink } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import type { ServiceDefinition } from "./services";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  service: ServiceDefinition;
  mode: "create" | "edit";
  onSaved: () => void;
}

const schema = z.object({
  value: z.string().trim().min(20, "A chave deve ter pelo menos 20 caracteres."),
});

export default function ApiKeyDialog({ open, onOpenChange, service, mode, onSaved }: Props) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setValue("");
    setShow(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ value });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Valor inválido");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("store-api-key", {
        body: { service_name: service.id, value: parsed.data.value, label: service.name },
      });
      // Limpa imediatamente, independente do resultado
      reset();
      if (error) {
        toast.error("Erro ao salvar a chave. Tente novamente.");
      } else {
        toast.success("Chave salva com sucesso!");
        onOpenChange(false);
        onSaved();
      }
    } catch {
      reset();
      toast.error("Erro ao salvar a chave. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md max-sm:h-[100dvh] max-sm:max-w-full max-sm:rounded-none">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Alterar" : "Configurar"} {service.name}
          </DialogTitle>
          <DialogDescription>
            Insira sua chave de API para habilitar a integração com {service.name}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key-value">Chave de API</Label>
            <div className="relative">
              <Input
                id="api-key-value"
                type={show ? "text" : "password"}
                placeholder={service.placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                aria-label={show ? "Ocultar chave" : "Mostrar chave"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <a
              href={service.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
            >
              Como obter esta chave? <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
