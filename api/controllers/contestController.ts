import { Request, Response } from 'express'

function stripQuotes(s: string) { return s.trim().replace(/^['"`]+|['"`]+$/g, '') }

const SUPABASE_URL = stripQuotes(process.env.SUPABASE_URL || '')
const SUPABASE_KEY = stripQuotes(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '')

function supaHeaders() {
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
    } as Record<string, string>
}

async function supaSelect(table: string, query: string) {
    const url = `${SUPABASE_URL}/rest/v1/${table}${query}`
    const r = await fetch(url, { headers: { ...supaHeaders(), 'Content-Type': 'application/json', 'Prefer': 'count=exact' } })
    const data = await r.json().catch(() => null)
    return { ok: r.ok, data, headers: Object.fromEntries(r.headers.entries()) }
}

async function supaPost(table: string, body: unknown, params = '') {
    const url = `${SUPABASE_URL}/rest/v1/${table}${params}`
    const r = await fetch(url, { method: 'POST', headers: { ...supaHeaders(), 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(body) })
    const data = await r.json().catch(() => null)
    return { ok: r.ok, data }
}

export async function getContests(req: Request, res: Response) {
    try {
        const status = req.query.status ? String(req.query.status) : 'active'

        let query = `?select=*&order=created_at.desc&is_approved=is.true`
        if (status === 'active') {
            query += `&status=eq.active`
        } else if (status === 'completed') {
            query += `&status=eq.completed`
        } else if (status === 'upcoming') {
            query += `&status=eq.upcoming`
        }

        const q = await supaSelect('contests', query)
        if (!q.ok) return res.status(500).json({ error: 'Failed to fetch contests' })

        return res.json({ items: q.data })
    } catch (e) {
        console.error('getContests error:', e)
        return res.status(500).json({ error: 'Internal server error' })
    }
}

export async function getContestDetails(req: Request, res: Response) {
    try {
        const { id } = req.params
        if (!id) return res.status(400).json({ error: 'Contest ID required' })

        const q = await supaSelect('contests', `?id=eq.${id}&select=*`)
        if (!q.ok || !Array.isArray(q.data) || q.data.length === 0) {
            return res.status(404).json({ error: 'Contest not found' })
        }

        return res.json(q.data[0])
    } catch (e) {
        console.error('getContestDetails error:', e)
        return res.status(500).json({ error: 'Internal server error' })
    }
}

export async function getContestEntries(req: Request, res: Response) {
    try {
        const { id } = req.params
        const limit = Number(req.query.limit || 50)
        const offset = Number(req.query.offset || 0)
        const sort = String(req.query.sort || 'popular') // 'popular' | 'new'
        const model = req.query.model && req.query.model !== 'all' ? String(req.query.model) : null
        const currentUserId = req.query.user_id ? Number(req.query.user_id) : null

        if (!id) return res.status(400).json({ error: 'Contest ID required' })

        // Join with generations to get image details and users to get author info
        // NOW using contest_entries.likes_count instead of generations.likes_count
        // Also check contest_entry_likes for is_liked
        const select = `select=id,user_id,final_rank,prize_awarded,created_at,likes_count,remix_count,generation_id,generations!inner(id,image_url,prompt,model),users(username,first_name,last_name,avatar_url),contest_entry_likes(user_id)`

        let orderQuery = ''
        if (sort === 'popular') {
            orderQuery = '&order=likes_count.desc'
        } else {
            orderQuery = '&order=created_at.desc'
        }

        let query = `?contest_id=eq.${id}${orderQuery}&limit=${limit}&offset=${offset}&${select}&generations.or=(model.neq.seedream4.5,model.is.null)`

        if (model) {
            query += `&generations.model=eq.${model}`
        }

        const q = await supaSelect('contest_entries', query)
        if (!q.ok) return res.status(500).json({ error: 'Failed to fetch entries', detail: q.data })

        const items = (q.data as any[]).map(it => {
            const gen = it.generations || {}
            const author = it.users || {}
            const likes = Array.isArray(it.contest_entry_likes) ? it.contest_entry_likes : []

            return {
                id: it.id,
                generation: {
                    id: gen.id,
                    image_url: gen.image_url,
                    compressed_url: process.env.R2_PUBLIC_URL_THUMBNAILS ? `${process.env.R2_PUBLIC_URL_THUMBNAILS}/gen_${gen.id}_thumb.jpg` : null,
                    // Use contest-specific counts
                    likes_count: it.likes_count || 0,
                    remix_count: it.remix_count || 0,
                    prompt: gen.prompt,
                    model: gen.model,
                    is_liked: currentUserId ? likes.some((l: any) => l.user_id === currentUserId) : false
                },
                author: {
                    id: it.user_id,
                    username: author.username ? `@${author.username}` : (author.first_name || 'User'),
                    avatar_url: author.avatar_url,
                    first_name: author.first_name
                },
                final_rank: it.final_rank,
                prize_awarded: it.prize_awarded,
                created_at: it.created_at
            }
        })

        return res.json({ items })
    } catch (e) {
        console.error('getContestEntries error:', e)
        return res.status(500).json({ error: 'Internal server error' })
    }
}

export async function joinContest(req: Request, res: Response) {
    try {
        const { id } = req.params
        const { userId, generationId } = req.body

        if (!id || !userId || !generationId) return res.status(400).json({ error: 'Missing required fields' })

        // Check if contest is active and what content is allowed
        const contestCheck = await supaSelect('contests', `?id=eq.${id}&select=status,allowed_content_types`)
        if (!contestCheck.ok || !contestCheck.data[0]) {
            return res.status(404).json({ error: 'Contest not found' })
        }

        const contest = contestCheck.data[0]
        if (contest.status !== 'active') {
            return res.status(400).json({ error: 'Contest is not active' })
        }

        const allowedTypes = contest.allowed_content_types || 'both'

        // Get generation media type
        const genCheck = await supaSelect('generations', `?id=eq.${generationId}&select=media_type`)
        if (!genCheck.ok || !genCheck.data[0]) {
            return res.status(404).json({ error: 'Generation not found' })
        }

        const mediaType = genCheck.data[0].media_type || 'image'

        // Validate content type
        if (allowedTypes !== 'both' && allowedTypes !== mediaType) {
            const errorMsg = allowedTypes === 'image'
                ? 'Only photo submissions are allowed for this contest'
                : 'Only video submissions are allowed for this contest'
            return res.status(400).json({ error: errorMsg })
        }

        // Check if already joined with this generation
        const entryCheck = await supaSelect('contest_entries', `?contest_id=eq.${id}&generation_id=eq.${generationId}&select=id`)
        if (entryCheck.ok && entryCheck.data.length > 0) {
            return res.status(400).json({ error: 'This generation is already in the contest' })
        }

        // Insert entry
        const insert = await supaPost('contest_entries', {
            contest_id: id,
            user_id: userId,
            generation_id: generationId,
            likes_count: 0,
            remix_count: 0
        })

        if (!insert.ok) return res.status(500).json({ error: 'Failed to join contest' })

        return res.json({ success: true, entry: insert.data[0] })
    } catch (e) {
        console.error('joinContest error:', e)
        return res.status(500).json({ error: 'Internal server error' })
    }
}

export async function likeContestEntry(req: Request, res: Response) {
    try {
        const { entryId, userId } = req.body
        if (!entryId || !userId) return res.status(400).json({ error: 'Missing entryId or userId' })

        // Check if already liked
        const check = await supaSelect('contest_entry_likes', `?contest_entry_id=eq.${entryId}&user_id=eq.${userId}&select=id`)
        const isLiked = check.ok && check.data.length > 0

        if (isLiked) {
            // Unlike
            const likeId = check.data[0].id
            await fetch(`${SUPABASE_URL}/rest/v1/contest_entry_likes?id=eq.${likeId}`, {
                method: 'DELETE',
                headers: supaHeaders()
            })

            // Decrement count
            const entry = await supaSelect('contest_entries', `?id=eq.${entryId}&select=likes_count`)
            if (entry.ok && entry.data.length > 0) {
                const newCount = Math.max(0, (entry.data[0].likes_count || 0) - 1)
                await fetch(`${SUPABASE_URL}/rest/v1/contest_entries?id=eq.${entryId}`, {
                    method: 'PATCH',
                    headers: { ...supaHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ likes_count: newCount })
                })
            }
            return res.json({ success: true, liked: false })
        } else {
            // Like
            await supaPost('contest_entry_likes', {
                contest_entry_id: entryId,
                user_id: userId
            })

            // Increment count
            const entry = await supaSelect('contest_entries', `?id=eq.${entryId}&select=likes_count`)
            if (entry.ok && entry.data.length > 0) {
                const newCount = (entry.data[0].likes_count || 0) + 1
                await fetch(`${SUPABASE_URL}/rest/v1/contest_entries?id=eq.${entryId}`, {
                    method: 'PATCH',
                    headers: { ...supaHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ likes_count: newCount })
                })
            }
            return res.json({ success: true, liked: true })
        }
    } catch (e) {
        console.error('likeContestEntry error:', e)
        return res.status(500).json({ error: 'Internal server error' })
    }
    // ... (existing code: likeContestEntry)
}


import { uploadImageToVideoBucket } from '../services/r2Service.js'

export async function createContestProposal(req: Request, res: Response) {
    try {
        const { title, description, rules, prizes, start_date, end_date, allowed_content_types, organizer_name, banner_image, user_id } = req.body

        if (!title || !description || !user_id) return res.status(400).json({ error: 'Missing required fields' })

        // 1. Upload banner if provided
        let image_url = null
        if (banner_image) {
            image_url = await uploadImageToVideoBucket(banner_image, 'contest-banners')
        }

        // 2. Create contest record (is_approved = false)
        const contestData = {
            title,
            description,
            rules: rules || '',
            prizes: prizes || '',
            start_date: start_date || new Date().toISOString(),
            end_date: end_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'upcoming',
            allowed_content_types: allowed_content_types || 'both',
            organizer_name: organizer_name || 'User',
            image_url,
            is_approved: false,
            proposed_by: user_id,
            proposal_status: 'pending'
        }

        const insert = await supaPost('contests', contestData)
        if (!insert.ok) {
            console.error('createContestProposal DB error:', insert.data)
            return res.status(500).json({ error: 'Failed to create proposal' })
        }

        const newContest = insert.data[0]

        // 3. Notify Admin (ID: 817308975)
        const ADMIN_ID = 817308975
        const { tg } = await import('./telegramController.js')

        // Format prizes for message
        let prizesText = ''
        try {
            const p = typeof prizes === 'string' ? JSON.parse(prizes) : prizes
            if (p) {
                if (p['1']) prizesText += `\n🥇 1 место: ${p['1']}`
                if (p['2']) prizesText += `\n🥈 2 место: ${p['2']}`
                if (p['3']) prizesText += `\n🥉 3 место: ${p['3']}`
            }
        } catch (e) {
            console.error('Error parsing prizes for message', e)
        }

        // Helper to escape HTML special chars
        const escapeHtml = (unsafe: string) => unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        const msgText = `📋 <b>Новое предложение конкурса!</b>\n\n` +
            `<b>Название:</b> ${escapeHtml(title)}\n` +
            `<b>Организатор:</b> ${escapeHtml(organizer_name)}\n` +
            (prizesText ? `<b>Призы:</b>${escapeHtml(prizesText)}\n` : '') +
            `<b>Описание:</b> ${escapeHtml(description.slice(0, 100))}...\n` +
            `<b>Тип контента:</b> ${escapeHtml(allowed_content_types || 'both')}\n` +
            `<b>От пользователя:</b> <a href="tg://user?id=${user_id}">ID: ${user_id}</a>\n\n` +
            `<i>Конкурс создан со статусом "upcoming" и требует одобрения (is_approved = true) в базе данных.</i>`

        try {
            if (image_url) {
                await tg('sendPhoto', {
                    chat_id: ADMIN_ID,
                    photo: image_url,
                    caption: msgText,
                    parse_mode: 'HTML'
                })
            } else {
                await tg('sendMessage', {
                    chat_id: ADMIN_ID,
                    text: msgText,
                    parse_mode: 'HTML'
                })
            }
        } catch (notifyError) {
            console.error('Failed to notify admin about contest proposal:', notifyError)
        }

        return res.json({ success: true, contest: newContest })

    } catch (e) {
        console.error('createContestProposal error:', e)
        return res.status(500).json({ error: 'Internal server error' })
    }
}
