import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

export type DemoProfile = 'pm-saas' | 'tech-lead' | 'product-owner';

interface DemoContextValue {
  isDemoMode: boolean;
  demoProfile: DemoProfile;
  setDemoMode: (v: boolean) => void;
  setDemoProfile: (p: DemoProfile) => void;
  resetDemo: () => void;
}

const LS_MODE = 'backlogai_demo_mode';
const LS_PROFILE = 'backlogai_demo_profile';

function readMode(): boolean {
  return localStorage.getItem(LS_MODE) === 'true';
}

function readProfile(): DemoProfile {
  const v = localStorage.getItem(LS_PROFILE);
  if (v === 'tech-lead' || v === 'product-owner') return v;
  return 'pm-saas';
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoModeState] = useState(readMode);
  const [demoProfile, setDemoProfileState] = useState<DemoProfile>(readProfile);

  const setDemoMode = useCallback((v: boolean) => {
    setIsDemoModeState(v);
    localStorage.setItem(LS_MODE, String(v));
  }, []);

  const setDemoProfile = useCallback((p: DemoProfile) => {
    setDemoProfileState(p);
    localStorage.setItem(LS_PROFILE, p);
  }, []);

  const resetDemo = useCallback(() => {
    setIsDemoModeState(false);
    setDemoProfileState('pm-saas');
    localStorage.removeItem(LS_MODE);
    localStorage.removeItem(LS_PROFILE);
  }, []);

  return (
    <DemoContext.Provider value={{ isDemoMode, demoProfile, setDemoMode, setDemoProfile, resetDemo }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemo must be used inside DemoProvider');
  return ctx;
}
