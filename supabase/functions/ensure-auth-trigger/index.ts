// Auto-reparo dos triggers em auth.users.
//
// Quando alguém faz REMIX deste projeto no Lovable, o schema `auth` não
// é replicado — então os triggers `on_auth_user_created` e
// `check_domain_before_signup` somem, e o cadastro de usuários quebra
// (auth.users recebe o registro, mas public.profiles fica vazio).
//
// Esta função é chamada uma vez por sessão pelo frontend e delega para
// a RPC `admin_recreate_auth_trigger` (SECURITY DEFINER) que detecta e
// recria os triggers conforme necessário. É idempotente.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !serviceKey) {
      return json({
        ok: false,
        created: false,
        message:
          "Service role indisponível. Rode supabase/migrations/*_auth_profile_sync.sql no SQL Editor.",
      }, 500);
    }

    const admin = createClient(url, serviceKey);

    const { data, error } = await admin.rpc("admin_recreate_auth_trigger");

    if (error) {
      return json({
        ok: false,
        created: false,
        message:
          "Não foi possível verificar/recriar o trigger automaticamente. " +
          "Abra o SQL Editor do Lovable Cloud e rode o arquivo " +
          "supabase/migrations/*_auth_profile_sync.sql como role postgres.",
        details: error.message,
      });
    }

    // RPC retorna { existed, created } ou { error, message } em caso de privilege error
    const result = data as { existed?: boolean; created?: boolean; error?: string; message?: string };

    if (result?.error) {
      return json({
        ok: false,
        created: false,
        message: result.message || "Falha ao recriar trigger.",
      });
    }

    return json({
      ok: true,
      created: !!result?.created,
      message: result?.created
        ? "Trigger recriado com sucesso (auto-reparo de remix)."
        : "Trigger já existia — nenhuma ação necessária.",
    });
  } catch (e) {
    return json({
      ok: false,
      created: false,
      message: (e as Error).message,
    }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
