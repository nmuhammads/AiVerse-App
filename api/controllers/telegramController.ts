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
      const parts = text.split(/\s+/)
      const param = parts.length > 1 ? parts[1] : ''
      if (APP_URL && (param === 'home' || param === 'generate' || param === 'studio' || param === 'top' || param === 'profile')) {
        const startVal = param === 'studio' ? 'generate' : param
        const url = startVal === 'home' ? APP_URL : `${APP_URL}?tgWebAppStartParam=${encodeURIComponent(startVal)}`
        const kb = { inline_keyboard: [[{ text: 'Открыть приложение', web_app: { url } }]] }
        await tg('sendMessage', { chat_id: chatId, text: 'Открыть мини‑апп', reply_markup: kb })
      } else {
        const info = 'AI Verse — мини‑приложение генерации изображений ИИ. Используйте /home чтобы открыть.'
        await tg('sendMessage', { chat_id: chatId, text: info })
      }
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
  await tg('deleteMyCommands', {})
}

export async function setupCommands(req: Request, res: Response) {
  await registerBotCommands()
  res.json({ ok: true })
}

export async function setupMenuButton(req: Request, res: Response) {
  if (!API || !APP_URL) {
    return res.status(400).json({ ok: false })
  }
  const startParam = 'generate'
  const url = `${APP_URL}?tgWebAppStartParam=${encodeURIComponent(startParam)}`
  const chat_id = typeof req.body?.chat_id === 'number' ? req.body.chat_id : undefined
  const resp = await tg('setChatMenuButton', {
    chat_id,
    menu_button: {
      type: 'web_app',
      text: 'AI Verse',
      web_app: { url }
    }
  })
  if (!resp || resp.ok !== true) {
    return res.status(500).json({ ok: false, resp })
  }
  res.json({ ok: true, resp })
}
