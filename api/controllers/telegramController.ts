import type { Request, Response } from 'express'
import sharp from 'sharp'
import { isPromoActive, calculateBonusTokens, getBonusAmount } from '../utils/promoUtils.js'
import { addFingerprint } from '../utils/fingerprint.js'
import { applyTextWatermark, applyImageWatermark } from '../utils/watermark.js'
import { getTelegramMessage } from '../utils/telegramMessages.js'
import { compressVideoForTelegram } from '../services/videoProcessingService.js'
import { processPartnerBonus } from '../services/partnerService.js'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : ''
const APP_URL = (
  process.env.WEBAPP_URL ||
  process.env.APP_URL ||
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
import { logBalanceChange } from '../services/balanceAuditService.js'

// Helper to check if spin event is enabled
async function isSpinEventEnabled(): Promise<boolean> {
  try {
    const result = await supaSelect('event_settings', `?event_key=eq.spin&select=enabled,start_date,end_date`)
    if (!result.ok || !result.data || result.data.length === 0) {
      return false
    }
    const event = result.data[0]
    const now = new Date()
    let isActive = event.enabled
    if (event.start_date && new Date(event.start_date) > now) {
      isActive = false
    }
    if (event.end_date && new Date(event.end_date) < now) {
      isActive = false
    }
    return isActive
  } catch (e) {
    console.error('[Spin] isSpinEventEnabled error:', e)
    return false
  }
}

// Topic definitions for private chats (Bot API 9.4)
// Note: icon_custom_emoji_id requires Premium, using Unicode emoji in names instead
const TOPIC_DEFINITIONS = [
  { name: '🏠 Домой', welcome: '👋 Добро пожаловать в AI Verse!\n\nЭто главный экран — здесь вы найдёте помощь и навигацию.\n\nИспользуйте топики слева для работы с разными моделями!' },
  { name: '🧠 ИИ Чат', welcome: '🧠 *ИИ Чат*\n\nЗдесь вы можете общаться с искусственным интеллектом.\n\n_Отправьте сообщение, чтобы начать!_' },
  { name: '🍌 NanoBanana', welcome: '🍌 *NanoBanana*\n\nБыстрая генерация изображений!\n• NanoBanana — 3 токена\n• NanoBanana Pro — 15 токенов\n\n_Отправьте промпт для генерации_' },
  { name: '⚡ Seedream', welcome: '⚡ *Seedream*\n\nКачественные изображения!\n• Seedream 4 — 4 токена\n• Seedream 4.5 — 7 токенов\n\n_Отправьте промпт для генерации_' },
  { name: '🤖 GPT Image', welcome: '🤖 *GPT Image 1.5*\n\nМодель от OpenAI\n• Medium — 5 токенов\n• High — 15 токенов\n\n_Отправьте промпт для генерации_' },
  { name: '🎬 Видео', welcome: '🎬 *Генерация видео*\n\n• Seedance Pro — 12-116 токенов\n• Kling AI — 30-220 токенов\n  ↳ T2V, I2V, Motion Control\n\n_Отправьте промпт или изображение_' },
  { name: '🎨 Другое', welcome: '🎨 *Редактор и другие модели*\n\nЗдесь доступны дополнительные функции:\n• Редактирование изображений\n• Upscale\n• Другие модели\n\n_Откройте мини-апп для доступа_' },
]

// Create forum topics for a user (Bot API 9.4)
async function createUserTopics(chatId: number): Promise<Record<string, number>> {
  const topicIds: Record<string, number> = {}

  for (const topic of TOPIC_DEFINITIONS) {
    try {
      const params: Record<string, unknown> = {
        chat_id: chatId,
        name: topic.name,
      }

      const result = await tg('createForumTopic', params)

      if (result?.ok && result.result?.message_thread_id) {
        const threadId = result.result.message_thread_id
        topicIds[topic.name] = threadId

        // Send welcome message to the topic
        await tg('sendMessage', {
          chat_id: chatId,
          message_thread_id: threadId,
          text: topic.welcome,
          parse_mode: 'Markdown'
        })

        console.log(`[Topics] Created topic "${topic.name}" with id ${threadId} for chat ${chatId}`)
      } else {
        console.error(`[Topics] Failed to create topic "${topic.name}":`, result)
      }
    } catch (e) {
      console.error(`[Topics] Error creating topic "${topic.name}":`, e)
    }
  }

  return topicIds
}

// Check if topics are enabled for the bot (Bot API 9.4)
// This uses getMe since has_topics_enabled is a property of the bot, not the chat
let botTopicsEnabled: boolean | null = null // Cache the result

async function checkBotTopicsEnabled(): Promise<boolean> {
  if (botTopicsEnabled !== null) return botTopicsEnabled

  try {
    const result = await tg('getMe', {})
    console.log(`[Topics] getMe result:`, JSON.stringify(result?.result, null, 2))
    botTopicsEnabled = result?.ok && result.result?.has_topics_enabled === true
    console.log(`[Topics] Bot topics enabled: ${botTopicsEnabled}`)
    return botTopicsEnabled
  } catch (e) {
    console.error(`[Topics] checkBotTopicsEnabled error:`, e)
    return false
  }
}

// Get file URL from Telegram file_id
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
async function getFileUrl(fileId: string): Promise<string | null> {
  try {
    const result = await tg('getFile', { file_id: fileId })
    if (result?.ok && result.result?.file_path) {
      return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${result.result.file_path}`
    }
    return null
  } catch (e) {
    console.error('[Topics] getFileUrl error:', e)
    return null
  }
}

// Find topic name by thread_id
function getTopicByThreadId(topicIds: Record<string, number>, threadId: number): string | null {
  for (const [name, id] of Object.entries(topicIds)) {
    if (id === threadId) return name
  }
  return null
}

// Topic message handler - routes to appropriate handler based on topic
async function handleTopicMessage(
  chatId: number,
  threadId: number,
  userId: number,
  topicName: string,
  text: string,
  photoFileId?: string
): Promise<{ handled: boolean }> {
  console.log(`[Topics] Handling message in "${topicName}" from user ${userId}: ${text.slice(0, 50)}...`)

  // Get photo URL if provided
  let imageUrl: string | null = null
  if (photoFileId) {
    imageUrl = await getFileUrl(photoFileId)
    console.log(`[Topics] Photo URL: ${imageUrl}`)
  }

  switch (topicName) {
    case '🧠 ИИ Чат':
      await handleAIChat(chatId, threadId, userId, text, imageUrl)
      return { handled: true }

    case '🍌 NanoBanana':
      await handleImageGeneration(chatId, threadId, userId, 'nanobanana-pro', text, imageUrl)
      return { handled: true }

    case '⚡ Seedream':
      await handleImageGeneration(chatId, threadId, userId, 'seedream4-5', text, imageUrl)
      return { handled: true }

    case '🤖 GPT Image':
      await handleImageGeneration(chatId, threadId, userId, 'gpt-image-1.5', text, imageUrl)
      return { handled: true }

    case '🎬 Видео':
      await handleVideoTopic(chatId, threadId)
      return { handled: true }

    case '🎨 Другое':
      await handleEditorTopic(chatId, threadId)
      return { handled: true }

    case '🏠 Домой':
      await handleHomeTopic(chatId, threadId)
      return { handled: true }

    default:
      return { handled: false }
  }
}

// AI Chat handler using chatService
import { getChatCompletion } from '../services/chatService.js'

// In-memory chat history (last 10 messages per user)
const chatHistories: Map<number, Array<{ role: 'user' | 'assistant'; content: string }>> = new Map()

async function handleAIChat(
  chatId: number,
  threadId: number,
  userId: number,
  text: string,
  imageUrl: string | null
): Promise<void> {
  try {
    // Get or create history
    let history = chatHistories.get(userId) || []

    // Add user message
    const userContent = imageUrl
      ? [{ type: 'text' as const, text }, { type: 'image_url' as const, image_url: { url: imageUrl } }]
      : text
    history.push({ role: 'user', content: typeof userContent === 'string' ? userContent : JSON.stringify(userContent) })

    // Keep last 10 messages
    if (history.length > 10) history = history.slice(-10)
    chatHistories.set(userId, history)

    // Send typing action
    await tg('sendChatAction', { chat_id: chatId, message_thread_id: threadId, action: 'typing' })

    // Get AI response
    const response = await getChatCompletion(
      history.map(m => ({ role: m.role, content: m.content })),
      'deepseek/deepseek-v3.2'
    )

    // Add assistant message to history
    history.push({ role: 'assistant', content: response })
    chatHistories.set(userId, history.slice(-10))

    // Send response
    await tg('sendMessage', {
      chat_id: chatId,
      message_thread_id: threadId,
      text: response,
      parse_mode: 'Markdown'
    })
  } catch (e) {
    console.error('[Topics] AI Chat error:', e)
    await tg('sendMessage', {
      chat_id: chatId,
      message_thread_id: threadId,
      text: '❌ Ошибка AI чата. Попробуйте позже или откройте веб-версию.',
      reply_markup: {
        inline_keyboard: [[{ text: '🌐 Открыть в браузере', web_app: { url: APP_URL } }]]
      }
    })
  }
}

// Image generation handler using Kie.ai
async function handleImageGeneration(
  chatId: number,
  threadId: number,
  userId: number,
  model: string,
  prompt: string,
  imageUrl: string | null
): Promise<void> {
  try {
    // Check balance
    const userQ = await supaSelect('users', `?user_id=eq.${userId}&select=balance,active_generations`)
    if (!userQ.ok || !userQ.data?.[0]) {
      await tg('sendMessage', {
        chat_id: chatId,
        message_thread_id: threadId,
        text: '❌ Пользователь не найден. Нажмите /start'
      })
      return
    }

    const user = userQ.data[0]
    const activeGens = user.active_generations || 0

    // Check rate limit (max 3 parallel)
    if (activeGens >= 3) {
      await tg('sendMessage', {
        chat_id: chatId,
        message_thread_id: threadId,
        text: '⏳ У вас уже 3 активные генерации. Дождитесь завершения.'
      })
      return
    }

    // Model prices
    const MODEL_PRICES: Record<string, number> = {
      'nanobanana-pro': 15,
      'seedream4-5': 7,
      'gpt-image-1.5': 5
    }
    const price = MODEL_PRICES[model] || 5

    // Check balance
    if (user.balance < price) {
      await tg('sendMessage', {
        chat_id: chatId,
        message_thread_id: threadId,
        text: `❌ Недостаточно токенов. Нужно: ${price}, баланс: ${user.balance}`,
        reply_markup: {
          inline_keyboard: [[{ text: '💎 Пополнить', web_app: { url: `${APP_URL}/balance` } }]]
        }
      })
      return
    }

    // Increment active generations
    await supaPatch('users', `?user_id=eq.${userId}`, { active_generations: activeGens + 1 })

    // Send progress message
    const progressMsg = await tg('sendMessage', {
      chat_id: chatId,
      message_thread_id: threadId,
      text: `🎨 Генерирую с ${model}...`
    })

    try {
      // TODO: Call Kie.ai API here
      // For now, placeholder - need to integrate with existing Kie.ai code
      const KIE_API_KEY = process.env.KIE_API_KEY || ''
      const KIE_API_URL = 'https://api.kie.ai/v1/images/generations'

      // NanoBanana Pro uses 2K quality by default
      const quality = model === 'nanobanana-pro' ? '2k' : 'standard'

      const kieBody: Record<string, unknown> = {
        model,
        prompt,
        quality,
        n: 1
      }
      if (imageUrl) {
        kieBody.image = imageUrl
      }

      const kieRes = await fetch(KIE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${KIE_API_KEY}`
        },
        body: JSON.stringify(kieBody)
      })

      const kieData = await kieRes.json()
      console.log('[Topics] Kie.ai response:', kieData)

      if (kieData.data?.[0]?.url) {
        const resultUrl = kieData.data[0].url

        // Deduct balance
        await supaPatch('users', `?user_id=eq.${userId}`, { balance: user.balance - price })

        // Log balance change
        await logBalanceChange({
          userId,
          oldBalance: user.balance,
          newBalance: user.balance - price,
          reason: 'generation',
          metadata: { model, source: 'topic' }
        })

        // Send result
        await tg('sendPhoto', {
          chat_id: chatId,
          message_thread_id: threadId,
          photo: resultUrl,
          caption: `✅ Готово! (-${price} токенов)`
        })

        // Delete progress message
        if (progressMsg?.result?.message_id) {
          await tg('deleteMessage', { chat_id: chatId, message_id: progressMsg.result.message_id })
        }
      } else {
        throw new Error(kieData.error?.message || 'Generation failed')
      }
    } finally {
      // Decrement active generations
      await supaPatch('users', `?user_id=eq.${userId}`, { active_generations: Math.max(0, activeGens) })
    }
  } catch (e: any) {
    console.error('[Topics] Image generation error:', e)
    await tg('sendMessage', {
      chat_id: chatId,
      message_thread_id: threadId,
      text: `❌ Ошибка генерации: ${e.message || 'Попробуйте позже'}`,
      reply_markup: {
        inline_keyboard: [[{ text: '🌐 Открыть в браузере', web_app: { url: `${APP_URL}/studio` } }]]
      }
    })
  }
}

// Video topic shows buttons only
async function handleVideoTopic(chatId: number, threadId: number): Promise<void> {
  await tg('sendMessage', {
    chat_id: chatId,
    message_thread_id: threadId,
    text: '🎬 *Генерация видео*\n\nВыберите модель для перехода в студию:',
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🌸 Seedance Pro', web_app: { url: `${APP_URL}/studio?model=seedance-1.5-pro&media=video` } }],
        [{ text: '🎥 Kling T2V / I2V', web_app: { url: `${APP_URL}/studio?model=kling-t2v&media=video` } }],
        [{ text: '🎬 Kling Motion Control', web_app: { url: `${APP_URL}/studio?model=kling-mc&media=video` } }]
      ]
    }
  })
}

// Editor topic shows redirect button
async function handleEditorTopic(chatId: number, threadId: number): Promise<void> {
  await tg('sendMessage', {
    chat_id: chatId,
    message_thread_id: threadId,
    text: '🎨 *Редактор*\n\nФункции редактирования доступны в веб-приложении:',
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[{ text: '🎨 Открыть редактор', web_app: { url: `${APP_URL}/editor` } }]]
    }
  })
}

// Home topic shows help
async function handleHomeTopic(chatId: number, threadId: number): Promise<void> {
  await tg('sendMessage', {
    chat_id: chatId,
    message_thread_id: threadId,
    text: `🏠 *Добро пожаловать в AI Verse!*

📌 *Как использовать топики:*

• 🧠 *ИИ Чат* — общайтесь с AI ассистентом
• 🍌 *NanoBanana* — быстрая генерация (промпт/фото)
• ⚡ *Seedream* — качественные арты
• 🤖 *GPT Image* — OpenAI качество
• 🎬 *Видео* — создание видео
• 🎨 *Другое* — редактор изображений

_Отправьте промпт в любой топик для генерации!_`,
    parse_mode: 'Markdown'
  })
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

    // Handle Pre-Checkout Query (Required for Stars)
    if (update.pre_checkout_query) {
      const id = update.pre_checkout_query.id
      await tg('answerPreCheckoutQuery', { pre_checkout_query_id: id, ok: true })
      return res.json({ ok: true })
    }

    // Handle Callback Queries (inline button presses)
    if (update.callback_query) {
      const callback = update.callback_query
      const callbackChatId = callback.message?.chat?.id
      const callbackMessageId = callback.message?.message_id
      const callbackUserId = callback.from?.id
      const data = callback.data || ''

      // Helper to get user balance text
      const getBalanceText = async () => {
        if (callbackUserId) {
          const userQ = await supaSelect('users', `?user_id=eq.${callbackUserId}&select=balance`)
          if (userQ.ok && userQ.data?.[0]) {
            return `\n\n💰 Ваш баланс: *${userQ.data[0].balance || 0}* токенов`
          }
        }
        return ''
      }

      // Step 1: Show payment method choice (Stars or Card)
      if (data === 'topup' && callbackChatId && callbackMessageId) {
        const balanceText = await getBalanceText()
        const methodText = `💎 *Пополнение баланса*${balanceText}

Выберите способ оплаты:

⭐ *Telegram Stars* — мгновенная оплата
💳 *Банковская карта* — EUR/RUB`

        const kb = {
          inline_keyboard: [
            [{ text: '⭐ Telegram Stars', callback_data: 'topup_stars' }],
            [{ text: '💳 Банковская карта', callback_data: 'topup_card' }],
            [{ text: '« Назад', callback_data: 'back_to_profile' }]
          ]
        }
        await tg('editMessageText', {
          chat_id: callbackChatId,
          message_id: callbackMessageId,
          text: methodText,
          parse_mode: 'Markdown',
          reply_markup: kb
        })
        await tg('answerCallbackQuery', { callback_query_id: callback.id })
        return res.json({ ok: true })
      }

      // Step 2: Show Stars packages (min 50 tokens)
      if (data === 'topup_stars' && callbackChatId && callbackMessageId) {
        const balanceText = await getBalanceText()
        const starsText = `⭐ *Оплата Telegram Stars*${balanceText}

Выберите пакет:`

        const kb = {
          inline_keyboard: [
            [{ text: '⭐ 50 Stars → 25 токенов', callback_data: 'pay_stars_50' }],
            [{ text: '⭐ 100 Stars → 50 токенов', callback_data: 'pay_stars_100' }],
            [{ text: '⭐ 200 Stars → 100 токенов 🔥', callback_data: 'pay_stars_200' }],
            [{ text: '⭐ 600 Stars → 300 токенов +🎰', callback_data: 'pay_stars_600' }],
            [{ text: '⭐ 1000 Stars → 550 токенов 🎁', callback_data: 'pay_stars_1000' }],
            [{ text: '« Назад', callback_data: 'topup' }]
          ]
        }
        await tg('editMessageText', {
          chat_id: callbackChatId,
          message_id: callbackMessageId,
          text: starsText,
          parse_mode: 'Markdown',
          reply_markup: kb
        })
        await tg('answerCallbackQuery', { callback_query_id: callback.id })
        return res.json({ ok: true })
      }

      // Step 2 alt: Show Card payment options
      if (data === 'topup_card' && callbackChatId && callbackMessageId) {
        const balanceText = await getBalanceText()
        const cardText = `💳 *Оплата картой*${balanceText}

Нажмите кнопку ниже чтобы открыть страницу оплаты:

Принимаем: Visa, Mastercard, МИР, UnionPay`

        const kb = {
          inline_keyboard: [
            [{ text: '💳 Открыть оплату', web_app: { url: `${APP_URL}?tgWebAppStartParam=balance` } }],
            [{ text: '« Назад', callback_data: 'topup' }]
          ]
        }
        await tg('editMessageText', {
          chat_id: callbackChatId,
          message_id: callbackMessageId,
          text: cardText,
          parse_mode: 'Markdown',
          reply_markup: kb
        })
        await tg('answerCallbackQuery', { callback_query_id: callback.id })
        return res.json({ ok: true })
      }

      // Step 3: Stars payment - create invoice
      if (data.startsWith('pay_stars_') && callbackChatId && callbackMessageId) {
        const starAmount = parseInt(data.replace('pay_stars_', ''))
        const STAR_PACKAGES: Record<number, { tokens: number; spins: number }> = {
          50: { tokens: 25, spins: 0 },
          100: { tokens: 50, spins: 0 },
          200: { tokens: 100, spins: 0 },
          600: { tokens: 300, spins: 1 },
          1000: { tokens: 550, spins: 2 }
        }

        const pkg = STAR_PACKAGES[starAmount]
        if (pkg) {
          try {
            // Create Stars invoice
            const invoiceResult = await tg('createInvoiceLink', {
              title: `${pkg.tokens} токенов`,
              description: `Пополнение баланса на ${pkg.tokens} токенов`,
              payload: JSON.stringify({ packageId: `star_${starAmount}`, tokens: pkg.tokens, spins: pkg.spins }),
              currency: 'XTR',
              prices: [{ label: `${pkg.tokens} токенов`, amount: starAmount }]
            })

            if (invoiceResult?.ok && invoiceResult.result) {
              const invoiceLink = invoiceResult.result
              const bonusText = pkg.spins > 0 ? `\n🎰 Бонус: +${pkg.spins} ${pkg.spins === 1 ? 'спин' : 'спина'}` : ''

              await tg('editMessageText', {
                chat_id: callbackChatId,
                message_id: callbackMessageId,
                text: `💳 *Оплата ${starAmount} Stars*\n\nВы получите: *${pkg.tokens} токенов*${bonusText}\n\n👇 Нажмите кнопку для оплаты:`,
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [
                    [{ text: `⭐ Оплатить ${starAmount} Stars`, url: invoiceLink }],
                    [{ text: '« Назад к пакетам', callback_data: 'topup_stars' }]
                  ]
                }
              })
            } else {
              await tg('editMessageText', {
                chat_id: callbackChatId,
                message_id: callbackMessageId,
                text: '❌ Ошибка создания платежа. Попробуйте позже.',
                parse_mode: 'Markdown',
                reply_markup: {
                  inline_keyboard: [[{ text: '« Назад', callback_data: 'topup_stars' }]]
                }
              })
            }
          } catch (e) {
            console.error('[Payment] Stars invoice error:', e)
            await tg('editMessageText', {
              chat_id: callbackChatId,
              message_id: callbackMessageId,
              text: '❌ Ошибка создания платежа. Попробуйте позже.',
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [[{ text: '« Назад', callback_data: 'topup_stars' }]]
              }
            })
          }
        }

        await tg('answerCallbackQuery', { callback_query_id: callback.id })
        return res.json({ ok: true })
      }

      // Back to profile
      if (data === 'back_to_profile' && callbackChatId && callbackMessageId && callbackUserId) {
        // Re-fetch and show profile
        const userQ = await supaSelect('users', `?user_id=eq.${callbackUserId}&select=balance,username,first_name,spins`)

        let genCount = 0
        try {
          const genRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/generations?user_id=eq.${callbackUserId}&select=id`, {
            method: 'HEAD',
            headers: {
              'apikey': process.env.SUPABASE_ANON_KEY || '',
              'Prefer': 'count=exact'
            }
          })
          const countHeader = genRes.headers.get('content-range')
          if (countHeader) {
            const match = countHeader.match(/\/(\d+)$/)
            if (match) genCount = parseInt(match[1])
          }
        } catch (e) { /* ignore */ }

        if (userQ.ok && userQ.data?.[0]) {
          const user = userQ.data[0]
          const spinEnabled = await isSpinEventEnabled()
          const spinLine = spinEnabled ? `\n🎰 *Спины:* ${user.spins || 0}` : ''
          const profileText = `👤 *Ваш профиль*

📛 *Имя:* ${user.first_name || callback.from?.first_name || 'Не указано'}
🆔 *ID:* \`${callbackUserId}\`

💰 *Баланс:* ${user.balance || 0} токенов${spinLine}
🎨 *Генераций:* ${genCount}`

          const kb = {
            inline_keyboard: [
              [{ text: '🎨 Мои генерации', web_app: { url: `${APP_URL}/profile` } }],
              [{ text: '💎 Пополнить', callback_data: 'topup' }],
              [{ text: '⚙️ Настройки', web_app: { url: `${APP_URL}/settings` } }]
            ]
          }
          await tg('editMessageText', {
            chat_id: callbackChatId,
            message_id: callbackMessageId,
            text: profileText,
            parse_mode: 'Markdown',
            reply_markup: kb
          })
        }
        await tg('answerCallbackQuery', { callback_query_id: callback.id })
        return res.json({ ok: true })
      }

      // Default: just answer callback
      await tg('answerCallbackQuery', { callback_query_id: callback.id })
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
      let spinsToAdd = Number(payload.spins || 0)

      // Check if spin event is enabled - don't award spins if disabled
      const spinEventEnabled = await isSpinEventEnabled()
      if (!spinEventEnabled) {
        spinsToAdd = 0
      }

      // Apply New Year promo bonus (+20%)
      const promoActive = isPromoActive()
      const tokensToAdd = promoActive ? calculateBonusTokens(baseTokens) : baseTokens
      const bonusTokens = promoActive ? getBonusAmount(baseTokens) : 0

      console.log(`[Payment] Successful payment from ${userId}, base: ${baseTokens}, bonus: ${bonusTokens}, total: ${tokensToAdd}, promoActive: ${promoActive}, spins: ${spinsToAdd}, spinEventEnabled: ${spinEventEnabled}, payload:`, payload)

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
            logBalanceChange({ userId, oldBalance: currentBalance, newBalance, reason: 'payment', metadata: { baseTokens, bonusTokens, promoActive, spinsToAdd } })
            const spinText = spinsToAdd > 0 ? `\n🎰 Бонус: +${spinsToAdd} ${spinsToAdd === 1 ? 'спин' : 'спина'} для Колеса Фортуны!` : ''
            const promoText = promoActive ? `\n(Включая новогодний бонус +${bonusTokens} 🎁)` : ''
            await tg('sendMessage', { chat_id: userId, text: `✅ Оплата прошла успешно! Начислено ${tokensToAdd} токенов.${promoText}${spinText}` })
            // Partner bonus accrual
            await processPartnerBonus(userId, payment.total_amount || 0, 'XTR')
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
    const text = String(msg?.text || msg?.caption || '').trim()
    const threadId = msg?.message_thread_id
    const userId = msg?.from?.id

    // DISABLED: Handle topic messages (Bot API 9.4 - Forum Topics) - to be enabled later
    const TOPICS_ROUTING_ENABLED = false
    if (TOPICS_ROUTING_ENABLED && chatId && threadId && userId) {
      // Get topic_ids from DB
      const userQ = await supaSelect('users', `?user_id=eq.${userId}&select=topic_ids`)
      const topicIds = userQ.ok && userQ.data?.[0]?.topic_ids || {}

      if (Object.keys(topicIds).length > 0) {
        const topicName = getTopicByThreadId(topicIds, threadId)
        if (topicName) {
          // Get photo file_id if present
          let photoFileId: string | undefined
          if (msg.photo && Array.isArray(msg.photo) && msg.photo.length > 0) {
            photoFileId = msg.photo[msg.photo.length - 1].file_id
          }

          const result = await handleTopicMessage(chatId, threadId, userId, topicName, text || '', photoFileId)
          if (result.handled) {
            return res.json({ ok: true })
          }
        }
      }
    }

    if (!chatId || !text) return res.json({ ok: true })
    if (text.startsWith('/start')) {
      const parts = text.split(/\s+/)
      const param = parts.length > 1 ? parts[1] : ''

      // Reply keyboard with models and buttons (with custom emoji icons - Bot API 9.4)
      // Custom emoji IDs for animated icons
      const EMOJI_IDS = {
        banana: '5361573813521756274',    // 🍌 NanoBanana
        seedream: '5282731554135615450',  // 🌩 Seedream
        gptImage: '5359726582447487916',  // 📱 GPT Image
        aiChat: '5226639745106330551',    // 🧠 AI Chat
        video: '5375464961822695044',     // 🎬 Video (Kling/Seedance)
      }

      const mainKeyboard = {
        keyboard: [
          [{ text: 'Чат с ИИ', icon_custom_emoji_id: EMOJI_IDS.aiChat }],
          [
            { text: 'NanoBanana', icon_custom_emoji_id: EMOJI_IDS.banana },
            { text: 'Seedream 4', icon_custom_emoji_id: EMOJI_IDS.seedream }
          ],
          [
            { text: 'Seedream 4.5', icon_custom_emoji_id: EMOJI_IDS.seedream },
            { text: 'GPT Image', icon_custom_emoji_id: EMOJI_IDS.gptImage }
          ],
          [
            { text: 'Seedance', icon_custom_emoji_id: EMOJI_IDS.video },
            { text: 'Kling', icon_custom_emoji_id: EMOJI_IDS.video }
          ],
          [{ text: '👤 Профиль' }, { text: '💎 Пополнить' }],
        ],
        resize_keyboard: true,
        is_persistent: true
      }

      // DISABLED: Forum topics feature (Bot API 9.4) - to be enabled later
      const TOPICS_ENABLED = false
      if (TOPICS_ENABLED) {
        // Check if topics are enabled and create them if needed (Bot API 9.4)
        const topicsEnabled = await checkBotTopicsEnabled()
        if (topicsEnabled) {
          // Check if user already has topics (check in DB or just try to create)
          const userId = msg.from?.id
          if (userId) {
            // Check if user exists in DB with topics_created flag
            const userQ = await supaSelect('users', `?user_id=eq.${userId}&select=user_id,topics_created,topic_ids`)
            const userData = userQ.data?.[0]
            const hasTopics = userQ.ok && userData?.topics_created === true && Object.keys(userData?.topic_ids || {}).length > 0

            console.log(`[Topics] User ${userId} check: ok=${userQ.ok}, topics_created=${userData?.topics_created}, hasTopics=${hasTopics}`)

            if (!hasTopics) {
              console.log(`[Topics] Creating topics for user ${userId}...`)
              const topicIds = await createUserTopics(chatId)

              if (Object.keys(topicIds).length > 0) {
                // Save topics_created flag and topic_ids to DB
                const updateData = { topics_created: true, topic_ids: topicIds }
                if (userQ.ok && userQ.data?.[0]) {
                  await supaPatch('users', `?user_id=eq.${userId}`, updateData)
                } else {
                  await supaPost('users', { user_id: userId, ...updateData }, '?on_conflict=user_id')
                }
                console.log(`[Topics] Created ${Object.keys(topicIds).length} topics for user ${userId}:`, topicIds)

                // Don't send the regular welcome since topics have their own welcomes
                return res.json({ ok: true })
              }
            }
          }
        }
      }

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
        const info = '👋 Добро пожаловать в AI Verse!\n\nВыберите модель для генерации или откройте приложение:'
        const inlineKb = { inline_keyboard: [[{ text: '🚀 Открыть приложение', web_app: { url: APP_URL } }]] }
        await tg('sendMessage', { chat_id: chatId, text: info, reply_markup: mainKeyboard })
        await tg('sendMessage', { chat_id: chatId, text: '👇 Или откройте полную версию:', reply_markup: inlineKb })
        return res.json({ ok: true })
      }

      if (APP_URL && (param === 'home' || param === 'generate' || param === 'studio' || param === 'top' || param === 'profile')) {
        const startVal = param === 'studio' ? 'generate' : param
        const url = startVal === 'home' ? APP_URL : `${APP_URL}?tgWebAppStartParam=${encodeURIComponent(startVal)}`
        const inlineKb = { inline_keyboard: [[{ text: '🚀 Открыть приложение', web_app: { url } }]] }
        await tg('sendMessage', { chat_id: chatId, text: '✨ AI Verse — генерация изображений и видео ИИ', reply_markup: mainKeyboard })
        await tg('sendMessage', { chat_id: chatId, text: '👇 Откройте мини‑апп:', reply_markup: inlineKb })
      } else {
        const info = '✨ AI Verse — генерация изображений и видео с помощью ИИ!\n\n🎨 Выберите модель кнопками ниже или откройте приложение:'
        const inlineKb = { inline_keyboard: [[{ text: '🚀 Открыть приложение', web_app: { url: APP_URL } }]] }
        await tg('sendMessage', { chat_id: chatId, text: info, reply_markup: mainKeyboard })
        await tg('sendMessage', { chat_id: chatId, text: '👇 Или откройте полную версию:', reply_markup: inlineKb })
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
      const query = `?status=eq.active&organizer_name=ilike.${encodeURIComponent('%' + organizerName + '%')}&select=*`
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

    // Get bot username for deeplinks
    let botUsername = 'AiVerseAppBot'
    try {
      const me = await tg('getMe', {})
      if (me?.ok && me.result?.username) {
        botUsername = me.result.username
      }
    } catch { /* use default */ }

    // Model button handlers
    const MODEL_INFO: Record<string, {
      name: string;
      description: string;
      price: string;
      studioUrl: string;
      photo: string;
      examples?: string;
    }> = {
      'NanoBanana': {
        name: 'NanoBanana',
        description: '🍌 *NanoBanana* — быстрая генерация изображений\n\n• NanoBanana — 3 токена\n• NanoBanana Pro — 15 токенов (высокое качество, Auto ratio)',
        price: '3-15',
        studioUrl: `${APP_URL}/studio?model=nanobanana-pro&media=image`,
        photo: `${APP_URL}/models/nanobanana-pro.png`,
        examples: 'Отлично подходит для быстрых генераций и экспериментов'
      },
      'Seedream 4': {
        name: 'Seedream 4',
        description: '⚡ *Seedream 4* — качественная модель генерации изображений\n\n• Стоимость: 4 токена\n• Высокое качество изображений\n• Поддержка различных соотношений сторон',
        price: '4',
        studioUrl: `${APP_URL}/studio?model=seedream4&media=image`,
        photo: `${APP_URL}/models/seedream.png`,
        examples: 'Идеально для фотореалистичных изображений'
      },
      'Seedream 4.5': {
        name: 'Seedream 4.5',
        description: '⚡ *Seedream 4.5* — улучшенная версия Seedream\n\n• Стоимость: 7 токенов\n• Улучшенное качество деталей\n• Более точное следование промпту',
        price: '7',
        studioUrl: `${APP_URL}/studio?model=seedream4-5&media=image`,
        photo: `${APP_URL}/models/seedream-4-5.png`,
        examples: 'Для самых детализированных изображений'
      },
      'GPT Image': {
        name: 'GPT Image',
        description: '🤖 *GPT Image 1.5* — модель от OpenAI\n\n• Medium качество: 5 токенов\n• High качество: 15 токенов\n• Отличное понимание текста',
        price: '5-15',
        studioUrl: `${APP_URL}/studio?model=gpt-image-1.5&media=image`,
        photo: `${APP_URL}/models/optimized/gpt-image.png`,
        examples: 'Лучший выбор для сложных промптов'
      },
      'Seedance': {
        name: 'Seedance Pro',
        description: '🎬 *Seedance Pro* — генерация видео\n\n• Text-to-Video и Image-to-Video\n• Разрешение: 480p / 720p\n• Длительность: 4-12 сек\n• Стоимость: 12-116 токенов',
        price: '12-116',
        studioUrl: `${APP_URL}/studio?model=seedance-1.5-pro&media=video`,
        photo: `${APP_URL}/models/seedream.png`,
        examples: '🎥 Создавайте потрясающие видео из текста или изображений!'
      },
      'Kling': {
        name: 'Kling AI',
        description: '🎬 *Kling AI* — продвинутая модель видео\n\n• Text-to-Video (T2V): 55-110 токенов\n• Image-to-Video (I2V): 55-110 токенов\n• Motion Control (MC): 30+ токенов\n  ↳ Контроль движения по видео-референсу\n\nПоддержка звука и длинных видео до 10 сек',
        price: '30-220',
        studioUrl: `${APP_URL}/studio?model=kling-t2v&media=video`,
        photo: `${APP_URL}/models/optimized/kling.png`,
        examples: '🌟 Используйте Motion Control для точного управления движением!'
      }
    }

    // Handle model buttons
    if (MODEL_INFO[text]) {
      const model = MODEL_INFO[text]
      const caption = `${model.description}\n\n💰 Стоимость: ${model.price} токенов\n\n${model.examples || ''}`

      const inlineKb = {
        inline_keyboard: [[
          { text: '🚀 Открыть в Студии', web_app: { url: model.studioUrl } }
        ]]
      }

      // Send photo with model info
      const photoResult = await tg('sendPhoto', {
        chat_id: chatId,
        photo: model.photo,
        caption,
        parse_mode: 'Markdown',
        reply_markup: inlineKb
      })

      // Fallback if photo fails
      if (!photoResult?.ok) {
        await tg('sendMessage', {
          chat_id: chatId,
          text: caption,
          parse_mode: 'Markdown',
          reply_markup: inlineKb
        })
      }

      return res.json({ ok: true })
    }

    // Handle additional buttons
    if (text === 'Чат с ИИ') {
      const url = `${APP_URL}?tgWebAppStartParam=chat`
      const kb = { inline_keyboard: [[{ text: '💬 Открыть чат', web_app: { url } }]] }
      await tg('sendMessage', {
        chat_id: chatId,
        text: '💬 *Чат с ИИ*\n\nОбщайтесь с искусственным интеллектом, задавайте вопросы и получайте ответы!',
        parse_mode: 'Markdown',
        reply_markup: kb
      })
      return res.json({ ok: true })
    }

    if (text === '👤 Профиль') {
      const userId = msg.from?.id
      if (userId) {
        // Fetch user data
        const userQ = await supaSelect('users', `?user_id=eq.${userId}&select=balance,username,first_name,spins`)

        // Count generations
        let genCount = 0
        try {
          const genRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/generations?user_id=eq.${userId}&select=id`, {
            method: 'HEAD',
            headers: {
              'apikey': process.env.SUPABASE_ANON_KEY || '',
              'Prefer': 'count=exact'
            }
          })
          const countHeader = genRes.headers.get('content-range')
          if (countHeader) {
            const match = countHeader.match(/\/(\d+)$/)
            if (match) genCount = parseInt(match[1])
          }
        } catch (e) {
          console.error('[Profile] Gen count error:', e)
        }

        if (userQ.ok && userQ.data?.[0]) {
          const user = userQ.data[0]
          const spinEnabled = await isSpinEventEnabled()
          const spinLine = spinEnabled ? `\n🎰 *Спины:* ${user.spins || 0}` : ''
          const profileText = `👤 *Ваш профиль*

📛 *Имя:* ${user.first_name || msg.from?.first_name || 'Не указано'}
🆔 *ID:* \`${userId}\`

💰 *Баланс:* ${user.balance || 0} токенов${spinLine}
🎨 *Генераций:* ${genCount}`

          const kb = {
            inline_keyboard: [
              [{ text: '🎨 Мои генерации', web_app: { url: `${APP_URL}/profile` } }],
              [{ text: '💎 Пополнить', callback_data: 'topup' }],
              [{ text: '⚙️ Настройки', web_app: { url: `${APP_URL}/settings` } }]
            ]
          }
          await tg('sendMessage', { chat_id: chatId, text: profileText, parse_mode: 'Markdown', reply_markup: kb })
        } else {
          // User not found in DB, show basic info
          const basicText = `👤 *Ваш профиль*

📛 *Имя:* ${msg.from?.first_name || 'Не указано'}
🆔 *ID:* \`${userId}\`

⚠️ Нажмите /start чтобы активировать аккаунт`
          await tg('sendMessage', { chat_id: chatId, text: basicText, parse_mode: 'Markdown' })
        }
      }
      return res.json({ ok: true })
    }

    if (text === '💎 Пополнить') {
      // Fetch user balance
      const userId = msg.from?.id
      let balanceText = ''
      if (userId) {
        const userQ = await supaSelect('users', `?user_id=eq.${userId}&select=balance`)
        if (userQ.ok && userQ.data?.[0]) {
          const balance = userQ.data[0].balance || 0
          balanceText = `\n\n💰 Ваш баланс: *${balance}* токенов`
        }
      }

      const methodText = `💎 *Пополнение баланса*${balanceText}

Выберите способ оплаты:

⭐ *Telegram Stars* — мгновенная оплата
💳 *Банковская карта* — EUR/RUB`

      const kb = {
        inline_keyboard: [
          [{ text: '⭐ Telegram Stars', callback_data: 'topup_stars' }],
          [{ text: '💳 Банковская карта', callback_data: 'topup_card' }]
        ]
      }
      await tg('sendMessage', { chat_id: chatId, text: methodText, parse_mode: 'Markdown', reply_markup: kb })
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
        // Compress large images with sharp
        console.info('sendRemixShare:compressing_image', { originalSize })
        fileBuffer = await sharp(Buffer.from(ab))
          .jpeg({ quality: 85 })
          .toBuffer()
        filename = `ai-${Date.now()}.jpg`
        contentType = 'image/jpeg'
        console.info('sendRemixShare:compressed', { newSize: fileBuffer.length })
      } else if (isVideoContentType && originalSize > MAX_FILE_SIZE) {
        // Compress large videos with FFmpeg
        console.info('sendRemixShare:compressing_video', { originalSize })
        const compressedVideo = await compressVideoForTelegram(mediaUrl)
        if (compressedVideo) {
          fileBuffer = compressedVideo
          filename = `ai-${Date.now()}.mp4`
          contentType = 'video/mp4'
          console.info('sendRemixShare:video_compressed', { newSize: fileBuffer.length })
        } else {
          // Compression failed, try with original
          console.warn('sendRemixShare:video_compression_failed, using original')
          fileBuffer = Buffer.from(ab)
          filename = `ai-${Date.now()}.mp4`
          contentType = 'video/mp4'
        }
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
    const generationId = Number(req.body?.generation_id || 0)

    if (!API || !chat_id || (!photo && !video)) {
      return res.status(400).json({ ok: false, error: 'invalid payload' })
    }

    // Get user's language
    const { data: users } = await supaSelect('users', `?user_id=eq.${userId}&limit=1`)
    const userLang = users?.[0]?.language_code || null

    // Get hashtag for model
    const hashtag = MODEL_HASHTAGS[model] || '#AIVerse'

    // Get bot for model
    const botName = MODEL_BOTS[model] || 'AiVerseAppBot'

    // Get bot username dynamically for AiVerseAppBot
    let appBotUsername = 'AiVerseAppBot'
    try {
      const me = await tg('getMe', {})
      if (me?.ok && me.result?.username) {
        appBotUsername = me.result.username
      }
    } catch (e) {
      console.error('Failed to get bot username', e)
    }

    // Build ref link
    const refParam = username || String(userId)
    const botLink = `https://t.me/${botName}?start=ref_${refParam}`

    // Build remix link for the second reference (ref + remix)
    const appLink = generationId
      ? `https://t.me/${appBotUsername}?startapp=ref-${refParam}-remix-${generationId}`
      : `https://t.me/${appBotUsername}?start=ref_${refParam}`

    // Add fingerprint to prompt
    const promptWithFingerprint = prompt ? addFingerprint(prompt, username, userId) : ''

    // Get localized messages
    const txtCreateSimilar = getTelegramMessage(userLang, 'createSimilar')
    const txtInBot = getTelegramMessage(userLang, 'inBot')
    const txtRepeatInApp = getTelegramMessage(userLang, 'repeatInApp')
    const txtAppName = getTelegramMessage(userLang, 'appName')
    const txtPrompt = getTelegramMessage(userLang, 'prompt')

    // Format parts
    const headerHtml = `${hashtag}\n\n${txtCreateSimilar}\n${txtInBot} - <a href="${botLink}">@${botName}</a>\n\n${txtRepeatInApp}\n<a href="${appLink}">${txtAppName}</a>`

    // Build full caption to check length
    // HTML format: <blockquote expandable>text</blockquote>
    const promptHtml = promptWithFingerprint
      ? `\n\n${txtPrompt}\n<blockquote expandable>${escapeHtml(promptWithFingerprint)}</blockquote>`
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

        // Compress image if too large for Telegram (10MB limit for photos)
        const MAX_PHOTO_SIZE = 10 * 1024 * 1024 // 10MB
        const originalBuffer = Buffer.from(new Uint8Array(ab))
        let finalBuffer: Buffer<ArrayBufferLike> = originalBuffer
        let finalContentType = ct

        if (!isVideoContent && finalBuffer.length > MAX_PHOTO_SIZE) {
          console.info('sendWithPrompt:compressing', { originalSize: finalBuffer.length })
          // Compress to JPEG with reduced quality
          finalBuffer = await sharp(originalBuffer)
            .jpeg({ quality: 85 })
            .toBuffer()
          finalContentType = 'image/jpeg'
          console.info('sendWithPrompt:compressed', { newSize: finalBuffer.length })

          // If still too large, compress more aggressively
          if (finalBuffer.length > MAX_PHOTO_SIZE) {
            finalBuffer = await sharp(originalBuffer)
              .jpeg({ quality: 70 })
              .toBuffer()
            console.info('sendWithPrompt:compressed_more', { newSize: finalBuffer.length })
          }

          // If still too large after aggressive compression, resize the image
          if (finalBuffer.length > MAX_PHOTO_SIZE) {
            finalBuffer = await sharp(originalBuffer)
              .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 75 })
              .toBuffer()
            console.info('sendWithPrompt:resized', { newSize: finalBuffer.length })
          }
        } else if (isVideoContent && finalBuffer.length > MAX_PHOTO_SIZE * 2) {
          // Compress large videos with FFmpeg (20MB limit for videos)
          console.info('sendWithPrompt:compressing_video', { originalSize: finalBuffer.length })
          const compressedVideo = await compressVideoForTelegram(mediaUrl)
          if (compressedVideo) {
            finalBuffer = compressedVideo
            finalContentType = 'video/mp4'
            console.info('sendWithPrompt:video_compressed', { newSize: finalBuffer.length })
          } else {
            console.warn('sendWithPrompt:video_compression_failed, using original')
          }
        }

        const ext = isVideoContent ? 'mp4' : 'jpg'
        const filename = `ai-${Date.now()}.${ext}`
        const blob = new Blob([new Uint8Array(finalBuffer)], { type: finalContentType })

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
      const text = `${txtPrompt}\n<blockquote expandable>${escapeHtml(promptWithFingerprint)}</blockquote>`

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
    const generationId = Number(req.body?.generation_id || 0)

    if (!API || !chat_id || !photo) {
      return res.status(400).json({ ok: false, error: 'invalid payload' })
    }

    // Get user's language and watermark settings
    const { data: users } = await supaSelect('users', `?user_id=eq.${userId}&limit=1`)
    const userLang = users?.[0]?.language_code || null

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

    // Get bot username dynamically for AiVerseAppBot
    let appBotUsername = 'AiVerseAppBot'
    try {
      const me = await tg('getMe', {})
      if (me?.ok && me.result?.username) {
        appBotUsername = me.result.username
      }
    } catch (e) {
      console.error('Failed to get bot username', e)
    }

    // Build ref link
    const refParam = username || String(userId)
    const botLink = `https://t.me/${botName}?start=ref_${refParam}`

    // Build remix link for the second reference (ref + remix)
    const appLink = generationId
      ? `https://t.me/${appBotUsername}?startapp=ref-${refParam}-remix-${generationId}`
      : `https://t.me/${appBotUsername}?start=ref_${refParam}`

    // Add fingerprint to prompt
    const promptWithFingerprint = prompt ? addFingerprint(prompt, username, userId) : ''

    // Get localized messages
    const txtCreateSimilar = getTelegramMessage(userLang, 'createSimilar')
    const txtInBot = getTelegramMessage(userLang, 'inBot')
    const txtRepeatInApp = getTelegramMessage(userLang, 'repeatInApp')
    const txtAppName = getTelegramMessage(userLang, 'appName')
    const txtPrompt = getTelegramMessage(userLang, 'prompt')

    // Format caption
    const headerHtml = `${hashtag}\n\n${txtCreateSimilar}\n${txtInBot} - <a href="${botLink}">@${botName}</a>\n\n${txtRepeatInApp}\n<a href="${appLink}">${txtAppName}</a>`

    const promptHtml = promptWithFingerprint
      ? `\n\n${txtPrompt}\n<blockquote expandable>${escapeHtml(promptWithFingerprint)}</blockquote>`
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

