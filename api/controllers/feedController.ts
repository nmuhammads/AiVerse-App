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

async function supaPatch(table: string, filter: string, body: unknown) {
    const url = `${SUPABASE_URL}/rest/v1/${table}${filter}`
    const r = await fetch(url, { method: 'PATCH', headers: { ...supaHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await r.json().catch(() => null)
    return { ok: r.ok, data }
}

async function supaDelete(table: string, filter: string) {
    const url = `${SUPABASE_URL}/rest/v1/${table}${filter}`
    const r = await fetch(url, { method: 'DELETE', headers: { ...supaHeaders(), 'Content-Type': 'application/json' } })
    return { ok: r.ok }
}

export async function getFeed(req: Request, res: Response) {
    try {
        const limit = Number(req.query.limit || 20)
        const offset = Number(req.query.offset || 0)
        const sort = String(req.query.sort || 'new') // 'new' | 'popular'
        const currentUserId = req.query.user_id ? Number(req.query.user_id) : null

        if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' })

        // Select generations where is_published is true
        // Embed users to get author info
        // Embed generation_likes to calculate likes count and check if current user liked
        const select = `select=id,image_url,prompt,created_at,likes_count,user_id,users(username,first_name,last_name),generation_likes(user_id)`

        let order = 'created_at.desc'
        if (sort === 'popular') {
            order = 'likes_count.desc,created_at.desc'
        }

        const query = `?is_published=eq.true&order=${order}&limit=${limit}&offset=${offset}&${select}`

        const q = await supaSelect('generations', query)
        if (!q.ok) return res.status(500).json({ error: 'query failed', detail: q.data })

        const itemsRaw = Array.isArray(q.data) ? q.data : []

        const items = itemsRaw.map((it: any) => {
            const likes = Array.isArray(it.generation_likes) ? it.generation_likes : []
            const author = it.users || {}

            return {
                id: it.id,
                image_url: it.image_url,
                prompt: it.prompt,
                created_at: it.created_at,
                author: {
                    id: it.user_id,
                    username: author.username || 'User',
                    first_name: author.first_name,
                    avatar_url: author.username
                        ? `https://api.dicebear.com/9.x/avataaars/svg?seed=${author.username}`
                        : `https://api.dicebear.com/9.x/avataaars/svg?seed=${it.user_id}`
                },
                likes_count: it.likes_count || 0, // Use the column value
                is_liked: currentUserId ? likes.some((l: any) => l.user_id === currentUserId) : false
            }
        })

        return res.json({ items })
    } catch (e) {
        console.error('Feed error:', e)
        return res.status(500).json({ error: 'feed error' })
    }
}

export async function publishGeneration(req: Request, res: Response) {
    try {
        const { generationId, userId } = req.body
        if (!generationId || !userId) return res.status(400).json({ error: 'generationId and userId required' })

        // Verify ownership
        const q = await supaSelect('generations', `?id=eq.${generationId}&user_id=eq.${userId}&select=id`)
        if (!q.ok || !Array.isArray(q.data) || q.data.length === 0) {
            return res.status(403).json({ error: 'Generation not found or not owned by user' })
        }

        const update = await supaPatch('generations', `?id=eq.${generationId}`, { is_published: true })
        if (!update.ok) return res.status(500).json({ error: 'Failed to publish' })

        return res.json({ success: true })
    } catch (e) {
        return res.status(500).json({ error: 'publish error' })
    }
}

export async function toggleLike(req: Request, res: Response) {
    try {
        const { generationId, userId } = req.body
        if (!generationId || !userId) return res.status(400).json({ error: 'generationId and userId required' })

        // Check if already liked
        const check = await supaSelect('generation_likes', `?generation_id=eq.${generationId}&user_id=eq.${userId}&select=id`)
        const existing = Array.isArray(check.data) && check.data.length > 0 ? check.data[0] : null

        if (existing) {
            // Unlike
            await supaDelete('generation_likes', `?id=eq.${existing.id}`)
            return res.json({ liked: false })
        } else {
            // Like
            await supaPost('generation_likes', { generation_id: generationId, user_id: userId })
            return res.json({ liked: true })
        }
    } catch (e) {
        return res.status(500).json({ error: 'like error' })
    }
}
