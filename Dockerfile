# Используем Node.js 18 как базовый образ
FROM node:18-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Устанавливаем pnpm глобально
RUN npm install -g pnpm

# Копируем все файлы проекта сразу
COPY . .

# Устанавливаем зависимости
RUN pnpm install --frozen-lockfile

# Собираем frontend
RUN pnpm run build

# Открываем порт
EXPOSE 3000

# Запускаем приложение
CMD ["pnpm", "start"]