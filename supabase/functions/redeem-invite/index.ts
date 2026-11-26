// Регистрация по инвайту. Самостоятельная регистрация в Supabase выключена,
// поэтому аккаунт создаёт эта функция с правами service role.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Должно совпадать с USERNAME_EMAIL_DOMAIN в src/lib/api/config.ts
const USERNAME_EMAIL_DOMAIN = 'users.comsys.local';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  let body: { code?: string; username?: string; display_name?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  const code = (body.code ?? '').trim().toUpperCase();
  const username = (body.username ?? '').trim().toLowerCase();
  const displayName = (body.display_name ?? '').trim() || username;
  const password = body.password ?? '';

  if (!/^[a-z0-9_]{3,24}$/.test(username)) return json({ error: 'bad_username' }, 400);
  if (password.length < 8) return json({ error: 'weak_password' }, 400);
  if (displayName.length > 48) return json({ error: 'bad_display_name' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data: taken } = await admin.from('profiles').select('id').eq('username', username).maybeSingle();
  if (taken) return json({ error: 'username_taken' }, 409);

  const { data: grantsAdmin, error: claimErr } = await admin.rpc('claim_invite', { p_code: code });
  if (claimErr) return json({ error: 'invalid_invite' }, 403);

  const { error: createErr } = await admin.auth.admin.createUser({
    email: `${username}@${USERNAME_EMAIL_DOMAIN}`,
    password,
    email_confirm: true,
    user_metadata: { username, display_name: displayName },
    app_metadata: { grants_admin: grantsAdmin === true },
  });
  if (createErr) {
    await admin.rpc('release_invite', { p_code: code });
    const taken = /already|registered|exists/i.test(createErr.message);
    return json({ error: taken ? 'username_taken' : 'create_failed', detail: createErr.message }, taken ? 409 : 500);
  }
  return json({ ok: true });
});
