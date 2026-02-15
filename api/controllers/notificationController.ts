import { Request, Response } from 'express'
import { supaSelect, supaPost, supaPatch, supaDelete, supaHeaders, SUPABASE_URL, SUPABASE_KEY } from '../services/supabaseService.js'

// Default notification settings
const defaultSettings = {
    telegram_news: false,
    telegram_remix: true,
    telegram_generation: true,
    telegram_likes: true
}

// Helper: Get user notification settings
export async function getUserNotificationSettings(userId: number): Promise<typeof defaultSettings> {
    try {
        const q = await supaSelect('users', `?user_id=eq.${userId}&select=notification_settings`)
        if (q.ok && Array.isArray(q.data) && q.data.length > 0 && q.data[0].notification_settings) {
            return { ...defaultSettings, ...q.data[0].notification_settings }
        }
    } catch (e) {
        console.error('[Notification] Failed to get user settings:', e)
    }
    return defaultSettings
}

// GET /api/notifications?user_id=X
export async function getNotifications(req: Request, res: Response) {
    const { user_id } = req.query
    if (!user_id) return res.status(400).json({ error: 'user_id required' })

    const q = await supaSelect('notifications', `?user_id=eq.${user_id}&order=created_at.desc&limit=20`)
    if (!q.ok) return res.status(500).json({ error: 'Failed to fetch' })

    return res.json({ items: q.data || [] })
}

// GET /api/app-news?user_id=X
export async function getAppNews(req: Request, res: Response) {
    const { user_id } = req.query
    const now = new Date().toISOString()

    // Get active news
    const q = await supaSelect('app_news', `?starts_at=lte.${now}&or=(expires_at.is.null,expires_at.gte.${now})&order=created_at.desc&limit=10`)
    if (!q.ok) return res.status(500).json({ error: 'Failed to fetch' })

    const newsItems = q.data || []

    // If user_id provided, mark which ones are read
    if (user_id && newsItems.length > 0) {
        const readQ = await supaSelect('user_read_news', `?user_id=eq.${user_id}&select=news_id`)
        const readIds = new Set((readQ.data || []).map((r: { news_id: number }) => r.news_id))

        const itemsWithRead = newsItems.map((item: { id: number }) => ({
            ...item,
            read: readIds.has(item.id)
        }))
        return res.json({ items: itemsWithRead })
    }

    return res.json({ items: newsItems })
}

// GET /api/notifications/count?user_id=X
export async function getUnreadCount(req: Request, res: Response) {
    const { user_id } = req.query
    if (!user_id) return res.status(400).json({ error: 'user_id required' })

    // Count personal unread
    const personal = await supaSelect('notifications', `?user_id=eq.${user_id}&read=eq.false&select=id`)
    const personalCount = Array.isArray(personal.data) ? personal.data.length : 0

    // Count unread news (total active - already read)
    const now = new Date().toISOString()
    const news = await supaSelect('app_news', `?starts_at=lte.${now}&or=(expires_at.is.null,expires_at.gte.${now})&select=id`)
    const activeNewsIds = Array.isArray(news.data) ? news.data.map((n: { id: number }) => n.id) : []

    const readNews = await supaSelect('user_read_news', `?user_id=eq.${user_id}&select=news_id`)
    const readNewsIds = new Set((readNews.data || []).map((r: { news_id: number }) => r.news_id))

    const unreadNewsCount = activeNewsIds.filter((id: number) => !readNewsIds.has(id)).length

    return res.json({ personal: personalCount, news: unreadNewsCount, total: personalCount + unreadNewsCount })
}

// POST /api/notifications/read-all
export async function markAllRead(req: Request, res: Response) {
    const { user_id } = req.body
    if (!user_id) return res.status(400).json({ error: 'user_id required' })

    await supaPatch('notifications', `?user_id=eq.${user_id}&read=eq.false`, { read: true })
    return res.json({ ok: true })
}

// POST /api/app-news/read-all
export async function markAllNewsRead(req: Request, res: Response) {
    const { user_id } = req.body
    if (!user_id) return res.status(400).json({ error: 'user_id required' })

    // Get all active news IDs
    const now = new Date().toISOString()
    const news = await supaSelect('app_news', `?starts_at=lte.${now}&or=(expires_at.is.null,expires_at.gte.${now})&select=id`)
    const newsIds = Array.isArray(news.data) ? news.data.map((n: { id: number }) => n.id) : []

    // Insert read records for each (ignore duplicates)
    for (const newsId of newsIds) {
        await supaPost('user_read_news', { user_id, news_id: newsId }, '?on_conflict=user_id,news_id')
    }

    return res.json({ ok: true, marked: newsIds.length })
}

// PATCH /api/user/notification-settings
export async function updateNotificationSettings(req: Request, res: Response) {
    const { user_id, settings } = req.body
    if (!user_id || !settings) return res.status(400).json({ error: 'user_id and settings required' })

    await supaPatch('users', `?user_id=eq.${user_id}`, { notification_settings: settings })
    return res.json({ ok: true })
}

// Helper: Create notification for a user
export async function createNotification(
    userId: number,
    type: string,
    title: string,
    body: string,
    data?: Record<string, unknown>
) {
    // Delete oldest if over limit (20)
    const existing = await supaSelect('notifications', `?user_id=eq.${userId}&order=created_at.desc&select=id`)
    if (Array.isArray(existing.data) && existing.data.length >= 20) {
        const toDelete = existing.data.slice(19).map((n: { id: number }) => n.id)
        if (toDelete.length > 0) {
            // Delete old ones
            const chunkSize = 50
            for (let i = 0; i < toDelete.length; i += chunkSize) {
                const chunk = toDelete.slice(i, i + chunkSize)
                await supaDelete('notifications', `?id=in.(${chunk.join(',')})`)
            }
        }
    }

    await supaPost('notifications', {
        user_id: userId,
        type,
        title,
        body,
        data: data || {},
        read: false
    })
}

// POST /api/notifications/cleanup - Cron job to delete old notifications (30 days)
export async function cleanupOldNotifications(req: Request, res: Response) {
    try {
        // Only allow with secret key (for cron security)
        const cronSecret = req.headers['x-cron-secret'] || req.query.secret
        const expectedSecret = process.env.CRON_SECRET || 'aiverse-cron-secret'

        if (cronSecret !== expectedSecret) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

        // Delete old notifications
        const notifResp = await fetch(`${SUPABASE_URL}/rest/v1/notifications?created_at=lt.${thirtyDaysAgo}`, {
            method: 'DELETE',
            headers: supaHeaders()
        })

        // Delete expired app_news
        const newsResp = await fetch(`${SUPABASE_URL}/rest/v1/app_news?expires_at=lt.${thirtyDaysAgo}`, {
            method: 'DELETE',
            headers: supaHeaders()
        })

        console.log(`[Cron] Cleaned up old notifications (older than ${thirtyDaysAgo})`)
        return res.json({ ok: true, cleaned_before: thirtyDaysAgo })
    } catch (e) {
        console.error('[Cron] Cleanup failed:', e)
        return res.status(500).json({ error: 'Cleanup failed' })
    }
}

// POST /api/app-news/broadcast - Send news to all users with telegram_news=true
export async function broadcastNews(req: Request, res: Response) {
    try {
        const { news_id, secret } = req.body

        // Security check
        const expectedSecret = process.env.CRON_SECRET || 'aiverse-cron-secret'
        if (secret !== expectedSecret) {
            return res.status(401).json({ error: 'Unauthorized' })
        }

        if (!news_id) {
            return res.status(400).json({ error: 'news_id required' })
        }

        // 1. Get news item
        const newsQ = await supaSelect('app_news', `?id=eq.${news_id}&select=*`)
        if (!newsQ.ok || !Array.isArray(newsQ.data) || newsQ.data.length === 0) {
            return res.status(404).json({ error: 'News not found' })
        }
        const news = newsQ.data[0]

        // 2. Get all users with telegram_news=true
        // We check notification_settings->telegram_news = true
        const usersQ = await supaSelect('users', `?select=user_id,notification_settings`)
        if (!usersQ.ok || !Array.isArray(usersQ.data)) {
            return res.status(500).json({ error: 'Failed to fetch users' })
        }

        const usersToNotify = usersQ.data.filter((u: any) => {
            const settings = u.notification_settings || defaultSettings
            return settings.telegram_news === true
        })

        // 3. Send Telegram message to each user
        const { tg } = await import('./telegramController.js')
        let sent = 0
        let failed = 0

        for (const user of usersToNotify) {
            try {
                const text = `📢 <b>${news.title}</b>\n\n${news.body}${news.action_url ? `\n\n<a href="${news.action_url}">Подробнее →</a>` : ''}`

                if (news.image_url) {
                    await tg('sendPhoto', {
                        chat_id: user.user_id,
                        photo: news.image_url,
                        caption: text,
                        parse_mode: 'HTML'
                    })
                } else {
                    await tg('sendMessage', {
                        chat_id: user.user_id,
                        text: text,
                        parse_mode: 'HTML',
                        disable_web_page_preview: !news.action_url
                    })
                }
                sent++
            } catch (e) {
                failed++
                console.error(`[Broadcast] Failed to send to ${user.user_id}:`, e)
            }
        }

        console.log(`[Broadcast] News ${news_id} sent to ${sent} users, ${failed} failed`)
        return res.json({
            ok: true,
            news_id,
            total_eligible: usersToNotify.length,
            sent,
            failed
        })
    } catch (e) {
        console.error('[Broadcast] Error:', e)
        return res.status(500).json({ error: 'Broadcast failed' })
    }
}
