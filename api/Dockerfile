# Используем Node.js 22 LTS как базовый образ
FROM node:22-alpine

# Устанавливаем зависимости для сборки canvas и другие утилиты
# python3, make, g++ - для node-gyp (canvas)
# cairo, pango, libjpeg, giflib, librsvg - для canvas
# fontconfig, fonts - для кириллицы в водяных знаках
# ffmpeg - для обработки видео
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

# Копируем package.json и package-lock.json
COPY package.json package-lock.json* ./

# Устанавливаем зависимости
RUN npm install

# Копируем остальные файлы
COPY . .

# Открываем порт
EXPOSE 3000

# Запускаем приложение
CMD ["npm", "run", "start"]
