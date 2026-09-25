import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

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
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  isAdmin: boolean;
  isSupervisor: boolean;
  isAgent: boolean;
  isApproved: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (email: string, password: string, fullName: string) => Promise<{
    error?: string;
    isFirstUser?: boolean;
    requiresEmailConfirmation?: boolean;
    requiresApproval?: boolean;
  }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfileAndRole = useCallback(async (uid: string) => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle(),
    ]);
    setProfile((p as Profile | null) ?? null);
    setRole((r?.role as AppRole | undefined) ?? null);
  }, []);

  const checkActive = useCallback(async () => {
    try {
      // Garante que ainda existe uma sessão válida antes de chamar a função
      const { data: { session: current } } = await supabase.auth.getSession();
      if (!current?.access_token) return;

      const { data, error } = await supabase.functions.invoke("check-user-active", {
        headers: { Authorization: `Bearer ${current.access_token}` },
      });
      if (error) return;
      if (data && (data.active === false || data.approved === false)) {
        if (data.active === false) {
          await supabase.auth.signOut();
        }
      }
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        // Mantem loading=true ate role/profile carregarem, evitando que o
        // Dashboard renderize com isAdmin=false logo apos login fresco.
        setLoading(true);
        // defer para evitar deadlock no listener
        setTimeout(async () => {
          try {
            await loadProfileAndRole(s.user.id);
            checkActive();
          } finally {
            setLoading(false);
          }
        }, 0);
      } else {
        setProfile(null);
        setRole(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await loadProfileAndRole(s.user.id);
        checkActive();
      }
      setLoading(false);
    });

    // Status offline ao fechar a aba
    const handleUnload = () => {
      const uid = user?.id;
      if (!uid) return;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}`;
      fetch(url, {
        method: "PATCH",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ status: "offline" }),
      }).catch(() => {});
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("beforeunload", handleUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadProfileAndRole, checkActive]);

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && user?.id) {
      await supabase.from("profiles").update({ status: "online" }).eq("id", user.id);
    }
    return { error: error?.message };
  };

  const signUpWithEmail = async (email: string, password: string, fullName: string) => {
    // 1. Validar domínio via Edge Function
    const { data: validation, error: vErr } = await supabase.functions.invoke("validate-signup", {
      body: { email },
    });
    if (vErr) return { error: "Erro ao validar cadastro. Tente novamente." };
    if (validation && validation.allowed === false) {
      return { error: validation.message || "Cadastro não permitido." };
    }

    // 2. Detectar se será o primeiro usuário (antes do signup)
    const { count } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });
    const isFirstUser = (count ?? 0) === 0;

    // 3. Detectar se aprovação é exigida (apenas relevante se não for o primeiro)
    let requiresApproval = false;
    if (!isFirstUser) {
      const { data: cfg } = await supabase
        .from("project_config")
        .select("value")
        .eq("key", "require_account_approval")
        .maybeSingle();
      requiresApproval = cfg?.value === "true";
    }

    const redirectUrl = `${window.location.origin}/dashboard`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName },
      },
    });
    if (error) return { error: error.message };

    // Padrão Supabase: quando confirmação de email está ativa, session vem null
    const requiresEmailConfirmation = !!data.user && !data.session;

    return {
      isFirstUser,
      requiresEmailConfirmation,
      requiresApproval,
    };
  };

  const signInWithGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/dashboard`,
    });
    if ("error" in result && result.error) {
      return { error: result.error.message };
    }
    return {};
  };

  const signOut = async () => {
    if (user?.id) {
      await supabase.from("profiles").update({ status: "offline" }).eq("id", user.id);
    }
    await supabase.auth.signOut();
  };

  const refreshProfile = useCallback(async () => {
    if (user?.id) await loadProfileAndRole(user.id);
  }, [user?.id, loadProfileAndRole]);

  const value: AuthContextValue = {
    user,
    session,
    profile,
    role,
    loading,
    isAdmin: role === "admin",
    isSupervisor: role === "supervisor",
    isAgent: role === "agent",
    isApproved: profile?.is_approved === true,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
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
