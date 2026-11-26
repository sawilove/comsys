# C-COMSYS

Лёгкий, бесплатный, открытый мессенджер для своей компании (до ~50 человек). Закрытая сеть: войти можно только по инвайту.

**Версия 0.1:** текстовые сообщения, голосовые сообщения, группы и личные чаты, ответы, правка и удаление, офлайн-очередь отправки, локальный кэш истории, 6 тем оформления, PWA для телефона.

Дальше по плану: фото, видео и кружки, реакции, профиль в стиле Discord, пуши при закрытом приложении, звонки и голосовые каналы, сборки Tauri для ПК и Android.

## Как устроено

| Часть | Чем сделано |
|---|---|
| Клиент | Svelte 5 + TypeScript + Vite, PWA (vite-plugin-pwa), ~50 КБ gzip |
| Бэкенд | свой проект Supabase Free: Postgres + RLS, Realtime, Auth, Edge Functions |
| Медиа | Supabase Storage (по умолчанию) или Backblaze B2 через подписанные ссылки |
| Раздача | GitHub Pages (веб и iPhone), позже GitHub Releases (Tauri) |

Все права проверяются в базе (Row Level Security): даже изменённый клиент не прочитает чужой чат. Весь доступ к серверу в клиенте спрятан за интерфейс `Backend` в [`src/lib/api/types.ts`](src/lib/api/types.ts), так что переезд на свой сервер или Matrix не затронет интерфейс.

```
src/
  lib/api/        Backend: supabase.ts (боевой), demo.ts (всё в браузере)
  lib/state/      состояние, синхронизация, очередь отправки, IndexedDB-кэш
  lib/media/      запись голосовых (MediaRecorder + волна)
  lib/theme/      темы как наборы CSS-переменных
  lib/ui/         компоненты интерфейса
supabase/
  migrations/     схема базы, RLS, функции create_group / open_dm / create_invite …
  functions/      redeem-invite (регистрация по инвайту), media (ссылки на B2)
docs/SETUP.md     пошаговая настройка Supabase, GitHub Pages и B2
```

## Запуск

```bash
npm install
npm run dev      # без .env запускается демо-режим
npm run check    # проверка типов
npm run build
```

Настройка настоящего сервера: [docs/SETUP.md](docs/SETUP.md).

## Лицензия

[AGPL-3.0](LICENSE): форки и изменённые серверные версии тоже должны оставаться открытыми.
