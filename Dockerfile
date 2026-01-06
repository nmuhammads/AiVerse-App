# Используем Node.js 22 LTS как базовый образ
FROM node:22-alpine

# Устанавливаем fontconfig и шрифты для поддержки кириллицы в водяных знаках
RUN apk add --no-cache fontconfig font-noto font-noto-cjk ttf-dejavu \
    && fc-cache -fv

# Устанавливаем рабочую директорию
WORKDIR /app

# Устанавливаем pnpm глобально
RUN npm install -g pnpm

# Копируем все файлы проекта сразу
COPY . .

# Устанавливаем зависимости
RUN pnpm install --no-frozen-lockfile

# Build arguments для Vite переменных (Railway передаёт env vars как build args)
ARG VITE_DEV_MODE
ENV VITE_DEV_MODE=$VITE_DEV_MODE

# Собираем frontend
RUN pnpm run build

# Открываем порт
EXPOSE 3000

# Запускаем приложение
CMD ["pnpm", "start"]