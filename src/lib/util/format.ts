import type { Message } from '../api/types';

export function timeHM(iso: string) {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Сегодня';
  if (d.toDateString() === y.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

export function shortTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return timeHM(iso);
  const diff = (now.getTime() - d.getTime()) / 86400000;
  if (diff < 6) return d.toLocaleDateString('ru-RU', { weekday: 'short' });
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

export function duration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';
}

/** Стабильный цвет по id: аватарка без картинки. */
export function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 62% 52%)`;
}

export const errorText: Record<string, string> = {
  bad_credentials: 'Неверный ник или пароль',
  invalid_invite: 'Инвайт не найден, истёк или уже использован',
  username_taken: 'Этот ник уже занят',
  bad_username: 'Ник: 3–24 символа, латиница, цифры и _',
  weak_password: 'Пароль должен быть не короче 8 символов',
  network: 'Нет связи с сервером',
  forbidden: 'Недостаточно прав',
};

export function describeError(e: unknown): string {
  const code = (e as { code?: string })?.code;
  if (code && errorText[code]) return errorText[code];
  return (e as Error)?.message || 'Что-то пошло не так';
}
export function messageSummary(message: Message) {
  if (message.deleted_at) return 'Сообщение удалено';
  if (message.kind === 'voice') return 'Голосовое сообщение';
  if (message.kind === 'media') return message.body || (message.attachments[0]?.mime.startsWith('video/') ? 'Видео' : 'Фото');
  return message.body;
}
