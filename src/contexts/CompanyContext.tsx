import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ACCESS_MOCK, COMPANIES_MOCK, USERS_MOCK } from "@/mocks/companiesMock";
import {
  ALL_MODULES,
  CONSOLIDATED,
  type ActiveCompanyId,
  type Company,
  type PortalUser,
  type UserCompanyAccess,
} from "@/types/company";

const LS_COMPANIES = "portal_empresas_v1";
const LS_ACCESS = "portal_vinculos_v1";
const LS_USERS = "portal_usuarios_cfg_v1"; // default/global por usuário
const LS_ACTIVE = "portal_empresa_ativa_v1";

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignora */
  }
  return fallback;
}
const save = (key: string, v: unknown) => localStorage.setItem(key, JSON.stringify(v));

type UserCfg = Record<string, { defaultCompanyId: string | null; globalAccess: boolean }>;

interface CompanyCtx {
  companies: Company[];
  accesses: UserCompanyAccess[];
  userCfg: UserCfg;
  mockUsers: PortalUser[];
  activeCompanyId: ActiveCompanyId;
  activeCompany: Company | null;
  isConsolidated: boolean;
  allowedCompanies: Company[];
  canConsolidate: boolean;
  setActiveCompanyId: (id: ActiveCompanyId) => void;
  saveCompany: (c: Company) => void;
  setUserAccess: (userId: string, companyIds: string[], defaultCompanyId: string | null, globalAccess: boolean) => string | null;
  matchesActive: (companyId?: string) => boolean;
  defaultNewCompanyId: () => string;
}

const Ctx = createContext<CompanyCtx | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user, isAdmin, role } = useAuth();
  const [companies, setCompanies] = useState<Company[]>(() => load(LS_COMPANIES, COMPANIES_MOCK));
  const [accesses, setAccesses] = useState<UserCompanyAccess[]>(() => load(LS_ACCESS, ACCESS_MOCK));
  const [userCfg, setUserCfg] = useState<UserCfg>(() =>
    load(LS_USERS, Object.fromEntries(USERS_MOCK.map(u => [u.id, { defaultCompanyId: u.defaultCompanyId, globalAccess: u.globalAccess }]))),
  );
  const [activeCompanyId, setActive] = useState<ActiveCompanyId>(() => load<ActiveCompanyId | null>(LS_ACTIVE, null) ?? "");

  const hq = companies.find(c => c.isHeadquarter) ?? companies[0];
  const uid = user?.id ?? "";
  const cfg = userCfg[uid];
  const hasGlobal = isAdmin || role === "supervisor" || !!cfg?.globalAccess;

  const allowedCompanies = useMemo(() => {
    const active = companies.filter(c => c.active);
    if (hasGlobal) return active;
    const mine = accesses.filter(a => a.userId === uid && a.active).map(a => a.companyId);
    const list = active.filter(c => mine.includes(c.id));
    // Sem vínculo configurado: acesso à matriz para não travar o uso
    return list.length ? list : active.filter(c => c.id === hq?.id);
  }, [companies, accesses, uid, hasGlobal, hq?.id]);

  // Garante que a empresa ativa é permitida
  useEffect(() => {
    if (!uid) return;
    const ok = activeCompanyId === CONSOLIDATED ? hasGlobal : allowedCompanies.some(c => c.id === activeCompanyId);
    if (!ok) {
      const def = cfg?.defaultCompanyId && allowedCompanies.some(c => c.id === cfg.defaultCompanyId) ? cfg.defaultCompanyId : null;
      setActive(def ?? (hasGlobal ? CONSOLIDATED : allowedCompanies[0]?.id ?? ""));
    }
  }, [uid, activeCompanyId, allowedCompanies, hasGlobal, cfg?.defaultCompanyId]);

  const setActiveCompanyId = useCallback((id: ActiveCompanyId) => {
    setActive(id);
    save(LS_ACTIVE, id);
  }, []);

  const saveCompany = useCallback((c: Company) => {
    setCompanies(prev => {
      let next = prev.some(p => p.id === c.id) ? prev.map(p => (p.id === c.id ? c : p)) : [...prev, c];
      if (c.isHeadquarter) next = next.map(p => (p.id === c.id ? p : { ...p, isHeadquarter: false }));
      save(LS_COMPANIES, next);
      return next;
    });
  }, []);

  const setUserAccess = useCallback(
    (userId: string, companyIds: string[], defaultCompanyId: string | null, globalAccess: boolean): string | null => {
      if (userId === uid && activeCompanyId !== CONSOLIDATED && !globalAccess && !hasGlobal && !companyIds.includes(activeCompanyId)) {
        return "Você não pode remover o vínculo da sua empresa ativa. Troque de unidade no seletor antes.";
      }
      if (defaultCompanyId && !globalAccess && !companyIds.includes(defaultCompanyId)) {
        return "A unidade padrão precisa estar entre as unidades vinculadas.";
      }
      setAccesses(prev => {
        const others = prev.filter(a => a.userId !== userId);
        const next = [
          ...others,
          ...companyIds.map(companyId => ({
            userId,
            companyId,
            allowedModules: prev.find(a => a.userId === userId && a.companyId === companyId)?.allowedModules ?? ALL_MODULES,
            active: true,
          })),
        ];
        save(LS_ACCESS, next);
        return next;
      });
      setUserCfg(prev => {
        const next = { ...prev, [userId]: { defaultCompanyId, globalAccess } };
        save(LS_USERS, next);
        return next;
      });
      return null;
    },
    [uid, activeCompanyId, hasGlobal],
  );

  const isConsolidated = activeCompanyId === CONSOLIDATED;
  const activeCompany = isConsolidated ? null : companies.find(c => c.id === activeCompanyId) ?? null;

  const matchesActive = useCallback(
    (companyId?: string) => isConsolidated || (companyId ?? hq?.id) === activeCompanyId,
    [isConsolidated, activeCompanyId, hq?.id],
  );

  const defaultNewCompanyId = useCallback(
    () => (isConsolidated || !activeCompanyId ? cfg?.defaultCompanyId ?? hq?.id ?? "" : activeCompanyId),
    [isConsolidated, activeCompanyId, cfg?.defaultCompanyId, hq?.id],
  );

  return (
    <Ctx.Provider
      value={{
        companies,
        accesses,
        userCfg,
        mockUsers: USERS_MOCK,
        activeCompanyId,
        activeCompany,
        isConsolidated,
        allowedCompanies,
        canConsolidate: hasGlobal,
        setActiveCompanyId,
        saveCompany,
        setUserAccess,
        matchesActive,
        defaultNewCompanyId,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCompany() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCompany precisa estar dentro de CompanyProvider");
  return c;
}
