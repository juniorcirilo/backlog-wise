import { NavLink, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { LayoutGrid, ListTodo, Grid3x3, CalendarDays, Settings, LogOut, Sparkles, Menu, FlaskConical, X, History } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useDemo } from "@/contexts/DemoContext";
import { useActiveProject } from "@/hooks/useActiveProject";
import { useState } from "react";
import { cn } from "@/lib/utils";

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, signOut } = useAuth();
  const { isDemoMode } = useDemo();
  const activeProject = useActiveProject();
  const { repository_id } = useParams();
  const navigate = useNavigate();
  const userName = (user?.user_metadata?.name as string) || user?.email?.split("@")[0] || "Usuário";

  // Em modo demo OU quando há projeto ativo importado, a sidebar aponta para ele.
  const activeProjectKey = repository_id || activeProject.key;

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
      isActive
        ? "bg-sidebar-accent text-sidebar-foreground"
        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
    );

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent shadow-accent-glow flex-shrink-0">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold tracking-tight">BacklogAI</p>
            {isDemoMode && (
              <span className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide bg-orange-500/20 text-orange-400 border border-orange-500/30 flex-shrink-0">
                DEMO
              </span>
            )}
          </div>
          <p className="text-[11px] text-sidebar-foreground/60 -mt-0.5">Priorização inteligente</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <NavLink to="/dashboard" className={navClass} onClick={onNavigate}>
          <LayoutGrid className="h-4 w-4" /> Dashboard
        </NavLink>

        {activeProjectKey && (
          <>
            <NavLink to={`/repository/${activeProjectKey}/backlog`} className={navClass} onClick={onNavigate}>
              <ListTodo className="h-4 w-4" /> Backlog
            </NavLink>
            <NavLink to={`/repository/${activeProjectKey}/matrix`} className={navClass} onClick={onNavigate}>
              <Grid3x3 className="h-4 w-4" /> Matriz
            </NavLink>
            <NavLink to={`/repository/${activeProjectKey}/roadmap`} className={navClass} onClick={onNavigate}>
              <CalendarDays className="h-4 w-4" /> Cronograma
            </NavLink>
          </>
        )}

      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3 space-y-1">
        <NavLink to="/historico" className={navClass} onClick={onNavigate}>
          <History className="h-4 w-4" /> Histórico
        </NavLink>
        <NavLink to="/settings" className={navClass} onClick={onNavigate}>
          <Settings className="h-4 w-4" /> Configurações
        </NavLink>
        <div className="mt-2 flex items-center gap-3 rounded-xl bg-sidebar-accent/50 px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white text-xs font-semibold">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">{user?.email}</p>
          </div>
          <button onClick={handleLogout} className="rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground" aria-label="Sair">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function DemoBanner() {
  const { isDemoMode, setDemoMode, demoProfile } = useDemo();
  if (!isDemoMode) return null;
  const profileLabel =
    demoProfile === "tech-lead" ? "Tech Lead de Agência"
    : demoProfile === "product-owner" ? "Dono de Produto"
    : "PM de SaaS";
  return (
    <div className="flex items-center justify-between gap-3 border-b border-orange-500/30 bg-orange-500/10 px-4 py-2 text-sm">
      <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300 min-w-0">
        <FlaskConical className="h-4 w-4 flex-shrink-0" />
        <p className="truncate">
          <span className="font-semibold">Modo apresentação — dados simulados</span>
          <span className="hidden sm:inline text-orange-700/70 dark:text-orange-300/70"> · Perfil: {profileLabel}</span>
        </p>
      </div>
      <button
        onClick={() => setDemoMode(false)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-orange-700 dark:text-orange-300 hover:bg-orange-500/20 transition-colors flex-shrink-0"
      >
        <X className="h-3.5 w-3.5" />
        Sair do modo demo
      </button>
    </div>
  );
}

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-shrink-0 sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 animate-fade-up">
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        <DemoBanner />
        <header className="flex items-center gap-3 border-b border-border bg-bg-surface-1 px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-md p-2 hover:bg-bg-surface-2" aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold">BacklogAI</span>
          </div>
        </header>
        <main key={location.pathname} className="flex-1 animate-fade-up">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
