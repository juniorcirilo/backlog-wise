import { Sparkles } from "lucide-react";

export default function Placeholder({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-6 py-12 lg:px-12 max-w-5xl mx-auto">
      <div className="rounded-2xl border bg-card p-10 text-center shadow-elevation-2">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <Sparkles className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted-foreground max-w-md mx-auto">{description}</p>
        <p className="mt-6 text-xs uppercase tracking-widest text-muted-foreground">
          Em construção — disponível em breve
        </p>
      </div>
    </div>
  );
}
