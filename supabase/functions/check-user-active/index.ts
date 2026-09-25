import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      // Sem token: trata como deslogado (200) para nao poluir o reporter de erros.
      return json({ active: false, approved: false, reason: "no_session" });
    }
    const token = authHeader.replace("Bearer ", "");

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData.user) {
      return json({ active: false, approved: false, reason: "invalid_token" });
    }

    const admin = createClient(url, service);
    const { data: profile } = await admin
      .from("profiles")
      .select("is_active,is_approved")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!profile) return json({ active: false, approved: false });

    if (!profile.is_active) {
      // Invalida todas as sessões do usuário
      await admin.auth.admin.signOut(userData.user.id);
    }

    return json({ active: profile.is_active, approved: profile.is_approved });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
