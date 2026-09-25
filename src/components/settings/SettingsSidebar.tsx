import { Link } from "react-router-dom";
import {
  User, KeyRound, FlaskConical, Users, Shield, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SettingsSection = "profile" | "api-keys" | "demo" | "team" | "security";

type Item =
  | { kind: "section"; id: SettingsSection; label: string; icon: LucideIcon; adminOnly?: boolean }
  | { kind: "link";    id: string;          label: string; icon: LucideIcon; to: string; adminOnly?: boolean };

const ITEMS: Item[] = [
  { kind: "section", id: "profile",  label: "Meu Perfil",    icon: User },
  { kind: "section", id: "api-keys", label: "Chaves de API", icon: KeyRound },
  { kind: "section", id: "demo",     label: "Demonstração",  icon: FlaskConical },
  { kind: "section", id: "team",     label: "Equipe",        icon: Users,  adminOnly: true },
  { kind: "section", id: "security", label: "Segurança",     icon: Shield, adminOnly: true },
];

interface Props {
  active: SettingsSection;
  onChange: (s: SettingsSection) => void;
  isAdmin: boolean;
}

export default function SettingsSidebar({ active, onChange, isAdmin }: Props) {
  const visible = ITEMS.filter(it => !it.adminOnly || isAdmin);

  const baseClass =
    "w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors text-left";
  const activeClass = "bg-accent/10 text-accent";
  const inactiveClass = "text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <nav className="md:w-56 md:flex-shrink-0">
      <ul className="space-y-1">
        {visible.map(it => {
          const Icon = it.icon;
          if (it.kind === "section") {
            const isActive = active === it.id;
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => onChange(it.id)}
                  className={cn(baseClass, isActive ? activeClass : inactiveClass)}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{it.label}</span>
                </button>
              </li>
            );
          }
          return (
            <li key={it.id}>
              <Link to={it.to} className={cn(baseClass, inactiveClass)}>
                <Icon className="h-4 w-4" />
                <span className="flex-1">{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
