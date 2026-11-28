# Как запустить C-COMSYS для своих

Всё бесплатно и без банковской карты. Займёт около 20 минут. Ключи никуда пересылать не нужно: они живут в панели Supabase и в настройках GitHub.

Без шагов 1–4 приложение тоже работает, но в **демо-режиме**: «сервер» живёт в браузере, друзья друг друга не видят.

## 0. Попробовать локально (по желанию)

Нужен Node.js 20+.

```bash
npm install
npm run dev          # откроется http://localhost:5173 в демо-режиме
```

## 1. Проект Supabase

1. Зайди на [supabase.com](https://supabase.com) → **Start your project** → войди через GitHub.
2. **New project**: имя `comsys`, регион **Central EU (Frankfurt)**, придумай пароль базы и сохрани его в менеджере паролей. Тариф Free.
3. Подожди 1–2 минуты, пока проект создаётся.

## 2. База данных

1. Слева **SQL Editor** → **New query**.
2. Выполни SQL-файлы из [`supabase/migrations`](../supabase/migrations) по порядку, начиная с `0001_init.sql`. Открывай отдельный запрос для каждого файла.
3. Создай первый инвайт, он сделает тебя админом сети. В новом запросе (код придумай свой, заглавными латинскими буквами и цифрами):

   ```sql
   insert into invites (code, grants_admin, max_uses) values ('MOJ-KOD-1234', true, 1);
   ```

## 3. Вход только по инвайтам

1. **Authentication → Sign In / Providers** (в старом интерфейсе **Authentication → Providers**).
2. Выключи **Allow new users to sign up**. Так зарегистрироваться можно будет только через инвайт.
3. В блоке **Email** выключи **Confirm email** (почта не используется, вход по нику).

## 4. Функция регистрации по инвайту

1. Слева **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Имя функции: `redeem-invite` (ровно так).
3. Замени код в редакторе содержимым [`supabase/functions/redeem-invite/index.ts`](../supabase/functions/redeem-invite/index.ts) → **Deploy**.
4. Открой функцию → **Details** (или Settings) → выключи **Enforce JWT Verification** (Verify JWT) → **Save**. Иначе гость без аккаунта не сможет зарегистрироваться.

Если удобнее командная строка: `npx supabase login`, `npx supabase link`, `npx supabase functions deploy redeem-invite` (настройка `verify_jwt = false` уже лежит в `supabase/config.toml`).

## 5. Ключи для приложения

1. **Project Settings → API** (или **Data API** / **API Keys**).
2. Скопируй **Project URL** и **anon public** ключ (в новом интерфейсе он называется **Publishable key**).
   Ключ `service_role` / `secret` **никуда не копируй**: он нужен только функциям, и Supabase сам им его даёт.
3. Для локального запуска: скопируй `.env.example` в `.env` и вставь оба значения.

anon-ключ публичный по замыслу: он попадает в код сайта у каждого. Защиту данных обеспечивают правила RLS в базе.

## 6. Веб-версия на GitHub Pages (нужна для iPhone)

1. В репозитории на GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → вкладка Variables → New repository variable**:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon / publishable ключ
3. **Actions → Deploy PWA to Pages → Run workflow** (дальше будет запускаться сам при каждом изменении в `main`).
4. Через пару минут сайт откроется по адресу `https://<твой-логин>.github.io/comsys/`.
5. Там же каждый день запускается `Keep Supabase awake`, чтобы бесплатный проект не уснул.

## 7. Зайти самому и позвать друзей

1. Открой сайт → **По инвайту** → твой код из шага 2 → ник и пароль. Ты админ сети.
2. **Настройки** (аватар внизу слева) → **Пригласить в сеть** → **Создать инвайт** → кнопка копирования даёт ссылку, где код уже подставлен.
3. Друг открывает ссылку, придумывает ник и пароль, и он в сети.

Установка как приложения:
- **iPhone**: Safari → «Поделиться» → «На экран Домой».
- **Android**: Chrome → меню → «Установить приложение».
- **ПК**: Chrome/Edge → значок установки в адресной строке. Нативная сборка через Tauri будет на следующем этапе.

## 8. Backblaze B2 для медиа (по желанию)

По умолчанию голосовые лежат в Supabase Storage (1 ГБ бесплатно, этого хватит примерно на 5 000 минут голосовых). Когда понадобится больше места (кружки, видео), подключаем B2 на 10 ГБ:

1. [backblaze.com](https://www.backblaze.com/sign-up/cloud-storage-v2) → регистрация B2 Cloud Storage (карта не нужна).
2. **Buckets → Create a Bucket**: имя, например `comsys-media-<что-то-своё>`, **Private**. Запомни **Endpoint** (вида `s3.eu-central-003.backblazeb2.com`).
3. У бакета **CORS Rules** → «Share everything in this bucket with all HTTPS origins» (или только с адресом твоего сайта), обязательно **S3 Compatible API** → Update.
4. **Application Keys → Add a New Application Key**: доступ только к этому бакету, Read and Write. Сохрани `keyID` и `applicationKey` (показывается один раз).
5. В Supabase: **Edge Functions → Secrets** добавь:
   - `B2_ENDPOINT` = `https://s3.<регион>.backblazeb2.com`
   - `B2_BUCKET` = имя бакета
   - `B2_KEY_ID`, `B2_APP_KEY` = ключи из пункта 4
6. Задеплой функцию `media` из [`supabase/functions/media/index.ts`](../supabase/functions/media/index.ts) так же, как в шаге 4, но **JWT Verification оставь включённым**.
7. В переменных GitHub добавь `VITE_MEDIA_PROVIDER` = `b2` и перезапусти деплой.

Старые голосовые остаются в Supabase и продолжают играть, новые идут в B2.

## Если что-то не так

- **«Неверный ник или пароль» сразу после регистрации**: проверь, что выключен Confirm email (шаг 3).
- **«Инвайт не найден»**: код из шага 2 одноразовый; создай новый тем же SQL.
- **Регистрация падает с create_failed**: открой Edge Functions → redeem-invite → Logs и пришли текст ошибки.
- **Не приходят новые сообщения без обновления страницы**: Database → Publications → `supabase_realtime` должна включать таблицы `messages`, `members`, `groups`, `channels` (миграция делает это сама).
- **Забыли пароль**: Authentication → Users → пользователь → Reset password недоступен (почты нет), поэтому админ меняет пароль там же через «Update user» или удаляет пользователя и выдаёт новый инвайт.
