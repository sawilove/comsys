// Настройки берутся из .env (см. .env.example). Секретов тут нет: anon-ключ Supabase
// публичный по замыслу, защиту даёт RLS в базе.
export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
export const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';
/** 'supabase' (по умолчанию, 1 ГБ) или 'b2' (Backblaze через Edge Function media). */
export const MEDIA_PROVIDER = ((import.meta.env.VITE_MEDIA_PROVIDER as string | undefined) || 'supabase') as 'supabase' | 'b2';
/** Вход по нику: ник превращается в служебную почту. Совпадает с supabase/functions/redeem-invite/index.ts. */
export const USERNAME_EMAIL_DOMAIN = 'users.comsys.local';

export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
