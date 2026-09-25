import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { usersRepo, sessionRepo, type MockUser } from "@/services/mockStorage";

export type AppRole = "admin" | "supervisor" | "agent";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  status: "online" | "offline" | "away" | "busy";
  is_active: boolean;
  is_approved: boolean;
}

interface AuthContextValue {
  user: { id: string; email: string } | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  isAdmin: boolean;
  isSupervisor: boolean;
  isAgent: boolean;
  isApproved: boolean;
  signInAs: (userId: string) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<MockUser | null>(() => {
    const id = sessionRepo.get();
    const u = id ? usersRepo.getSync(id) : null;
    return u && u.is_active ? u : null;
  });

  const signInAs = (userId: string) => {
    const u = usersRepo.getSync(userId);
    if (!u || !u.is_active) return;
    sessionRepo.set(userId);
    setCurrent(u);
  };

  const signOut = async () => {
    sessionRepo.clear();
    setCurrent(null);
  };

  const refreshProfile = useCallback(async () => {
    const id = sessionRepo.get();
    setCurrent(id ? usersRepo.getSync(id) : null);
  }, []);

  useEffect(() => {
    const onStorage = () => { refreshProfile(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refreshProfile]);

  const role = current?.role ?? null;
  const value: AuthContextValue = {
    user: current ? { id: current.id, email: current.email } : null,
    profile: current,
    role,
    loading: false,
    isAdmin: role === "admin",
    isSupervisor: role === "supervisor",
    isAgent: role === "agent",
    isApproved: !!current?.is_approved,
    signInAs,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
