import { useCallback, useEffect, useState } from "react";
import { PRODUCT_LINE_LABEL, REQUEST_TYPE_LABEL } from "@/types/commercial";

const LS_KEY = "portal_vidreiro_catalogo_v1";

export interface CatalogEntry {
  id: string;
  label: string;
}

interface Catalog {
  types: CatalogEntry[];
  lines: CatalogEntry[];
}

const DEFAULT_TYPES = new Set(Object.keys(REQUEST_TYPE_LABEL));
const DEFAULT_LINES = new Set(Object.keys(PRODUCT_LINE_LABEL));

function read(): Catalog {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const c = JSON.parse(raw) as Catalog;
      return { types: c.types ?? [], lines: c.lines ?? [] };
    }
  } catch {
    /* ignora */
  }
  return { types: [], lines: [] };
}

// Mescla os cadastros personalizados nos mapas de rótulos usados em todo o portal
function apply(c: Catalog) {
  c.types.forEach(t => (REQUEST_TYPE_LABEL[t.id] = t.label));
  c.lines.forEach(l => (PRODUCT_LINE_LABEL[l.id] = l.label));
}
apply(read());

const listeners = new Set<(c: Catalog) => void>();
function write(c: Catalog) {
  localStorage.setItem(LS_KEY, JSON.stringify(c));
  apply(c);
  listeners.forEach(l => l(c));
}

const slug = (s: string) =>
  "c_" +
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") +
  "_" +
  Date.now().toString(36);

export function useCatalog() {
  const [catalog, setCatalog] = useState<Catalog>(() => read());

  useEffect(() => {
    listeners.add(setCatalog);
    return () => {
      listeners.delete(setCatalog);
    };
  }, []);

  const add = useCallback((kind: "types" | "lines", label: string): string | null => {
    const clean = label.trim().slice(0, 60);
    if (clean.length < 2) return null;
    const map = kind === "types" ? REQUEST_TYPE_LABEL : PRODUCT_LINE_LABEL;
    const existing = Object.entries(map).find(([, v]) => v.toLowerCase() === clean.toLowerCase());
    if (existing) return existing[0];
    const c = read();
    const entry = { id: slug(clean), label: clean };
    write({ ...c, [kind]: [...c[kind], entry] });
    return entry.id;
  }, []);

  const rename = useCallback((kind: "types" | "lines", id: string, label: string) => {
    const clean = label.trim().slice(0, 60);
    if (clean.length < 2) return;
    const c = read();
    write({ ...c, [kind]: c[kind].map(e => (e.id === id ? { ...e, label: clean } : e)) });
  }, []);

  const remove = useCallback((kind: "types" | "lines", id: string) => {
    const c = read();
    write({ ...c, [kind]: c[kind].filter(e => e.id !== id) });
  }, []);

  return {
    custom: catalog,
    typeLabels: { ...REQUEST_TYPE_LABEL },
    lineLabels: { ...PRODUCT_LINE_LABEL },
    isDefault: (kind: "types" | "lines", id: string) =>
      (kind === "types" ? DEFAULT_TYPES : DEFAULT_LINES).has(id),
    add,
    rename,
    remove,
  };
}
