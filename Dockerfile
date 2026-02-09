# Используем Node.js 22 LTS как базовый образ
FROM node:22-alpine

# Устанавливаем зависимости для canvas, шрифты и ffmpeg
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    libjpeg-turbo-dev \
    giflib-dev \
    librsvg-dev \
    pixman-dev \
    fontconfig \
    font-noto \
    font-noto-cjk \
    ttf-dejavu \
    ffmpeg \
    && fc-cache -fv

# Устанавливаем рабочую директорию
WORKDIR /app

# Устанавливаем pnpm глобально
RUN npm install -g pnpm

# Копируем файлы конфигурации для установки зависимостей
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY apps/telegram/package.json ./apps/telegram/
COPY api/package.json ./api/
COPY packages/shared/package.json ./packages/shared/

# Устанавливаем зависимости
RUN pnpm install --no-frozen-lockfile

# Копируем все файлы проекта
COPY . .

# Build arguments для Vite переменных
ARG VITE_DEV_MODE
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_DEV_MODE=$VITE_DEV_MODE
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Собираем frontend (apps/telegram -> dist в корне)
RUN pnpm --filter telegram build

# Копируем собранный фронтенд в api/dist для раздачи
RUN mkdir -p api/dist && cp -r apps/telegram/dist/* api/dist/

# Логирование для отладки
RUN echo "=== Build complete ===" && \
    echo "Node version:" && node --version && \
    echo "PNPM version:" && pnpm --version && \
    echo "API directory contents:" && ls -la /app/api && \
    echo "Checking start script:" && cat /app/api/package.json | grep -A5 '"scripts"'

# Открываем порт
EXPOSE 3000

# Запускаем API сервер с отладочным выводом
WORKDIR /app/api
CMD ["sh", "-c", "echo 'Starting server...' && echo 'Current directory:' && pwd && echo 'Files:' && ls -la && pnpm start"]