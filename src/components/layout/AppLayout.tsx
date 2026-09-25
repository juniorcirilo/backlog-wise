import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  CalendarClock,
  Gauge,
  Grid3x3,
  Inbox,
  LogOut,
  Menu,
  Settings,
  Layers,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { cn } from "@/lib/utils";
import CompanySwitcher from "@/components/company/CompanySwitcher";

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const userName = profile?.full_name || user?.email?.split("@")[0] || "Usuário";

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
      <div className="flex items-center gap-2 border-b border-sidebar-border px-5 py-5">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent shadow-accent-glow">
          <Layers className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold tracking-tight">Portal de Alçadas</p>
          <p className="-mt-0.5 text-[11px] text-sidebar-foreground/60">Comercial & Financeiro · Vidros</p>
        </div>
      </div>

      <div className="px-3 pt-4">
        <CompanySwitcher className="bg-sidebar-accent/50 border-sidebar-border" />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <NavLink to="/dashboard" className={navClass} onClick={onNavigate}>
          <Gauge className="h-4 w-4" /> Cockpit
        </NavLink>
        <NavLink to="/solicitacoes" className={navClass} onClick={onNavigate}>
          <Inbox className="h-4 w-4" /> Solicitações
        </NavLink>
        <NavLink to="/matriz" className={navClass} onClick={onNavigate}>
          <Grid3x3 className="h-4 w-4" /> Matriz de Alçadas
        </NavLink>
        <NavLink to="/programacao" className={navClass} onClick={onNavigate}>
          <CalendarClock className="h-4 w-4" /> Programação
        </NavLink>
      </nav>

      <div className="space-y-1 border-t border-sidebar-border p-3">
        <NavLink to="/settings" className={navClass} onClick={onNavigate}>
          <Settings className="h-4 w-4" /> Configurações
        </NavLink>
        <div className="mt-2 flex items-center gap-3 rounded-xl bg-sidebar-accent/50 px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 flex-shrink-0 lg:flex">
        <SidebarContent />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 animate-fade-up">
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-bg-surface-1 px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-md p-2 hover:bg-bg-surface-2" aria-label="Abrir menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent">
              <Layers className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold">Portal de Alçadas</span>
          </div>
        </header>
        <main key={location.pathname} className="flex-1 animate-fade-up">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
