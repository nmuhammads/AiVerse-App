import type { Request, Response } from 'express'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : ''
const APP_URL = (
  process.env.WEBAPP_URL ||
  process.env.APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
  (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '') ||
  ''
)

async function tg(method: string, payload: Record<string, unknown>) {
  if (!API) return null
  const r = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  try { return await r.json() } catch { return null }
}

export async function webhook(req: Request, res: Response) {
  try {
    const update = req.body
    const msg = update?.message
    const chatId = msg?.chat?.id
    const text = String(msg?.text || '').trim()
    if (!chatId || !text) return res.json({ ok: true })
    if (text.startsWith('/start')) {
      const welcome = 'Добро пожаловать! Это мини‑приложение для генерации изображений ИИ.'
      const kb = APP_URL ? { inline_keyboard: [[{ text: 'Открыть приложение', web_app: { url: APP_URL } }]] } : undefined
      await tg('sendMessage', { chat_id: chatId, text: welcome, reply_markup: kb })
      return res.json({ ok: true })
    }
    if (text.startsWith('/home')) {
      if (APP_URL) {
        const kb = { inline_keyboard: [[{ text: 'Открыть приложение', web_app: { url: APP_URL } }]] }
        await tg('sendMessage', { chat_id: chatId, text: 'Открыть мини‑апп', reply_markup: kb })
      } else {
        await tg('sendMessage', { chat_id: chatId, text: 'URL приложения не настроен' })
      }
      return res.json({ ok: true })
    }
    return res.json({ ok: true })
  } catch {
    return res.json({ ok: true })
  }
}

export async function registerBotCommands() {
  if (!API) return
  const commands = [
    { command: 'start', description: 'Запуск и информация' },
    { command: 'home', description: 'Открыть мини‑приложение' },
  ]
  await tg('setMyCommands', { commands })
}

export async function setupCommands(req: Request, res: Response) {
  await registerBotCommands()
  res.json({ ok: true })
}
