import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import SettingsSidebar, { type SettingsSection } from "@/components/settings/SettingsSidebar";
import CompanyManagement from "@/components/company/CompanyManagement";
import UserCompanyAccessSection from "@/components/company/UserCompanyAccessSection";
import CatalogSection from "@/components/settings/CatalogSection";
import ProfileSection from "@/components/settings/ProfileSection";
import TeamManagement from "@/pages/TeamManagement";

export default function Settings() {
  const { isAdmin } = useAuth();
  const [section, setSection] = useState<SettingsSection>("profile");

  return (
    <div className="px-6 py-8 lg:px-12 lg:py-10 max-w-6xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie perfil, equipe, unidades e cadastros.</p>
      </header>
      <div className="mt-8 flex flex-col md:flex-row gap-8">
        <SettingsSidebar active={section} onChange={setSection} isAdmin={isAdmin} />
        <div className="flex-1 min-w-0">
          {section === "profile" && <ProfileSection />}
          {section === "companies" && (<><CompanyManagement /><UserCompanyAccessSection /></>)}
          {section === "catalog" && <CatalogSection />}
          {section === "team" && <TeamManagement embedded />}
        </div>
      </div>
    </div>
  );
}
