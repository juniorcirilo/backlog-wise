import { Info, RotateCcw, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useDemo, type DemoProfile } from "@/contexts/DemoContext";

const PROFILES: { id: DemoProfile; label: string; description: string }[] = [
  {
    id: "pm-saas",
    label: "PM de SaaS",
    description: "Backlog de produto SaaS com issues balanceadas entre bugs, features e melhorias.",
  },
  {
    id: "tech-lead",
    label: "Tech Lead de Agência",
    description: "Mesmos tickets em um projeto Jira de cliente (Cliente Varejo).",
  },
  {
    id: "product-owner",
    label: "Dono de Produto",
    description: "Visão estratégica com foco em features, melhorias e documentação de roadmap.",
  },
];

export default function DemoSection() {
  const { isDemoMode, demoProfile, setDemoMode, setDemoProfile, resetDemo } = useDemo();

  const handleToggleDemo = (v: boolean) => {
    setDemoMode(v);
    if (v) {
      toast.success("Modo demonstração ativado", {
        description: "Explore o Dashboard, Backlog e Matriz com dados simulados.",
      });
    } else {
      toast("Modo demonstração desativado");
    }
  };

  const handleProfileChange = (p: DemoProfile) => {
    if (p === demoProfile) return;
    setDemoProfile(p);
    const label = PROFILES.find(x => x.id === p)?.label ?? p;
    toast(`Perfil alterado para ${label}`);
  };

  const handleReset = () => {
    resetDemo();
    toast("Configurações de demo restauradas");
  };

  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight">Demonstração</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Configure o modo de apresentação da plataforma com dados simulados.
      </p>

      {/* Explanatory notice */}
      <div className="mt-5 flex gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-4">
        <Info className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          O modo demonstração permite apresentar a plataforma com dados simulados realistas,
          sem precisar conectar um projeto Jira real.
        </p>
      </div>

      {/* Toggle */}
      <div className="mt-5 rounded-2xl border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor="demo-toggle" className="text-sm font-semibold cursor-pointer">
              Ativar modo demonstração
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Substitui os dados reais pelos dados de demonstração em todo o sistema.
            </p>
          </div>
          <Switch
            id="demo-toggle"
            checked={isDemoMode}
            onCheckedChange={handleToggleDemo}
          />
        </div>

        {isDemoMode && (
          <div className="mt-4 pt-4 border-t flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Veja a plataforma preenchida com dados simulados.
            </p>
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/dashboard">
                Ir para o Dashboard
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Profile selector */}
      <div
        className={cn(
          "mt-4 rounded-2xl border bg-card p-5 transition-opacity duration-200",
          !isDemoMode && "opacity-40 pointer-events-none"
        )}
      >
        <p className="text-sm font-semibold">Perfil de demonstração</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Cada perfil apresenta um contexto diferente durante a apresentação.
        </p>
        <div className="mt-4 grid gap-2">
          {PROFILES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleProfileChange(p.id)}
              className={cn(
                "w-full text-left rounded-xl border px-4 py-3 transition-colors",
                demoProfile === p.id
                  ? "border-accent bg-accent/5"
                  : "border-border hover:border-accent/40 hover:bg-muted/30"
              )}
            >
              <p
                className={cn(
                  "text-sm font-semibold",
                  demoProfile === p.id ? "text-accent" : "text-foreground"
                )}
              >
                {p.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Reset */}
      <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-destructive/20 bg-destructive/5 px-5 py-4">
        <div>
          <p className="text-sm font-semibold">Resetar dados demo</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Desativa o modo demo e restaura as configurações iniciais.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
          onClick={handleReset}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Resetar
        </Button>
      </div>
    </section>
  );
}
