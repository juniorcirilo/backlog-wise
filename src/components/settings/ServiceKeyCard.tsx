import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Trash2, Plug, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import ApiKeyDialog from "./ApiKeyDialog";
import type { RegistryEntry, ServiceDefinition } from "./services";
import { cn } from "@/lib/utils";

interface Props {
  service: ServiceDefinition;
  registryEntry?: RegistryEntry;
  onChanged: () => void;
}

function StatusBadge({ entry }: { entry?: RegistryEntry }) {
  let label = "Não configurada";
  let cls = "bg-muted text-muted-foreground";
  if (entry) {
    if (entry.last_validation_status === "valid") {
      label = "Ativa";
      cls = "bg-success/15 text-success";
    } else if (entry.last_validation_status === "invalid") {
      label = "Inválida";
      cls = "bg-destructive/15 text-destructive";
    } else {
      label = "Não testada";
      cls = "bg-muted text-muted-foreground";
    }
  }
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", cls)}>
      {label}
    </span>
  );
}

export default function ServiceKeyCard({ service, registryEntry, onChanged }: Props) {
  const Icon = service.icon;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [testing, setTesting] = useState(false);

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const { error } = await supabase.functions.invoke("delete-api-key", {
        body: { service_name: service.id },
      });
      if (error) {
        toast.error("Erro ao remover a chave. Tente novamente.");
      } else {
        toast.success("Chave removida com sucesso.");
        onChanged();
      }
    } finally {
      setRemoving(false);
      setConfirmOpen(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("validate-api-key", {
        body: { service_name: service.id },
      });
      if (error || !data) {
        toast.error("Chave inválida ou serviço indisponível.");
      } else if (data.status === "valid") {
        toast.success(data.login ? `Conexão válida! (${data.login})` : "Conexão válida!");
        onChanged();
      } else {
        toast.error("Chave inválida ou serviço indisponível.");
        onChanged();
      }
    } catch {
      toast.error("Chave inválida ou serviço indisponível.");
    } finally {
      setTesting(false);
    }
  };

  const lastUpdate = registryEntry?.updated_at
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
        new Date(registryEntry.updated_at)
      )
    : null;

  return (
    <>
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent flex-shrink-0">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold">{service.name}</h3>
                <StatusBadge entry={registryEntry} />
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{service.description}</p>
              {lastUpdate && (
                <p className="text-xs text-muted-foreground mt-2">
                  Atualizada em {lastUpdate}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {!registryEntry ? (
            service.connectPath ? (
              <Button asChild size="sm">
                <Link to={service.connectPath}>
                  <Plug className="h-4 w-4" /> Configurar
                </Link>
              </Button>
            ) : (
              <Button onClick={() => setDialogOpen(true)} size="sm">
                <Plug className="h-4 w-4" /> Configurar chave
              </Button>
            )
          ) : (
            <>
              {service.connectPath ? (
                <Button asChild size="sm" variant="outline">
                  <Link to={service.connectPath}>Alterar conexão</Link>
                </Button>
              ) : (
                <Button onClick={() => setDialogOpen(true)} size="sm" variant="outline">
                  Alterar chave
                </Button>
              )}
              <Button onClick={handleTest} size="sm" variant="outline" disabled={testing}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Testar conexão
              </Button>
              <Button
                onClick={() => setConfirmOpen(true)}
                size="sm"
                variant="destructive"
                disabled={removing}
              >
                <Trash2 className="h-4 w-4" /> Remover
              </Button>
            </>
          )}
        </div>
      </Card>

      {!service.connectPath && (
        <ApiKeyDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          service={service}
          mode={registryEntry ? "edit" : "create"}
          onSaved={onChanged}
        />
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover chave do {service.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover esta chave? A integração com {service.name} será desativada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleRemove();
              }}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing && <Loader2 className="h-4 w-4 animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
