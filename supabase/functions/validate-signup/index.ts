import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body { email?: string }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: Body = await req.json().catch(() => ({}));
    const email = (body.email || "").trim().toLowerCase();

    if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      return json({ allowed: false, message: "Email inválido." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // First user always allowed
    const { count } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if ((count ?? 0) === 0) return json({ allowed: true });

    const { data: cfg, error } = await supabase
      .from("project_config")
      .select("key,value")
      .in("key", ["restrict_signup_by_domain", "allowed_email_domains"]);

    if (error) return json({ allowed: false, message: "Erro de configuração." }, 500);

    const map = Object.fromEntries((cfg ?? []).map((r) => [r.key, r.value]));
    const restrict = map.restrict_signup_by_domain === "true";
    if (!restrict) return json({ allowed: true });

    const domains = (map.allowed_email_domains || "")
      .split(",")
      .map((d: string) => d.trim().toLowerCase())
      .filter(Boolean);

    if (domains.length === 0) {
      return json({
        allowed: false,
        message: "Cadastro restrito: nenhum domínio configurado.",
      });
    }

    const emailDomain = email.split("@")[1];
    const ok = domains.some(
      (d) => emailDomain === d || emailDomain.endsWith("." + d),
    );

    if (!ok) {
      return json({
        allowed: false,
        message: "O domínio do seu email não é permitido para cadastro nesta plataforma.",
      });
    }
    return json({ allowed: true });
  } catch (e) {
    return json({ allowed: false, message: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
