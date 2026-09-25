import { useCallback, useEffect, useState } from "react";
import { COMMERCIAL_REQUESTS } from "@/data/commercial-mock";
import type { ApprovalStatus, CommercialRequest, UserRole } from "@/types/commercial";

const LS_KEY = "portal_vidreiro_solicitacoes_v1";

type Listener = (data: CommercialRequest[]) => void;
const listeners = new Set<Listener>();

function read(): CommercialRequest[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CommercialRequest[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    /* cache inválido — recai no mock */
  }
  return COMMERCIAL_REQUESTS;
}

function write(data: CommercialRequest[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {
    /* quota — mantém apenas em memória */
  }
  listeners.forEach(l => l(data));
}

export type NewRequestInput = Omit<CommercialRequest, "id" | "createdAt" | "status" | "history">;

export interface DecisionInput {
  action: "aprovou" | "rejeitou" | "solicitou_ajuste";
  justification: string;
  actor: string;
  role: UserRole;
}

export function useCommercialRequests() {
  const [requests, setRequests] = useState<CommercialRequest[]>(() => read());

  useEffect(() => {
    const l: Listener = data => setRequests(data);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const decide = useCallback((id: string, input: DecisionInput) => {
    const next = read().map(r => {
      if (r.id !== id) return r;
      const status: ApprovalStatus =
        input.action === "aprovou"
          ? "aprovado"
          : input.action === "rejeitou"
            ? "rejeitado"
            : "ajuste_solicitado";
      return {
        ...r,
        status,
        history: [
          ...r.history,
          {
            id: `h${r.history.length + 1}-${Date.now()}`,
            role: input.role,
            actor: input.actor,
            action: input.action,
            justification: input.justification,
            at: new Date().toISOString(),
          },
        ],
      };
    });
    write(next);
  }, []);

  const create = useCallback((input: NewRequestInput): CommercialRequest => {
    const current = read();
    const year = new Date().getFullYear();
    const seq =
      current.reduce((max, r) => {
        const m = r.id.match(/SOL-\d+-(\d+)/);
        return m ? Math.max(max, parseInt(m[1], 10)) : max;
      }, 0) + 1;
    const request: CommercialRequest = {
      ...input,
      id: `SOL-${year}-${String(seq).padStart(3, "0")}`,
      createdAt: new Date().toISOString(),
      status: "analise_comercial",
      history: [
        {
          id: `h1-${Date.now()}`,
          role: "vendedor",
          actor: input.salesRep,
          action: "criou",
          justification: input.justification,
          at: new Date().toISOString(),
        },
      ],
    };
    // Status inicial de fila conforme a alçada exigida
    request.status = queueStatus(request);
    write([request, ...current]);
    return request;
  }, []);

  const reset = useCallback(() => {
    write(COMMERCIAL_REQUESTS);
  }, []);

  return { requests, decide, create, reset };
}
