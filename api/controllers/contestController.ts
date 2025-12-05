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

        let query = `?select=*&order=created_at.desc`
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
        const currentUserId = req.query.user_id ? Number(req.query.user_id) : null

        if (!id) return res.status(400).json({ error: 'Contest ID required' })

        // Join with generations to get image details and users to get author info
        // NOW using contest_entries.likes_count instead of generations.likes_count
        // Also check contest_entry_likes for is_liked
        const select = `select=id,final_rank,prize_awarded,created_at,likes_count,remix_count,generation_id,generations!inner(id,image_url,prompt,model),users(username,first_name,last_name,avatar_url),contest_entry_likes(user_id)`

        let orderQuery = ''
        if (sort === 'popular') {
            orderQuery = '&order=likes_count.desc'
        } else {
            orderQuery = '&order=created_at.desc'
        }

        const query = `?contest_id=eq.${id}${orderQuery}&limit=${limit}&offset=${offset}&${select}&generations.model=neq.seedream4.5`

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
                    // Use contest-specific counts
                    likes_count: it.likes_count || 0,
                    remix_count: it.remix_count || 0,
                    prompt: gen.prompt,
                    model: gen.model,
                    is_liked: currentUserId ? likes.some((l: any) => l.user_id === currentUserId) : false
                },
                author: {
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

        // Check if contest is active
        const contestCheck = await supaSelect('contests', `?id=eq.${id}&select=status`)
        if (!contestCheck.ok || !contestCheck.data[0] || contestCheck.data[0].status !== 'active') {
            return res.status(400).json({ error: 'Contest is not active' })
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
}
