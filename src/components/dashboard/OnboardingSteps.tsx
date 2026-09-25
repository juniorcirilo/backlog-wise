import { KanbanSquare, LayoutGrid, Sparkles, CheckCircle2, ArrowRight, Lock, LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import ScrollReveal from "@/components/lp/ScrollReveal";

type StepStatus = "done" | "active" | "blocked";

interface StepProps {
  index: number;
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref?: string;
  ctaDisabled?: boolean;
  /** Botao opcional ao lado do CTA principal — ex.: escape-hatch
   *  "Ir para meus projetos" para admins que ja importaram antes. */
  secondaryCta?: { label: string; href: string };
  status: StepStatus;
  isLast?: boolean;
}

function Step({ index, icon: Icon, title, description, ctaLabel, ctaHref, secondaryCta, status, isLast }: StepProps) {
  const isDone = status === "done";
  const isActive = status === "active";
  const isBlocked = status === "blocked";

  const cardClasses = [
    "relative rounded-2xl border p-5 sm:p-6 transition-all",
    isDone && "border-success/30 bg-success/5",
    isActive && "border-accent bg-card shadow-[0_0_0_4px_hsl(var(--accent)/0.1)]",
    isBlocked && "border-border bg-card opacity-50",
  ]
    .filter(Boolean)
    .join(" ");

  const iconWrapClasses = [
    "flex h-12 w-12 items-center justify-center rounded-xl flex-shrink-0",
    isDone && "bg-success/15 text-success",
    isActive && "bg-accent/15 text-accent",
    isBlocked && "bg-muted text-muted-foreground",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="relative flex gap-4">
      {/* Linha de progresso vertical (à esquerda do índice) */}
      <div className="flex flex-col items-center">
        <div
          className={[
            "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold border-2 flex-shrink-0",
            isDone && "border-success bg-success text-success-foreground",
            isActive && "border-accent bg-accent text-accent-foreground",
            isBlocked && "border-border bg-background text-muted-foreground",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {isDone ? <CheckCircle2 className="h-5 w-5" /> : index}
        </div>
        {!isLast && (
          <div
            className={[
              "w-0.5 flex-1 mt-2 mb-2 min-h-[40px]",
              isDone ? "bg-success" : "bg-border",
            ].join(" ")}
          />
        )}
      </div>

      {/* Card */}
      <div className={`${cardClasses} flex-1 mb-4`}>
        <div className="flex items-start gap-4">
          <div className={iconWrapClasses}>
            {isDone ? <CheckCircle2 className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-base sm:text-lg">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {isDone ? (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success">
                  Concluído <CheckCircle2 className="h-4 w-4" />
                </span>
              ) : isBlocked ? (
                <button
                  disabled
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-muted px-4 py-2 text-sm font-medium text-muted-foreground cursor-not-allowed"
                >
                  <Lock className="h-3.5 w-3.5" />
                  {ctaLabel}
                </button>
              ) : ctaHref ? (
                <Link to={ctaHref} className="lp-btn-primary-indigo">
                  {ctaLabel} <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <button className="lp-btn-primary-indigo">
                  {ctaLabel} <ArrowRight className="h-4 w-4" />
                </button>
              )}
              {/* Secondary só faz sentido enquanto o step esta ativo
                  (admin pode escapar pra importacao); quando done/blocked,
                  o botao primario ja conta a historia. */}
              {secondaryCta && isActive && (
                <Link
                  to={secondaryCta.href}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-bg-surface-1 transition-colors"
                >
                  {secondaryCta.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface OnboardingStepsProps {
  jiraConnected: boolean;
  hasProject: boolean;
}

export default function OnboardingSteps({ jiraConnected, hasProject }: OnboardingStepsProps) {
  const step1: StepStatus = jiraConnected ? "done" : "active";
  const step2: StepStatus = !jiraConnected ? "blocked" : hasProject ? "done" : "active";
  const step3: StepStatus = !hasProject ? "blocked" : "active";

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">
      <ScrollReveal>
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Bem-vindo ao BacklogAI 👋
          </h1>
          <p className="mt-3 text-muted-foreground">
            Configure em 3 passos para começar a priorizar com inteligência.
          </p>
        </div>
      </ScrollReveal>

      <ScrollReveal delay={0.05}>
        <Step
          index={1}
          icon={KanbanSquare}
          title="Conecte sua conta Jira"
          description="Forneça seu domínio Atlassian, email e API token para importar tickets do seu projeto."
          ctaLabel="Conectar Jira"
          ctaHref="/conectar-jira"
          status={step1}
        />
      </ScrollReveal>

      <ScrollReveal delay={0.1}>
        <Step
          index={2}
          icon={LayoutGrid}
          title="Escolha um projeto"
          description="Selecione qual projeto Jira você quer priorizar com IA — funciona com Scrum, Kanban ou Business."
          ctaLabel="Selecionar Projeto"
          ctaHref="/importar-jira"
          secondaryCta={{ label: "Ir para meus projetos", href: "/importar-jira" }}
          status={step2}
        />
      </ScrollReveal>

      <ScrollReveal delay={0.15}>
        <Step
          index={3}
          icon={Sparkles}
          title="Priorize seu backlog"
          description="A IA analisa impacto, esforço e urgência de cada ticket automaticamente."
          ctaLabel="Ir para o Backlog"
          ctaHref="/dashboard"
          status={step3}
          isLast
        />
      </ScrollReveal>
    </div>
  );
}
