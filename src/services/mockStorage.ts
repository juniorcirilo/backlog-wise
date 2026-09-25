/**
 * Camada central de dados mock — 100% local (memória + localStorage).
 * Nenhuma dependência de banco de dados. Funções async com pequeno delay
 * simulam uma API para facilitar uma futura troca por backend real.
 */
import type { AppRole, Profile } from "@/contexts/AuthContext";

const LS_USERS = "taskflow_usuarios_v1";
const LS_SESSION = "taskflow_sessao_v1";

export interface MockUser extends Profile {
  role: AppRole;
  created_at: string;
}

const SEED: MockUser[] = [
  { id: "u-admin", full_name: "Junior Cirilo", email: "junior@unidadebrasil.com.br", role: "admin" },
  { id: "mock-u2", full_name: "Rafael Souza", email: "rafael.souza@vidrosbrasil.com.br", role: "supervisor" },
  { id: "mock-u3", full_name: "Helena Prado", email: "helena.prado@vidrosbrasil.com.br", role: "supervisor" },
  { id: "mock-u1", full_name: "Carla Mendes", email: "carla.mendes@vidrosbrasil.com.br", role: "agent" },
].map((u) => ({
  ...u,
  role: u.role as AppRole,
  avatar_url: null,
  status: "offline" as const,
  is_active: true,
  is_approved: true,
  created_at: "2026-01-01T00:00:00.000Z",
}));

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));

function read(): MockUser[] {
  try {
    const raw = localStorage.getItem(LS_USERS);
    if (raw) return JSON.parse(raw);
  } catch { /* ignora */ }
  return clone(SEED);
}
const write = (list: MockUser[]) => localStorage.setItem(LS_USERS, JSON.stringify(list));

// ---------- Usuários ----------
export const usersRepo = {
  listSync: (): MockUser[] => clone(read()),
  async list() { await delay(); return clone(read()); },
  getSync: (id: string) => read().find((u) => u.id === id) ?? null,
  async create(input: { full_name: string; email: string; role: AppRole }) {
    await delay();
    const list = read();
    if (list.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
      throw new Error("Já existe um usuário com este e-mail");
    }
    const user: MockUser = {
      id: `u-${Date.now().toString(36)}`,
      ...input,
      avatar_url: null,
      status: "offline",
      is_active: true,
      is_approved: true,
      created_at: new Date().toISOString(),
    };
    write([...list, user]);
    return clone(user);
  },
  async update(id: string, patch: Partial<Omit<MockUser, "id">>) {
    await delay();
    const list = read().map((u) => (u.id === id ? { ...u, ...patch } : u));
    write(list);
    return clone(list.find((u) => u.id === id)!);
  },
  async remove(id: string) {
    await delay();
    write(read().filter((u) => u.id !== id));
  },
};

// ---------- Sessão ----------
export const sessionRepo = {
  get: () => localStorage.getItem(LS_SESSION),
  set: (id: string) => localStorage.setItem(LS_SESSION, id),
  clear: () => localStorage.removeItem(LS_SESSION),
};
