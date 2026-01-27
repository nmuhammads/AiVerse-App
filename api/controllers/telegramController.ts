import type { Request, Response } from 'express'
import sharp from 'sharp'
import { isPromoActive, calculateBonusTokens, getBonusAmount } from '../utils/promoUtils.js'
import { addFingerprint } from '../utils/fingerprint.js'
import { applyTextWatermark, applyImageWatermark } from '../utils/watermark.js'

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

    // Special Logger for User 817308975 to capture file_ids
    if (msg?.from?.id === 817308975) {
      if (msg.video) {
        console.log(`[AdminLog] Video from 817308975: file_id=${msg.video.file_id}, unique_id=${msg.video.file_unique_id}`)
      }
      if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
        const largest = msg.photo[msg.photo.length - 1]
        console.log(`[AdminLog] Photo from 817308975: file_id=${largest.file_id}, unique_id=${largest.file_unique_id}`)
      }
      if (msg.document) {
        console.log(`[AdminLog] Document from 817308975: file_id=${msg.document.file_id}, name=${msg.document.file_name}`)
      }
    }

    // Handle Successful Payment
    if (msg?.successful_payment) {
      const payment = msg.successful_payment
      const userId = msg.from?.id
      const payload = JSON.parse(payment.invoice_payload || '{}')
      const baseTokens = Number(payload.tokens || 0)
      const spinsToAdd = Number(payload.spins || 0)

      // Apply New Year promo bonus (+20%)
      const promoActive = isPromoActive()
      const tokensToAdd = promoActive ? calculateBonusTokens(baseTokens) : baseTokens
      const bonusTokens = promoActive ? getBonusAmount(baseTokens) : 0

      console.log(`[Payment] Successful payment from ${userId}, base: ${baseTokens}, bonus: ${bonusTokens}, total: ${tokensToAdd}, promoActive: ${promoActive}, spins: ${spinsToAdd}, payload:`, payload)

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
            const promoText = promoActive ? `\n(Включая новогодний бонус +${bonusTokens} 🎁)` : ''
            await tg('sendMessage', { chat_id: userId, text: `✅ Оплата прошла успешно! Начислено ${tokensToAdd} токенов.${promoText}${spinText}` })
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
      console.log('[MyContest] Command received from chat:', chatId, 'text:', text)
      const parts = text.split(/\s+/)
      let organizerName = parts.length > 1 ? parts.slice(1).join(' ') : ''

      console.log('[MyContest] Parsed organizerName from command:', organizerName, 'username from msg:', msg.from?.username)

      if (!organizerName && msg.from?.username) {
        organizerName = msg.from.username
      }

      if (!organizerName) {
        console.log('[MyContest] No organizer name provided')
        await tg('sendMessage', { chat_id: chatId, text: 'Пожалуйста, укажите имя организатора: /mycontest <name> или установите username в Telegram.' })
        return res.json({ ok: true })
      }

      // Remove @ if present
      organizerName = organizerName.replace('@', '')
      console.log('[MyContest] Final organizerName:', organizerName)

      // Find active contest
      const query = `?status=eq.active&organizer_name=ilike.${encodeURIComponent(organizerName)}&select=*`
      console.log('[MyContest] Supabase query:', query)
      const q = await supaSelect('contests', query)
      console.log('[MyContest] Supabase result:', { ok: q.ok, dataLength: q.data?.length, data: q.data })

      if (q.ok && q.data && q.data.length > 0) {
        const contest = q.data[0]
        console.log('[MyContest] Found contest:', { id: contest.id, title: contest.title, has_image: !!contest.image_url })
        const caption = `🏆 <b>${contest.title}</b>\n\n${contest.description}\n\nЧтобы поставить лайк перейдите на галерею\n\n👇 Жми кнопку ниже, чтобы участвовать или поставить лайк!`
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
        console.log('[MyContest] Deep link URL:', url)

        const kb = {
          inline_keyboard: [[
            { text: 'Участвовать🚀/Оценить❤️', url: url }
          ]]
        }

        let sendResult
        if (contest.image_url) {
          console.log('[MyContest] Sending photo with image_url:', contest.image_url)
          sendResult = await tg('sendPhoto', {
            chat_id: chatId,
            photo: contest.image_url,
            caption: caption,
            parse_mode: 'HTML',
            reply_markup: kb
          })
          console.log('[MyContest] sendPhoto result:', sendResult)

          // Fallback: если sendPhoto не удался, отправляем текст
          if (!sendResult?.ok) {
            console.log('[MyContest] sendPhoto failed, falling back to sendMessage')
            sendResult = await tg('sendMessage', {
              chat_id: chatId,
              text: caption,
              parse_mode: 'HTML',
              reply_markup: kb
            })
            console.log('[MyContest] fallback sendMessage result:', sendResult)
          }
        } else {
          console.log('[MyContest] Sending message (no image)')
          sendResult = await tg('sendMessage', {
            chat_id: chatId,
            text: caption,
            parse_mode: 'HTML',
            reply_markup: kb
          })
          console.log('[MyContest] Send result:', sendResult)
        }
      } else {
        console.log('[MyContest] No contest found for organizer:', organizerName)
        const sendResult = await tg('sendMessage', { chat_id: chatId, text: `Активный конкурс от организатора "${organizerName}" не найден.` })
        console.log('[MyContest] Send error message result:', sendResult)
      }
      return res.json({ ok: true })
    }

    // Admin command: /switch_api - Switch NanoBanana Pro API provider
    const ADMIN_ID = 817308975
    if (text.startsWith('/switch_api') && msg.from?.id === ADMIN_ID) {
      try {
        const { switchNanobananaApiProvider } = await import('./generationController.js')
        const newProvider = await switchNanobananaApiProvider()
        await tg('sendMessage', {
          chat_id: chatId,
          text: `✅ NanoBanana Pro API переключен на: *${newProvider.toUpperCase()}*\n\nТекущий провайдер будет использоваться для новых генераций.`,
          parse_mode: 'Markdown'
        })
      } catch (e) {
        console.error('[SwitchAPI] Error:', e)
        await tg('sendMessage', {
          chat_id: chatId,
          text: `❌ Ошибка переключения API: ${(e as Error).message}`
        })
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
  try {
    console.log('registerBotCommands: Deleting bot commands');
    const resp = await tg('deleteMyCommands', { scope: { type: 'default' } });
    if (resp?.ok) {
      console.log('registerBotCommands: Successfully deleted commands');
    } else {
      console.error('registerBotCommands: Failed to delete commands', resp);
    }
  } catch (error) {
    console.error('registerBotCommands: Network error', (error as Error).message);
    throw error; // Re-throw for retry logic in server.ts
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

      // Determine extension based on content-type (including video)
      const isVideo = contentType.includes('video/') || contentType.includes('mp4')
      const ext = (() => {
        if (contentType.includes('mp4') || contentType.includes('video/mp4')) return 'mp4'
        if (contentType.includes('webm')) return 'webm'
        if (contentType.includes('png')) return 'png'
        if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg'
        if (contentType.includes('webp')) return 'webp'
        if (contentType.includes('gif')) return 'gif'
        return 'bin'
      })()
      const filename = `ai-${Date.now()}.${ext}`

      const form = new FormData()
      form.append('chat_id', String(chat_id))

      // Use sendVideo for video files, sendDocument for others
      const method = isVideo ? 'sendVideo' : 'sendDocument'
      const fieldName = isVideo ? 'video' : 'document'
      form.append(fieldName, blob, filename)

      console.info(`${method}:upload_post`, { filename, ct: contentType, isVideo })
      const r = await fetch(`${API}/${method}`, { method: 'POST', body: form })
      const j = await r.json().catch(() => null)
      console.info(`${method}:upload_resp`, { ok: j?.ok === true, desc: j?.description, error_code: j?.error_code })
      if (!j || j.ok !== true) return res.status(500).json({ ok: false, error: j?.description || `telegram ${method} failed`, resp: j })
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
  console.log('[proxyDownload] === REQUEST RECEIVED ===')
  try {
    const src = String(req.query?.url || '')
    const nameParam = String(req.query?.name || '')
    console.log('[proxyDownload] URL:', src.slice(0, 200))
    console.log('[proxyDownload] Name param:', nameParam)

    if (!src) {
      console.log('[proxyDownload] ERROR: missing url')
      return res.status(400).json({ ok: false, error: 'missing url' })
    }

    console.log('[proxyDownload] Fetching from source...')
    const r = await fetch(src, { headers: { 'Accept': '*/*' } })
    console.log('[proxyDownload] Fetch status:', r.status)

    if (!r.ok) {
      console.warn('[proxyDownload] Fetch failed:', { status: r.status })
      return res.status(400).json({ ok: false, error: 'fetch failed', status: r.status })
    }

    const ct = r.headers.get('content-type') || 'application/octet-stream'
    console.log('[proxyDownload] Content-Type:', ct)

    const ab = await r.arrayBuffer()
    const buf = Buffer.from(ab)
    console.log('[proxyDownload] Buffer size:', buf.length)

    const ext = (() => {
      if (ct.includes('mp4') || ct.includes('video/mp4')) return 'mp4'
      if (ct.includes('webm')) return 'webm'
      if (ct.includes('png')) return 'png'
      if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg'
      if (ct.includes('webp')) return 'webp'
      if (ct.includes('gif')) return 'gif'
      return 'bin'
    })()
    console.log('[proxyDownload] Extension:', ext)

    const filename = nameParam || `ai-${Date.now()}.${ext}`
    res.setHeader('Content-Type', ct)
    res.setHeader('Content-Length', String(buf.length))
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition')

    console.log('[proxyDownload] Sending response, size:', buf.length)
    res.send(buf)
    console.log('[proxyDownload] === DONE ===')
  } catch (e) {
    console.error('[proxyDownload] ERROR:', (e as Error)?.message)
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
    const video = String(req.body?.video_url || '')
    const generationId = Number(req.body?.generation_id || 0)
    const ownerUsername = req.body?.owner_username ? String(req.body.owner_username) : null
    const ownerUserId = req.body?.owner_user_id ? String(req.body.owner_user_id) : null
    const model = typeof req.body?.model === 'string' ? String(req.body.model) : null

    if (!API || !chat_id || (!photo && !video) || !generationId) {
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

    // Build caption with model name, author, and remix link
    const authorText = ownerUsername ? `\n👤 Автор: @${ownerUsername}` : ''
    const remixLink = `<a href="${remixUrl}">Повторить ↻</a>`
    let caption = `✨ AI Verse${authorText}\n\nХочешь сделать так же? Жми ${remixLink} 👇`
    if (model) {
      const modelNames: Record<string, string> = {
        'flux': 'Flux',
        'seedream4': 'Seedream 4',
        'seedream4-5': 'Seedream 4.5',
        'nanobanana': 'NanoBanana',
        'nanobanana-pro': 'NanoBanana Pro',
        'seedance-1.5-pro': 'Seedance Pro'
      }
      const displayName = modelNames[model] || model
      caption = `✨ AI Verse${authorText}\n🎨 Модель: ${displayName}\n\nХочешь сделать так же? Жми ${remixLink} 👈 👇`
    }

    const kb = {
      inline_keyboard: [[
        { text: 'Повторить ↻', url: remixUrl }
      ]]
    }

    console.info('sendRemixShare:start', { chat_id, generationId, refValue, isVideo: !!video })

    // Determine method and media url
    const method = video ? 'sendVideo' : 'sendPhoto'
    const mediaUrl = video || photo
    const mediaKey = video ? 'video' : 'photo'

    // Try sending with inline keyboard by URL
    const payload: any = {
      chat_id,
      caption,
      parse_mode: 'HTML',
      reply_markup: kb
    }
    payload[mediaKey] = mediaUrl

    const resp = await tg(method, payload)

    if (resp?.ok) {
      // Auto-publish the generation
      await supaPatch('generations', `?id=eq.${generationId}`, { is_published: true })
      console.info('sendRemixShare:success', { generationId, published: true })
      return res.json({ ok: true })
    }

    console.warn('sendRemixShare:url_failed', resp)

    // Fallback: Download and upload image directly (for expired URLs like tempfile.aiquickdraw.com)
    try {
      console.info('sendRemixShare:fallback_upload', { mediaUrl: mediaUrl.slice(0, 128), type: mediaKey })
      const imgResp = await fetch(mediaUrl)
      if (!imgResp.ok) {
        console.error('sendRemixShare:media_fetch_failed', { status: imgResp.status })
        return res.status(500).json({ ok: false, error: 'media fetch failed', status: imgResp.status })
      }

      const ab = await imgResp.arrayBuffer()
      const originalSize = ab.byteLength
      const MAX_FILE_SIZE = 48 * 1024 * 1024 // 48MB (Telegram bot api limit is 50MB)

      let fileBuffer: Buffer
      let filename: string
      let contentType: string

      const ct = imgResp.headers.get('content-type') || (video ? 'video/mp4' : 'image/jpeg')
      const isVideoContentType = ct.includes('video/') || ct.includes('mp4')

      if (originalSize > MAX_FILE_SIZE && !isVideoContentType) {
        // Compress large images with sharp (cannot compress video easily without ffmpeg)
        console.info('sendRemixShare:compressing_image', { originalSize })
        fileBuffer = await sharp(Buffer.from(ab))
          .jpeg({ quality: 85 })
          .toBuffer()
        filename = `ai-${Date.now()}.jpg`
        contentType = 'image/jpeg'
        console.info('sendRemixShare:compressed', { newSize: fileBuffer.length })
      } else {
        fileBuffer = Buffer.from(ab)
        const ext = (() => {
          if (ct.includes('mp4') || ct.includes('video/mp4')) return 'mp4'
          if (ct.includes('webm')) return 'webm'
          if (ct.includes('png')) return 'png'
          if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg'
          if (ct.includes('webp')) return 'webp'
          if (ct.includes('gif')) return 'gif'
          return 'bin'
        })()
        filename = `ai-${Date.now()}.${ext}`
        contentType = ct
      }

      const blob = new Blob([new Uint8Array(fileBuffer)], { type: contentType })

      const form = new FormData()
      form.append('chat_id', String(chat_id))
      form.append('caption', caption)
      form.append('parse_mode', 'HTML')
      // Append fields dynamically based on type
      const method = isVideoContentType ? 'sendVideo' : 'sendPhoto'
      const fieldName = isVideoContentType ? 'video' : 'photo'
      form.append(fieldName, blob, filename)
      form.append('reply_markup', JSON.stringify(kb))

      const r = await fetch(`${API}/${method}`, { method: 'POST', body: form })
      const j = await r.json().catch(() => null)

      if (j?.ok) {
        // Auto-publish the generation
        await supaPatch('generations', `?id=eq.${generationId}`, { is_published: true })
        console.info('sendRemixShare:fallback_success', { generationId, published: true })
        return res.json({ ok: true })
      }

      console.error('sendRemixShare:fallback_failed', j)
      return res.status(500).json({ ok: false, error: j?.description || 'fallback upload failed' })
    } catch (uploadError) {
      console.error('sendRemixShare:fallback_error', uploadError)
      return res.status(500).json({ ok: false, error: (uploadError as Error).message })
    }
  } catch (e) {
    console.error('sendRemixShare error', e)
    return res.status(500).json({ ok: false })
  }
}

// Model → Hashtag mapping
const MODEL_HASHTAGS: Record<string, string> = {
  'nanobanana': '#NanoBanana',
  'nanobanana-pro': '#NanoBananaPro',
  'seedream4': '#Seedream4',
  'seedream4-5': '#SeedreamPRO',
  'gpt-image-1.5': '#GPTImage',
  'gptimage1.5': '#GPTImage', // DB value
  'seedance-1.5-pro': '#Seedance',
}

// Model → Bot mapping
const MODEL_BOTS: Record<string, string> = {
  'nanobanana': 'BananNanoBot',
  'nanobanana-pro': 'BananNanoBot',
  'seedream4': 'seedreameditbot',
  'seedream4-5': 'seedreameditbot',
  'gpt-image-1.5': 'GPTimagePro_bot',
  'gptimage1.5': 'GPTimagePro_bot', // DB value
  'seedance-1.5-pro': 'seedancepro_bot',
}

// Escape HTML special characters
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Send generation to chat with prompt (Feature 5: Invisible Fingerprint)
 * Uses HTML parse_mode for better stability with expandable blockquotes
 */
export async function sendWithPrompt(req: Request, res: Response) {
  try {
    const chat_id = Number(req.body?.chat_id || 0)
    const photo = String(req.body?.photo_url || '')
    const video = String(req.body?.video_url || '')
    const prompt = String(req.body?.prompt || '')
    const model = String(req.body?.model || '')
    const username = req.body?.username ? String(req.body.username).replace(/^@/, '') : null
    const userId = Number(req.body?.user_id || 0)

    if (!API || !chat_id || (!photo && !video)) {
      return res.status(400).json({ ok: false, error: 'invalid payload' })
    }

    // Get hashtag for model
    const hashtag = MODEL_HASHTAGS[model] || '#AIVerse'

    // Get bot for model
    const botName = MODEL_BOTS[model] || 'AiVerseAppBot'

    // Build ref link
    const refParam = username || String(userId)
    const botLink = `https://t.me/${botName}?start=ref_${refParam}`
    const appLink = `https://t.me/AiVerseAppBot?start=ref_${refParam}`

    // Add fingerprint to prompt
    const promptWithFingerprint = prompt ? addFingerprint(prompt, username, userId) : ''

    // Format parts
    const headerHtml = `${hashtag}\n\n🎨 Создай похожее:\nВ боте - <a href="${botLink}">@${botName}</a>\nВ приложении - <a href="${appLink}">📱 AiVerse App</a>`

    // Build full caption to check length
    // HTML format: <blockquote expandable>text</blockquote>
    const promptHtml = promptWithFingerprint
      ? `\n\n💬 Промпт:\n<blockquote expandable>${escapeHtml(promptWithFingerprint)}</blockquote>`
      : ''

    const fullCaption = headerHtml + promptHtml
    const isCaptionTooLong = fullCaption.length > 1024

    // Use short caption if too long (only header)
    const caption = isCaptionTooLong ? headerHtml : fullCaption

    console.info('sendWithPrompt:start', {
      chat_id,
      model,
      promptLen: prompt.length,
      fullCaptionLen: fullCaption.length,
      isCaptionTooLong,
      isVideo: !!video
    })

    // Determine method and media
    const method = video ? 'sendVideo' : 'sendPhoto'
    const mediaUrl = video || photo
    const mediaKey = video ? 'video' : 'photo'

    // Try sending with URL first
    const payload: Record<string, unknown> = {
      chat_id,
      [mediaKey]: mediaUrl,
      caption,
      parse_mode: 'HTML'
    }

    let resp = await tg(method, payload)
    let msgId = resp?.result?.message_id

    // Fallback: Download and upload if URL failed
    if (!resp?.ok) {
      console.warn('sendWithPrompt:url_failed', resp)
      try {
        const mediaResp = await fetch(mediaUrl)
        if (!mediaResp.ok) throw new Error('media fetch failed')

        const ab = await mediaResp.arrayBuffer()
        const ct = mediaResp.headers.get('content-type') || (video ? 'video/mp4' : 'image/jpeg')
        const isVideoContent = ct.includes('video/')
        const ext = isVideoContent ? 'mp4' : 'jpg' // simplified
        const filename = `ai-${Date.now()}.${ext}`
        const blob = new Blob([ab], { type: ct })

        const form = new FormData()
        form.append('chat_id', String(chat_id))
        form.append('caption', caption)
        form.append('parse_mode', 'HTML')
        form.append(isVideoContent ? 'video' : 'photo', blob, filename)

        const uploadMethod = isVideoContent ? 'sendVideo' : 'sendPhoto'
        const r = await fetch(`${API}/${uploadMethod}`, { method: 'POST', body: form })
        resp = await r.json().catch(() => null)
        msgId = resp?.result?.message_id

        if (!resp?.ok) {
          console.error('sendWithPrompt:fallback_failed', resp)
          return res.status(500).json({ ok: false, error: resp?.description || 'upload failed' })
        }
      } catch (e) {
        console.error('sendWithPrompt:fallback_error', e)
        return res.status(500).json({ ok: false, error: (e as Error).message })
      }
    }

    // If prompt was too long, send it as a reply message
    if (isCaptionTooLong && promptWithFingerprint && msgId) {
      console.info('sendWithPrompt:sending_separate_prompt')
      const text = `💬 Промпт:\n<blockquote expandable>${escapeHtml(promptWithFingerprint)}</blockquote>`

      // Split if even text message is too long (4096 limit)
      // But blockquote structure makes splitting hard. Just send what fits or rely on Telegram limits.
      // 4096 is usually enough for prompts (unless huge).

      await tg('sendMessage', {
        chat_id,
        text,
        parse_mode: 'HTML',
        reply_to_message_id: msgId
      })
    }

    return res.json({ ok: true })

  } catch (e) {
    console.error('sendWithPrompt error', e)
    return res.status(500).json({ ok: false })
  }
}

/**
 * Send generation to chat with watermark and refs (Feature 2: Watermark Overlay)
 * Downloads image, applies watermark from user settings, sends with refs
 */
export async function sendWithWatermark(req: Request, res: Response) {
  try {
    const chat_id = Number(req.body?.chat_id || 0)
    const photo = String(req.body?.photo_url || '')
    const prompt = String(req.body?.prompt || '')
    const model = String(req.body?.model || '')
    const username = req.body?.username ? String(req.body.username).replace(/^@/, '') : null
    const userId = Number(req.body?.user_id || 0)

    if (!API || !chat_id || !photo) {
      return res.status(400).json({ ok: false, error: 'invalid payload' })
    }

    // Get user's watermark settings
    const { data: watermarks } = await supaSelect('user_watermarks', `?user_id=eq.${userId}&is_active=eq.true&limit=1`)
    const watermark = watermarks?.[0]

    // Check if watermark is valid
    const isImageWatermark = (watermark?.type === 'ai_generated' || watermark?.type === 'custom') && watermark?.image_url
    const isTextWatermark = watermark?.text_content

    if (!watermark || (!isImageWatermark && !isTextWatermark)) {
      // No watermark settings, fallback to sendWithPrompt behavior
      return res.status(400).json({ ok: false, error: 'no_watermark_settings' })
    }

    console.info('sendWithWatermark:start', { chat_id, userId, hasWatermark: !!watermark, type: watermark.type })

    // Download image
    const imageResponse = await fetch(photo)
    if (!imageResponse.ok) {
      return res.status(400).json({ ok: false, error: 'failed_to_fetch_image' })
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

    // Apply watermark
    let watermarkedBuffer: Buffer
    if (isImageWatermark) {
      // Use image watermark (ai_generated or custom)
      const scale = watermark.font_size || 20

      watermarkedBuffer = await applyImageWatermark(
        imageBuffer,
        watermark.image_url,
        watermark.position || 'bottom-right',
        watermark.opacity ?? 0.5,
        scale
      )
    } else {
      // Use text watermark
      watermarkedBuffer = await applyTextWatermark(
        imageBuffer,
        watermark.text_content || '',
        watermark.position || 'bottom-right',
        watermark.opacity ?? 0.5,
        watermark.font_size || 48,
        watermark.font_color || '#FFFFFF'
      )
    }

    // Get hashtag and bot for model
    const hashtag = MODEL_HASHTAGS[model] || '#AIVerse'
    const botName = MODEL_BOTS[model] || 'AiVerseAppBot'

    // Build ref link
    const refParam = username || String(userId)
    const botLink = `https://t.me/${botName}?start=ref_${refParam}`
    const appLink = `https://t.me/AiVerseAppBot?start=ref_${refParam}`

    // Add fingerprint to prompt
    const promptWithFingerprint = prompt ? addFingerprint(prompt, username, userId) : ''

    // Format caption
    const headerHtml = `${hashtag}\n\n🎨 Создай похожее:\nВ боте - <a href="${botLink}">@${botName}</a>\nВ приложении - <a href="${appLink}">📱 AiVerse App</a>`

    const promptHtml = promptWithFingerprint
      ? `\n\n💬 Промпт:\n<blockquote expandable>${escapeHtml(promptWithFingerprint)}</blockquote>`
      : ''

    const fullCaption = headerHtml + promptHtml
    const isCaptionTooLong = fullCaption.length > 1024
    const caption = isCaptionTooLong ? headerHtml : fullCaption

    // Compress image if too large for Telegram (10MB limit for photos)
    const MAX_PHOTO_SIZE = 10 * 1024 * 1024 // 10MB
    let finalBuffer = watermarkedBuffer

    if (watermarkedBuffer.length > MAX_PHOTO_SIZE) {
      console.info('sendWithWatermark:compressing', { originalSize: watermarkedBuffer.length })
      // Compress to JPEG with reduced quality
      finalBuffer = await sharp(watermarkedBuffer)
        .jpeg({ quality: 85 })
        .toBuffer()
      console.info('sendWithWatermark:compressed', { newSize: finalBuffer.length })

      // If still too large, compress more aggressively
      if (finalBuffer.length > MAX_PHOTO_SIZE) {
        finalBuffer = await sharp(watermarkedBuffer)
          .jpeg({ quality: 70 })
          .toBuffer()
        console.info('sendWithWatermark:compressed_more', { newSize: finalBuffer.length })
      }
    }

    // Send photo with watermark as file upload
    const formData = new FormData()
    formData.append('chat_id', String(chat_id))
    formData.append('photo', new Blob([new Uint8Array(finalBuffer)], { type: 'image/jpeg' }), 'watermarked.jpg')
    formData.append('caption', caption)
    formData.append('parse_mode', 'HTML')

    const sendResult = await fetch(`${API}/sendPhoto`, {
      method: 'POST',
      body: formData
    })
    const sendData = await sendResult.json()

    if (!sendData.ok) {
      console.error('sendWithWatermark:telegram_error', sendData)
      return res.status(500).json({ ok: false, error: 'telegram_error' })
    }

    const msgId = sendData.result?.message_id

    // Send separate prompt if caption was too long
    if (isCaptionTooLong && promptWithFingerprint && msgId) {
      const text = `💬 Промпт:\n<blockquote expandable>${escapeHtml(promptWithFingerprint)}</blockquote>`
      await tg('sendMessage', {
        chat_id,
        text,
        parse_mode: 'HTML',
        reply_to_message_id: msgId
      })
    }

    return res.json({ ok: true })

  } catch (e) {
    console.error('sendWithWatermark error', e)
    return res.status(500).json({ ok: false })
  }
}

