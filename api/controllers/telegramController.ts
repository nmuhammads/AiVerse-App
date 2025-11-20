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
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || ''

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
    if (WEBHOOK_SECRET) {
      const h = String(req.header('X-Telegram-Bot-API-Secret-Token') || '')
      if (h !== WEBHOOK_SECRET) {
        return res.status(403).json({ ok: false })
      }
    }
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
  if (!API) {
    console.error('registerBotCommands: Missing API');
    return;
  }
  console.log('registerBotCommands: Deleting bot commands');
  const resp = await tg('deleteMyCommands', { scope: { type: 'default' } });
  if (resp?.ok) {
    console.log('registerBotCommands: Successfully deleted commands');
  } else {
    console.error('registerBotCommands: Failed to delete commands', resp);
  }
}

export async function setupCommands(req: Request, res: Response) {
  await registerBotCommands()
  res.json({ ok: true })
}

export async function setupMenuButton(req?: Request, res?: Response) {
  try {
    if (!API || !APP_URL) {
      console.error('setupMenuButton: Missing API or APP_URL');
      if (res) return res.status(400).json({ ok: false });
      return { ok: false };
    }
    const startParam = 'generate';
    const url = `${APP_URL}?tgWebAppStartParam=${encodeURIComponent(startParam)}`;
    const chat_id = req && typeof req.body?.chat_id === 'number' ? req.body.chat_id : undefined;
    console.log(`setupMenuButton: Attempting to set menu button with URL: ${url}` + (chat_id ? ` for chat ${chat_id}` : ' globally'));
    const resp = await tg('setChatMenuButton', {
      chat_id,
      menu_button: {
        type: 'web_app',
        text: 'AI Verse',
        web_app: { url }
      }
    });
    if (!resp || resp.ok !== true) {
      console.error('setupMenuButton: Failed to set menu button', resp);
      if (res) return res.status(500).json({ ok: false, resp });
      return { ok: false, resp };
    }
    console.log('setupMenuButton: Successfully set menu button', resp);
    if (res) res.json({ ok: true, resp });
    return { ok: true, resp };
  } catch (error) {
    console.error('setupMenuButton: Error', error);
    if (res) return res.status(500).json({ ok: false, error });
    return { ok: false, error };
  }
}

export async function setupWebhook(req?: Request, res?: Response) {
  try {
    if (!API || !APP_URL) {
      console.error('setupWebhook: Missing API or APP_URL');
      if (res) return res.status(400).json({ ok: false });
      return { ok: false };
    }
    const url = `${APP_URL}/api/telegram/webhook`
    const payload: { url: string; drop_pending_updates: boolean; secret_token?: string } = {
      url,
      drop_pending_updates: true,
    }
    if (WEBHOOK_SECRET) payload.secret_token = WEBHOOK_SECRET
    console.log('setupWebhook: Setting webhook to', url)
    const resp = await tg('setWebhook', payload)
    if (!resp || resp.ok !== true) {
      console.error('setupWebhook: Failed to set webhook', resp)
      if (res) return res.status(500).json({ ok: false, resp })
      return { ok: false, resp }
    }
    if (res) res.json({ ok: true, resp })
    return { ok: true, resp }
  } catch (error) {
    console.error('setupWebhook: Error', error)
    if (res) return res.status(500).json({ ok: false, error })
    return { ok: false, error }
  }
}

export async function logBotInfo() {
  try {
    const resp = await tg('getMe', {})
    if (resp?.ok) {
      console.log('Bot info:', resp.result)
    } else {
      console.warn('getMe failed', resp)
    }
  } catch (e) {
    console.warn('getMe error', e)
  }
}
