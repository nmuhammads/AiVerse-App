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
        const info = 'AI Verse — мини‑приложение генерации изображений ИИ.'
        const kb = { inline_keyboard: [[{ text: 'Открыть приложение', web_app: { url: APP_URL } }]] }
        await tg('sendMessage', { chat_id: chatId, text: info, reply_markup: kb })
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

export async function sendPhoto(req: Request, res: Response) {
  try {
    const chat_id = Number(req.body?.chat_id || 0)
    const photo = String(req.body?.photo_url || '')
    const caption = typeof req.body?.caption === 'string' ? String(req.body.caption) : undefined
    if (!API || !chat_id || !photo) return res.status(400).json({ ok: false, error: 'invalid payload' })
    const CAPTION_LIMIT = 1024
    const finalCaption = caption ? caption.slice(0, CAPTION_LIMIT) : undefined
    const restCaption = caption && caption.length > CAPTION_LIMIT ? caption.slice(CAPTION_LIMIT) : ''
    console.info('sendPhoto:start', { chat_id, caption_len: caption ? caption.length : 0, trimmed_len: finalCaption ? finalCaption.length : 0, rest_len: restCaption.length, photo_preview: photo.slice(0, 128) })
    try {
      const imgResp = await fetch(photo)
      const contentType = imgResp.headers.get('content-type') || 'image/jpeg'
      const clen = imgResp.headers.get('content-length')
      console.info('sendPhoto:image_fetch', { status: imgResp.status, ct: contentType, content_length: clen })
      if (!imgResp.ok) return res.status(400).json({ ok: false, error: 'image fetch failed', status: imgResp.status, ct: contentType })
      const ab = await imgResp.arrayBuffer()
      const blob = new Blob([ab], { type: contentType })
      const ext = contentType.includes('png') ? 'png' : (contentType.includes('webp') ? 'webp' : 'jpg')
      const filename = `ai-${Date.now()}.${ext}`
      const form = new FormData()
      form.append('chat_id', String(chat_id))
      if (finalCaption) form.append('caption', finalCaption)
      form.append('photo', blob, filename)
      console.info('sendPhoto:upload_post', { filename, ct: contentType })
      const r = await fetch(`${API}/sendPhoto`, { method: 'POST', body: form })
      const j = await r.json().catch(() => null)
      console.info('sendPhoto:upload_resp', { ok: j?.ok === true, desc: j?.description, error_code: j?.error_code })
      if (!j || j.ok !== true) return res.status(500).json({ ok: false, error: j?.description || 'telegram sendPhoto failed', resp: j })
      if (restCaption && restCaption.length > 0) {
        const MAX_MSG = 4096
        let idx = 0
        while (idx < restCaption.length) {
          const part = restCaption.slice(idx, idx + MAX_MSG)
          idx += MAX_MSG
          const m = await tg('sendMessage', { chat_id, text: part })
          console.info('sendPhoto:rest_caption_msg', { ok: m?.ok === true, len: part.length })
        }
      }
      return res.json({ ok: true })
    } catch (e) {
      console.warn('sendPhoto:upload_error', { message: (e as Error)?.message })
      const resp = await tg('sendPhoto', { chat_id, photo, caption: finalCaption })
      console.info('sendPhoto:fallback_url_resp', { ok: resp?.ok === true, desc: resp?.description, error_code: resp?.error_code })
      if (!resp || resp.ok !== true) return res.status(500).json({ ok: false, error: resp?.description || 'telegram sendPhoto failed', resp })
      if (restCaption && restCaption.length > 0) {
        const MAX_MSG = 4096
        let idx = 0
        while (idx < restCaption.length) {
          const part = restCaption.slice(idx, idx + MAX_MSG)
          idx += MAX_MSG
          const m = await tg('sendMessage', { chat_id, text: part })
          console.info('sendPhoto:rest_caption_msg', { ok: m?.ok === true, len: part.length })
        }
      }
      return res.json({ ok: true })
    }
  } catch {
    return res.status(500).json({ ok: false })
  }
}

export async function sendDocument(req: Request, res: Response) {
  try {
    const chat_id = Number(req.body?.chat_id || 0)
    const url = String(req.body?.file_url || req.body?.document_url || req.body?.photo_url || '')
    const caption = typeof req.body?.caption === 'string' ? String(req.body.caption) : undefined
    if (!API || !chat_id || !url) return res.status(400).json({ ok: false, error: 'invalid payload' })
    const textWhole = caption || ''
    console.info('sendDocument:start', { chat_id, caption_len: textWhole.length, url_preview: url.slice(0, 128) })
    try {
      const resp = await fetch(url)
      const contentType = resp.headers.get('content-type') || 'application/octet-stream'
      const clen = resp.headers.get('content-length')
      console.info('sendDocument:file_fetch', { status: resp.status, ct: contentType, content_length: clen })
      if (!resp.ok) return res.status(400).json({ ok: false, error: 'file fetch failed', status: resp.status, ct: contentType })
      const ab = await resp.arrayBuffer()
      const blob = new Blob([ab], { type: contentType })
      const ext = contentType.includes('png') ? 'png' : (contentType.includes('jpeg') || contentType.includes('jpg')) ? 'jpg' : (contentType.includes('webp') ? 'webp' : 'bin')
      const filename = `ai-${Date.now()}.${ext}`
      const form = new FormData()
      form.append('chat_id', String(chat_id))
      form.append('document', blob, filename)
      console.info('sendDocument:upload_post', { filename, ct: contentType })
      const r = await fetch(`${API}/sendDocument`, { method: 'POST', body: form })
      const j = await r.json().catch(() => null)
      console.info('sendDocument:upload_resp', { ok: j?.ok === true, desc: j?.description, error_code: j?.error_code })
      if (!j || j.ok !== true) return res.status(500).json({ ok: false, error: j?.description || 'telegram sendDocument failed', resp: j })
      const msgId = j?.result?.message_id
      if (textWhole && textWhole.length > 0) {
        const MAX_MSG = 4096
        let idx = 0
        while (idx < textWhole.length) {
          const part = textWhole.slice(idx, idx + MAX_MSG)
          idx += MAX_MSG
          const m = await tg('sendMessage', { chat_id, text: part, reply_to_message_id: msgId })
          console.info('sendDocument:caption_reply_msg', { ok: m?.ok === true, len: part.length, reply_to_message_id: msgId })
        }
      }
      return res.json({ ok: true })
    } catch (e) {
      console.warn('sendDocument:upload_error', { message: (e as Error)?.message })
      const j = await tg('sendDocument', { chat_id, document: url })
      console.info('sendDocument:fallback_url_resp', { ok: j?.ok === true, desc: j?.description, error_code: j?.error_code })
      if (!j || j.ok !== true) return res.status(500).json({ ok: false, error: j?.description || 'telegram sendDocument failed', resp: j })
      const msgId = j?.result?.message_id
      if (textWhole && textWhole.length > 0) {
        const MAX_MSG = 4096
        let idx = 0
        while (idx < textWhole.length) {
          const part = textWhole.slice(idx, idx + MAX_MSG)
          idx += MAX_MSG
          const m = await tg('sendMessage', { chat_id, text: part, reply_to_message_id: msgId })
          console.info('sendDocument:caption_reply_msg', { ok: m?.ok === true, len: part.length, reply_to_message_id: msgId })
        }
      }
      return res.json({ ok: true })
    }
  } catch {
    return res.status(500).json({ ok: false })
  }
}

export async function proxyDownload(req: Request, res: Response) {
  try {
    const src = String(req.query?.url || '')
    const nameParam = String(req.query?.name || '')
    if (!src) return res.status(400).json({ ok: false, error: 'missing url' })
    console.info('proxyDownload:start', { src: src.slice(0, 160), name: nameParam })
    const r = await fetch(src, { headers: { 'Accept': 'image/*;q=0.9, */*;q=0.1' } })
    if (!r.ok) {
      console.warn('proxyDownload:fetch_failed', { status: r.status })
      return res.status(400).json({ ok: false, error: 'fetch failed', status: r.status })
    }
    const ct = r.headers.get('content-type') || 'application/octet-stream'
    const ab = await r.arrayBuffer()
    const buf = Buffer.from(ab)
    const ext = (() => {
      if (ct.includes('png')) return 'png'
      if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg'
      if (ct.includes('webp')) return 'webp'
      return 'bin'
    })()
    const filename = nameParam || `image.${ext}`
    res.setHeader('Content-Type', ct)
    res.setHeader('Content-Length', String(buf.length))
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition')
    res.send(buf)
  } catch (e) {
    console.warn('proxyDownload:error', { message: (e as Error)?.message })
    res.status(500).json({ ok: false, error: 'proxy error' })
  }
}

export async function proxyDownloadHead(req: Request, res: Response) {
  try {
    const src = String(req.query?.url || '')
    const nameParam = String(req.query?.name || '')
    if (!src) return res.status(400).json({ ok: false, error: 'missing url' })
    console.info('proxyDownload:head', { src: src.slice(0, 160), name: nameParam })
    let r = await fetch(src, { method: 'HEAD' })
    if (!r.ok || !r.headers.get('content-length')) {
      r = await fetch(src, { headers: { Range: 'bytes=0-0' } })
    }
    if (!r.ok) {
      console.warn('proxyDownload:head_failed', { status: r.status })
      return res.status(400).json({ ok: false, error: 'head failed', status: r.status })
    }
    const ct = r.headers.get('content-type') || 'application/octet-stream'
    const clen = r.headers.get('content-length') || '0'
    const ext = (() => {
      if (ct.includes('png')) return 'png'
      if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg'
      if (ct.includes('webp')) return 'webp'
      return 'bin'
    })()
    const filename = nameParam || `image.${ext}`
    res.setHeader('Content-Type', ct)
    res.setHeader('Content-Length', clen)
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition')
    res.status(200).end()
  } catch (e) {
    console.warn('proxyDownload:head_error', { message: (e as Error)?.message })
    res.status(500).json({ ok: false, error: 'proxy head error' })
  }
}

export async function logDownload(req: Request, res: Response) {
  try {
    const body = req.body || {}
    const stage = String(body.stage || 'unknown')
    const payload = {
      stage,
      platform: body.platform,
      version: body.version,
      hasDownloadFile: body.hasDownloadFile,
      name: body.name,
      rawUrl: typeof body.rawUrl === 'string' ? String(body.rawUrl).slice(0, 200) : undefined,
      proxyUrl: typeof body.proxyUrl === 'string' ? String(body.proxyUrl).slice(0, 200) : undefined,
      head: body.head,
      error: body.error ? String(body.error).slice(0, 500) : undefined
    }
    console.info('webapp:download_log', payload)
    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ ok: false })
  }
}
