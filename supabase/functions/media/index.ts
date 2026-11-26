// Подписанные ссылки на Backblaze B2 (S3-совместимый API).
// Клиент сам заливает и скачивает файл по ссылке, функция только проверяет,
// что пользователь участник группы, и подписывает запрос. Ключи B2 живут в секретах функции.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { AwsClient } from 'npm:aws4fetch@1.0.20';

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

const B2_ENDPOINT = Deno.env.get('B2_ENDPOINT')!; // напр. https://s3.eu-central-003.backblazeb2.com
const B2_BUCKET = Deno.env.get('B2_BUCKET')!;
const B2_REGION = Deno.env.get('B2_REGION') ?? B2_ENDPOINT.match(/s3\.([^.]+)\./)?.[1] ?? 'us-east-005';
const MAX_BYTES = 100 * 1024 * 1024;

const aws = new AwsClient({
  accessKeyId: Deno.env.get('B2_KEY_ID')!,
  secretAccessKey: Deno.env.get('B2_APP_KEY')!,
  service: 's3',
  region: B2_REGION,
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'unauthorized' }, 401);

  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: user } = await supa.auth.getUser();
  if (!user?.user) return json({ error: 'unauthorized' }, 401);

  const { action, key, mime, size } = await req.json();
  if (typeof key !== 'string' || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,80}$/.test(key)) {
    return json({ error: 'bad_key' }, 400);
  }
  const groupId = key.split('/')[0];
  const { data: member } = await supa.rpc('is_member', { p_group: groupId });
  if (member !== true) return json({ error: 'forbidden' }, 403);

  const url = new URL(`${B2_ENDPOINT}/${B2_BUCKET}/${key}`);
  url.searchParams.set('X-Amz-Expires', action === 'upload' ? '900' : '3600');

  if (action === 'upload') {
    if (typeof size !== 'number' || size <= 0 || size > MAX_BYTES) return json({ error: 'too_big' }, 400);
    if (typeof mime !== 'string' || !/^(audio|image|video)\//.test(mime)) return json({ error: 'bad_mime' }, 400);
    const signed = await aws.sign(url.toString(), {
      method: 'PUT',
      headers: { 'Content-Type': mime },
      aws: { signQuery: true },
    });
    return json({ url: signed.url, headers: { 'Content-Type': mime } });
  }
  if (action === 'download') {
    const signed = await aws.sign(url.toString(), { method: 'GET', aws: { signQuery: true } });
    return json({ url: signed.url });
  }
  return json({ error: 'bad_action' }, 400);
});
