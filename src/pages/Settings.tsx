import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import SettingsSidebar, { type SettingsSection } from "@/components/settings/SettingsSidebar";
import ServiceKeyCard from "@/components/settings/ServiceKeyCard";
import DemoSection from "@/components/settings/DemoSection";
import ProfileSection from "@/components/settings/ProfileSection";
import TeamManagement from "@/pages/TeamManagement";
import SecuritySettings from "@/pages/SecuritySettings";
import { SUPPORTED_SERVICES, type RegistryEntry } from "@/components/settings/services";
import { ShieldAlert } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const [section, setSection] = useState<SettingsSection>("profile");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function checkRole() {
      if (!user) return;
      const { data } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (!cancelled) setIsAdmin(!!data);
    }
    checkRole();
    return () => { cancelled = true; };
  }, [user]);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("api_keys_registry")
      .select("id,service_name,label,is_active,last_validated_at,last_validation_status,updated_at");
    setEntries((data ?? []) as RegistryEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) loadEntries();
  }, [isAdmin, loadEntries]);

  return (
    <div className="px-6 py-8 lg:px-12 lg:py-10 max-w-6xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie integrações, chaves de API e preferências da plataforma.
        </p>
      </header>

      <div className="mt-8 flex flex-col md:flex-row gap-8">
        <SettingsSidebar active={section} onChange={setSection} isAdmin={!!isAdmin} />

        <div className="flex-1 min-w-0">
          {section === "profile" && <ProfileSection />}

          {section === "demo" && <DemoSection />}

          {/* Equipe e Seguranca sao filtrados do sidebar para nao-admin,
              entao aqui basta renderizar — RLS do Supabase faz a defesa
              real do dado. */}
          {section === "team" && <TeamManagement embedded />}

          {section === "security" && <SecuritySettings embedded />}

          {section === "api-keys" && (
            isAdmin === false ? (
              <div className="rounded-2xl border bg-card p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">Apenas administradores</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Você não tem permissão para acessar as configurações de chaves de API.
                </p>
              </div>
            ) : (
              <section>
                <h2 className="text-xl font-semibold tracking-tight">Chaves de API</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Cada chave é armazenada de forma segura no cofre criptografado e nunca é exposta no frontend.
                </p>
                <div className="mt-5 space-y-4">
                  {loading ? (
                    <div className="h-32 rounded-2xl bg-muted animate-pulse" />
                  ) : (
                    SUPPORTED_SERVICES.map((service) => {
                      const entry = entries.find((e) => e.service_name === service.id);
                      return (
                        <ServiceKeyCard
                          key={service.id}
                          service={service}
                          registryEntry={entry}
                          onChanged={loadEntries}
                        />
                      );
                    })
                  )}
                </div>
              </section>
            )
          )}
        </div>
      </div>
    </div>
  );
}
