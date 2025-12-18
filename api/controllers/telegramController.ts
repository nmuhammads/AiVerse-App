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

export async function tg(method: string, payload: Record<string, unknown>) {
  if (!API) return null
  const r = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  try { return await r.json() } catch { return null }
}

import { supaSelect, supaPatch, supaPost } from '../services/supabaseService.js'

export async function webhook(req: Request, res: Response) {
  try {
    if (WEBHOOK_SECRET) {
      const h = String(req.header('X-Telegram-Bot-API-Secret-Token') || '')
      if (h !== WEBHOOK_SECRET) {
        return res.status(403).json({ ok: false })
      }
    }
    const update = req.body

    // Handle Pre-Checkout Query (Required for Stars)
    if (update.pre_checkout_query) {
      const id = update.pre_checkout_query.id
      await tg('answerPreCheckoutQuery', { pre_checkout_query_id: id, ok: true })
      return res.json({ ok: true })
    }

    const msg = update?.message

    // Handle Successful Payment
    if (msg?.successful_payment) {
      const payment = msg.successful_payment
      const userId = msg.from?.id
      const payload = JSON.parse(payment.invoice_payload || '{}')
      const tokensToAdd = Number(payload.tokens || 0)
      const spinsToAdd = Number(payload.spins || 0)

      console.log(`[Payment] Successful payment from ${userId}, tokens: ${tokensToAdd}, spins: ${spinsToAdd}, payload:`, payload)

      if (userId && tokensToAdd > 0) {
        // Fetch current balance and spins
        const userQ = await supaSelect('users', `?user_id=eq.${userId}&select=balance,spins`)
        if (userQ.ok && userQ.data?.[0]) {
          const currentBalance = Number(userQ.data[0].balance || 0)
          const currentSpins = Number(userQ.data[0].spins || 0)
          const newBalance = currentBalance + tokensToAdd
          const newSpins = currentSpins + spinsToAdd

          // Update balance and spins
          const updateRes = await supaPatch('users', `?user_id=eq.${userId}`, {
            balance: newBalance,
            spins: newSpins
          })

          if (updateRes.ok) {
            const spinText = spinsToAdd > 0 ? `\n🎰 Бонус: +${spinsToAdd} ${spinsToAdd === 1 ? 'спин' : 'спина'} для Колеса Фортуны!` : ''
            await tg('sendMessage', { chat_id: userId, text: `✅ Оплата прошла успешно! Начислено ${tokensToAdd} токенов.${spinText}` })
          } else {
            console.error('[Payment] Failed to update balance', updateRes)
            await tg('sendMessage', { chat_id: userId, text: `⚠️ Оплата прошла, но возникла ошибка при начислении. Обратитесь в поддержку.` })
          }
        } else {
          console.error('[Payment] User not found', userId)
        }
      }
      return res.json({ ok: true })
    }

    const chatId = msg?.chat?.id
    const text = String(msg?.text || '').trim()
    if (!chatId || !text) return res.json({ ok: true })
    if (text.startsWith('/start')) {
      const parts = text.split(/\s+/)
      const param = parts.length > 1 ? parts[1] : ''

      // Handle referral: /start ref_username
      if (param.startsWith('ref_')) {
        const refValue = param.slice(4) // Remove "ref_"
        const userId = msg.from?.id
        if (userId && refValue) {
          // Check if user exists and has no ref
          const existing = await supaSelect('users', `?user_id=eq.${userId}&select=ref,user_id`)
          if (existing.ok && Array.isArray(existing.data) && existing.data[0]) {
            if (!existing.data[0].ref) {
              await supaPatch('users', `?user_id=eq.${userId}`, { ref: refValue })
              console.log(`[Referral/Webhook] Set ref=${refValue} for user ${userId}`)
            }
          } else {
            // New user - create with ref
            await supaPost('users', { user_id: userId, ref: refValue }, '?on_conflict=user_id')
            console.log(`[Referral/Webhook] Created user ${userId} with ref=${refValue}`)
          }
        }
        const info = '👋 Добро пожаловать в AI Verse!'
        const kb = { inline_keyboard: [[{ text: 'Открыть приложение', web_app: { url: APP_URL } }]] }
        await tg('sendMessage', { chat_id: chatId, text: info, reply_markup: kb })
        return res.json({ ok: true })
      }

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

    if (text.startsWith('/mycontest')) {
      const parts = text.split(/\s+/)
      let organizerName = parts.length > 1 ? parts.slice(1).join(' ') : ''

      if (!organizerName && msg.from?.username) {
        organizerName = msg.from.username
      }

      if (!organizerName) {
        await tg('sendMessage', { chat_id: chatId, text: 'Пожалуйста, укажите имя организатора: /mycontest <name> или установите username в Telegram.' })
        return res.json({ ok: true })
      }

      // Remove @ if present
      organizerName = organizerName.replace('@', '')

      // Find active contest
      const q = await supaSelect('contests', `?status=eq.active&organizer_name=ilike.${organizerName}&select=*`)

      if (q.ok && q.data && q.data.length > 0) {
        const contest = q.data[0]
        const caption = `🏆 <b>${contest.title}</b>\n\n${contest.description}\n\nЧтобы поставить лайк перейдите на гелерею\n\n👇 Жми кнопку ниже, чтобы участвовать или поставить лайк!`
        const deepLink = `contest-${contest.id}`

        // Get bot username dynamically
        let botUsername = 'AiVerseAppBot'
        try {
          const me = await tg('getMe', {})
          if (me?.ok && me.result?.username) {
            botUsername = me.result.username
          }
        } catch (e) {
          console.error('Failed to get bot username', e)
        }

        const url = `https://t.me/${botUsername}?startapp=${deepLink}`

        const kb = {
          inline_keyboard: [[
            { text: 'Участвовать🚀/Оценить❤️', url: url }
          ]]
        }

        if (contest.image_url) {
          await tg('sendPhoto', {
            chat_id: chatId,
            photo: contest.image_url,
            caption: caption,
            parse_mode: 'HTML',
            reply_markup: kb
          })
        } else {
          await tg('sendMessage', {
            chat_id: chatId,
            text: caption,
            parse_mode: 'HTML',
            reply_markup: kb
          })
        }
      } else {
        await tg('sendMessage', { chat_id: chatId, text: `Активный конкурс от организатора "${organizerName}" не найден.` })
      }
      return res.json({ ok: true })
    }
    return res.json({ ok: true })
  } catch (e) {
    console.error('webhook error', e)
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

    console.info('sendPhoto:start', { chat_id, caption_len: caption ? caption.length : 0, photo_preview: photo.slice(0, 128) })

    // 1. Try sending by URL (Telegram downloads)
    // This saves backend bandwidth, but still counts as Egress for the storage provider (Supabase/R2)
    if (photo.startsWith('http')) {
      console.info('sendPhoto:try_url')
      const resp = await tg('sendPhoto', { chat_id, photo, caption: finalCaption })
      if (resp?.ok) {
        if (restCaption) await sendRestCaption(chat_id, restCaption)
        return res.json({ ok: true, method: 'url' })
      }
      console.warn('sendPhoto:url_failed', resp)
    }

    // 2. Fallback: Download and Upload
    try {
      const imgResp = await fetch(photo)
      const contentType = imgResp.headers.get('content-type') || 'image/jpeg'
      console.info('sendPhoto:image_fetch', { status: imgResp.status, ct: contentType })
      if (!imgResp.ok) return res.status(400).json({ ok: false, error: 'image fetch failed', status: imgResp.status })

      const ab = await imgResp.arrayBuffer()
      const blob = new Blob([ab], { type: contentType })
      const ext = contentType.includes('png') ? 'png' : (contentType.includes('webp') ? 'webp' : 'jpg')
      const filename = `ai-${Date.now()}.${ext}`

      const form = new FormData()
      form.append('chat_id', String(chat_id))
      if (finalCaption) form.append('caption', finalCaption)
      form.append('photo', blob, filename)

      console.info('sendPhoto:upload_post', { filename })
      const r = await fetch(`${API}/sendPhoto`, { method: 'POST', body: form })
      const j = await r.json().catch(() => null)

      if (!j || j.ok !== true) return res.status(500).json({ ok: false, error: j?.description || 'telegram sendPhoto failed', resp: j })

      if (restCaption) await sendRestCaption(chat_id, restCaption)
      return res.json({ ok: true, method: 'upload' })
    } catch (e) {
      console.error('sendPhoto:upload_error', e)
      return res.status(500).json({ ok: false, error: (e as Error).message })
    }
  } catch (e) {
    console.error('sendPhoto:fatal_error', e)
    return res.status(500).json({ ok: false })
  }
}

async function sendRestCaption(chat_id: number, text: string) {
  const MAX_MSG = 4096
  let idx = 0
  while (idx < text.length) {
    const part = text.slice(idx, idx + MAX_MSG)
    idx += MAX_MSG
    await tg('sendMessage', { chat_id, text: part })
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

export async function sendRemixShare(req: Request, res: Response) {
  try {
    const chat_id = Number(req.body?.chat_id || 0)
    const photo = String(req.body?.photo_url || '')
    const generationId = Number(req.body?.generation_id || 0)
    const ownerUsername = req.body?.owner_username ? String(req.body.owner_username) : null
    const ownerUserId = req.body?.owner_user_id ? String(req.body.owner_user_id) : null
    const model = typeof req.body?.model === 'string' ? String(req.body.model) : null

    // Build caption with model name and author
    const authorText = ownerUsername ? `\n👤 Автор: @${ownerUsername}` : ''
    let caption = `✨ AI Verse${authorText}\n\nХочешь сделать так же? Жми кнопку «Повторить» ниже! 👇`
    if (model) {
      const modelNames: Record<string, string> = {
        'flux': 'Flux',
        'seedream4': 'Seedream 4',
        'seedream4-5': 'Seedream 4.5',
        'nanobanana': 'NanoBanana',
        'nanobanana-pro': 'NanoBanana Pro'
      }
      const displayName = modelNames[model] || model
      caption = `✨ AI Verse${authorText}\n🎨 Модель: ${displayName}\n\nХочешь сделать так же? Жми кнопку «Повторить» ниже! 👇`
    }

    if (!API || !chat_id || !photo || !generationId) {
      return res.status(400).json({ ok: false, error: 'invalid payload' })
    }

    // Get bot username dynamically
    let botUsername = 'AiVerseAppBot'
    try {
      const me = await tg('getMe', {})
      if (me?.ok && me.result?.username) {
        botUsername = me.result.username
      }
    } catch (e) {
      console.error('Failed to get bot username', e)
    }

    // Use username if available, otherwise use user_id
    const refValue = ownerUsername || ownerUserId || ''
    const remixUrl = refValue
      ? `https://t.me/${botUsername}?startapp=ref-${refValue}-remix-${generationId}`
      : `https://t.me/${botUsername}?startapp=remix-${generationId}`

    const kb = {
      inline_keyboard: [[
        { text: 'Повторить ↻', url: remixUrl }
      ]]
    }

    console.info('sendRemixShare:start', { chat_id, generationId, refValue })

    // Try sending photo with inline keyboard
    const resp = await tg('sendPhoto', {
      chat_id,
      photo,
      caption,
      reply_markup: kb
    })

    if (resp?.ok) {
      // Auto-publish the generation
      await supaPatch('generations', `?id=eq.${generationId}`, { is_published: true })
      console.info('sendRemixShare:success', { generationId, published: true })
      return res.json({ ok: true })
    }

    console.warn('sendRemixShare:failed', resp)
    return res.status(500).json({ ok: false, error: resp?.description || 'send failed' })
  } catch (e) {
    console.error('sendRemixShare error', e)
    return res.status(500).json({ ok: false })
  }
}
