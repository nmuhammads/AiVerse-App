# AiVerse — AI Creative Platform

Монорепо проект для AI генерации изображений и видео. Telegram Mini App + Web App (PWA) + Mobile App (в разработке) с общим бэкендом.

🌐 **Web**: [www.aiverseapp.net](https://www.aiverseapp.net) · 🤖 **Telegram**: [@aiverse_bot](https://t.me/aiverse_bot)

## 🚀 Особенности

- 🎨 **Множество AI моделей**: NanoBanana, NanoBanana Pro, SeeDream 4/4.5, GPT Image 1.5, Qwen Image, Kling AI
- 🌐 **Web App (PWA)**: Полноценное веб-приложение на [aiverseapp.net](https://www.aiverseapp.net), работающее без ограничений Telegram
- 📱 **Telegram Mini App**: Полная интеграция с Telegram SDK
- 📲 **Mobile App**: React Native (Expo) для iOS и Android *(в разработке)*
- 🎬 **Генерация видео**: Text-to-Video и Image-to-Video через Kling AI, Seedance Pro
- 🖼 **Лента работ**: Просмотр работ сообщества, лайки и ремиксы
- 🤖 **AI Chat**: Встроенный чат-ассистент с генерацией изображений прямо в чате
- 👤 **Аватары**: Управление фото-референсами — загрузка, хранение и использование в генерациях
- 🖌 **Редактор изображений**: Inpainting, 3D Angles, удаление фона, водяные знаки
- ✨ **Оптимизация промптов**: AI-улучшение промптов и Image-to-Prompt
- 🔄 **Multi-Model Generation**: Параллельная генерация на нескольких моделях
- 🏆 **Конкурсы**: Тематические соревнования и таблицы лидеров
- 🔐 **Авторизация**: Telegram, Google OAuth, Email/Password
- � **Мультиязычность**: 6 языков (RU, EN, DE, FR, ES, AR)
- 💸 **Партнерская программа**: Реферальная система с бонусами от покупок
- �🌓 **Адаптивный дизайн**: Современный UI с тёмной темой

---

## 📊 Достижения

- 👥 **10,000+** зарегистрированных пользователей
- 🔥 **~1,000** активных пользователей
- 🎨 **~100,000** сгенерированных изображений и видео

---

## 📁 Структура проекта

```
AiVerse-Telegram-App/
├── apps/
│   ├── telegram/           # React Web (Vite) — Telegram Mini App + Web App
│   │   ├── src/
│   │   │   ├── components/ # UI компоненты
│   │   │   ├── pages/      # Страницы (Studio, Feed, Profile, Settings, etc)
│   │   │   └── store/      # Zustand stores
│   │   └── public/         # Статика, локализации, docs
│   │
│   └── mobile/             # React Native (Expo) — Mobile App (в разработке)
│       ├── App.tsx
│       └── package.json
│
├── packages/
│   └── shared/             # Общий код для всех приложений
│       ├── stores/         # Zustand stores
│       ├── types/          # TypeScript типы
│       └── i18n/           # Локализации (ru, en, de, fr, es, ar)
│
├── api/                    # Express backend
│   ├── controllers/        # API контроллеры (17 модулей)
│   ├── routes/             # Роуты (auth, chat, events, proxy, etc.)
│   ├── services/           # Бизнес-логика (PIAPI, Supabase, Replicate, etc.)
│   └── server.ts           # Entry point
│
├── migrations/             # SQL миграции
├── scripts/                # Утилиты и скрипты
├── pnpm-workspace.yaml     # Workspaces config
├── Dockerfile              # Production build
└── railway.json            # Railway deploy config
```

---

## 🛠 Технологический стек

### Frontend (Web App / Telegram Mini App)
- **Framework**: React 18, TypeScript
- **Build**: Vite
- **Styling**: Tailwind CSS
- **State**: Zustand
- **i18n**: i18next (6 языков)
- **PWA**: vite-plugin-pwa, Service Workers
- **SDK**: @twa-dev/sdk, @telegram-apps/sdk
- **Auth**: Supabase Auth (Google OAuth, Email, Telegram Login)

### Frontend (Mobile — в разработке)
- **Framework**: React Native 0.81, Expo 54
- **Navigation**: Expo Router
- **State**: Zustand (shared)

### Backend
- **Runtime**: Node.js 22
- **Framework**: Express 4
- **Language**: TypeScript
- **Database**: PostgreSQL (Supabase)
- **AI APIs**: PIAPI (NanoBanana, SeeDream, Kling), WaveSpeed, Replicate
- **Payments**: Telegram Stars, Tribute Shop (Card payments)
- **Storage**: Supabase Storage, Cloudflare R2

### Infrastructure
- **Deploy**: Railway (unified service)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage + Cloudflare R2
- **CDN**: Cloudflare
- **Analytics**: Google Analytics 4

---

## 🏗 Установка и запуск

### Требования

- Node.js 22+
- pnpm (npm или yarn тоже работают)
- Для Mobile: Expo CLI, Android Studio / Xcode

### 1. Клонирование

```bash
git clone https://github.com/nmuhammads/AiVerse-Telegram-App.git
cd AiVerse-Telegram-App
```

### 2. Установка зависимостей

```bash
# Корневые зависимости
npm install

# Telegram Mini App / Web App
cd apps/telegram && npm install && cd ../..

# Mobile App (опционально)
cd apps/mobile && npm install && cd ../..
```

### 3. Настройка окружения

```bash
cp .env.example .env
```

**Основные переменные:**
```env
# AI API
PIAPI_KEY=your_piapi_key

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your_service_key
SUPABASE_ANON_KEY=your_anon_key

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
WEBAPP_URL=https://your-app.railway.app

# Auth
GOOGLE_CLIENT_ID=your_google_client_id

# Payments
TRIBUTE_API_KEY=your_tribute_key
TRIBUTE_TOKEN_CHARGING_ENABLED=false

# Server
PORT=3000
NODE_ENV=development
```

### 4. Запуск

```bash
# Backend + Frontend (unified)
npm run dev

# Только Web App / Telegram Mini App
cd apps/telegram && npm run dev

# Только Mobile App (Expo)
cd apps/mobile && npx expo start
```

---

## 📱 Сборка

### Web App (Production)

```bash
cd apps/telegram
npm run build
# Output: apps/telegram/dist/
```

### Mobile App (Development Build)

```bash
cd apps/mobile

# Android
npx expo run:android

# iOS (требуется Mac + Xcode)
npx expo run:ios
```

### Docker (Backend + Frontend)

```bash
docker build -t aiverse .
docker run -p 3000:3000 --env-file .env aiverse
```

---

## 🚀 Деплой

### Railway (рекомендуется)

Проект настроен для деплоя на Railway одним сервисом:
- Используется `Dockerfile` в корне
- Backend раздаёт статику фронтенда
- Настройки в `railway.json`

```bash
railway up
```

### Переменные окружения Railway

Добавьте в Railway Dashboard:
- `PIAPI_KEY`
- `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_ANON_KEY`
- `TELEGRAM_BOT_TOKEN`
- `WEBAPP_URL`
- `GOOGLE_CLIENT_ID`
- `TRIBUTE_API_KEY`
- `TRIBUTE_TOKEN_CHARGING_ENABLED=false`
- `NODE_ENV=production`

---

## 📖 API Документация

### Основные эндпоинты

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| POST | `/api/generation/generate` | Генерация изображения |
| POST | `/api/generation/video` | Генерация видео |
| GET | `/api/feed` | Лента публикаций |
| GET | `/api/user/:userId` | Профиль пользователя |
| POST | `/api/chat` | AI Chat сообщение |
| POST | `/api/chat/generate-image` | Генерация изображения через чат |
| POST | `/api/auth/signup` | Регистрация (Email) |
| POST | `/api/auth/login` | Вход (Email) |
| POST | `/api/auth/telegram-login` | Вход через Telegram |
| GET | `/api/auth/me` | Текущий пользователь |
| GET | `/api/avatars` | Список аватаров |
| POST | `/api/avatars` | Загрузка аватара |
| GET | `/api/events/active` | Активные события |

### Пример генерации

```bash
curl -X POST https://your-app.railway.app/api/generation/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "prompt": "a beautiful sunset over mountains",
    "model": "seedream4",
    "aspect_ratio": "16:9",
    "user_id": 123456789
  }'
```

---

## 🗂 Roadmap

- [x] Монорепо структура
- [x] Shared packages
- [x] Telegram Mini App
- [x] AI Chat с генерацией изображений
- [x] Генерация видео (Kling AI, Seedance Pro)
- [x] Редактор изображений (Inpainting, Angles, Watermarks)
- [x] Мультиязычность (6 языков)
- [x] Web App (PWA) — [aiverseapp.net](https://www.aiverseapp.net)
- [x] Google OAuth + Email Auth
- [x] Партнерская программа
- [x] Управление аватарами
- [x] Google Analytics
- [ ] Mobile App (iOS / Android) — в разработке
- [ ] Push-уведомления
- [ ] Публикация в App Store / Play Store

---

## 📄 Лицензия

MIT License

---

## 🔗 Ссылки

- 🌐 [Web App — aiverseapp.net](https://www.aiverseapp.net)
- 🤖 [Telegram Bot — @aiverse_bot](https://t.me/aiverse_bot)
- 📋 [Changelog](apps/telegram/public/docs/CHANGELOG.md)
