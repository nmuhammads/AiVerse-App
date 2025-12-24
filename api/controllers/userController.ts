import { Request, Response } from 'express'
import {
  supaSelect,
  supaPost,
  supaPatch,
  SUPABASE_URL,
  SUPABASE_KEY,
  supaHeaders
} from '../services/supabaseService.js'
import { uploadImageFromBase64, uploadImageFromUrl } from '../services/r2Service.js'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const DEFAULT_BOT_SOURCE = process.env.TELEGRAM_BOT_USERNAME || 'AiVerseAppBot'

// signed URL helper can be added when bucket is private

function sanitizeUrl(u: unknown): string | null {
  if (!u) return null
  const s = String(u).trim()
  const cleaned = s.replace(/^['"`\s]+/, '').replace(/['"`\s]+$/, '')
  return cleaned || null
}

// Sync avatar from Telegram to R2
export async function syncAvatar(req: Request, res: Response) {
  try {
    const { userId } = req.body
    if (!userId) return res.status(400).json({ error: 'userId required' })

    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' })

    // 1. Check if user already has an avatar_url in users table
    // Optimization: If it's already an R2 URL, we can skip sync (unless forced)
    const userQuery = await supaSelect('users', `?user_id=eq.${userId}&select=avatar_url`)
    const currentAvatarUrl = (userQuery.ok && Array.isArray(userQuery.data)) ? userQuery.data[0]?.avatar_url : null

    // If we want to force update even if exists, we can remove this check. 
    // But usually sync is called often, so we should check.
    // However, user said "users can re-upload". 
    // Let's assume sync is "get latest from telegram". 
    // If we want to migrate, we should probably allow updating if it's NOT an R2 url.
    const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ''
    if (currentAvatarUrl && currentAvatarUrl.startsWith(R2_PUBLIC_URL)) {
      return res.json({ ok: true, avatar_url: currentAvatarUrl, message: 'already on R2' })
    }

    // 2. Fetch from Telegram
    if (!TOKEN) return res.status(500).json({ error: 'Telegram token not configured' })

    const photosResp = await fetch(`https://api.telegram.org/bot${TOKEN}/getUserProfilePhotos?user_id=${userId}&limit=1`)
    const photosJson = await photosResp.json()
    const first = photosJson?.result?.photos?.[0]

    if (!first) {
      return res.json({ ok: true, message: 'no telegram photos' })
    }

    // Get the largest size
    const largest = first[first.length - 1]
    const fileResp = await fetch(`https://api.telegram.org/bot${TOKEN}/getFile?file_id=${largest.file_id}`)
    const fileJson = await fileResp.json()
    const filePathTg = fileJson?.result?.file_path

    if (!filePathTg) return res.status(404).json({ error: 'telegram file path not found' })

    // Download image URL
    const downloadUrl = `https://api.telegram.org/file/bot${TOKEN}/${filePathTg}`

    // 3. Upload to R2
    console.log(`[Avatar] Syncing from Telegram to R2: ${downloadUrl}`)
    const publicUrl = await uploadImageFromUrl(downloadUrl, 'avatars')

    // 4. Update users table
    const update = await supaPatch('users', `?user_id=eq.${userId}`, { avatar_url: publicUrl })
    if (!update.ok) return res.status(500).json({ error: 'db update failed', detail: update.data })

    return res.json({ ok: true, avatar_url: publicUrl })

  } catch (e) {
    console.error('syncAvatar error:', e)
    return res.status(500).json({ error: 'sync failed' })
  }
}

export async function getAvatar(req: Request, res: Response) {
  try {
    const userId = req.params.userId
    if (!userId) return res.status(400).json({ error: 'userId required' })

    // Fetch avatar_url from DB
    const q = await supaSelect('users', `?user_id=eq.${userId}&select=avatar_url`)
    const row = (q.ok && Array.isArray(q.data)) ? q.data[0] : null

    if (row && row.avatar_url) {
      return res.redirect(row.avatar_url)
    }

    return res.status(404).json({ error: 'avatar not found' })
  } catch (e) {
    console.error('getAvatar error:', e)
    return res.status(500).json({ error: 'internal error' })
  }
}

export async function uploadAvatar(req: Request, res: Response) {
  try {
    const { userId, imageBase64 } = req.body || {}
    if (!userId || !imageBase64) return res.status(400).json({ error: 'invalid payload' })

    // Upload to R2
    console.log(`[Avatar] Manual upload to R2 for user ${userId}`)
    const publicUrl = await uploadImageFromBase64(imageBase64, 'avatars')

    // Update DB
    const upd = await supaPatch('users', `?user_id=eq.${userId}`, { avatar_url: publicUrl })
    if (!upd.ok) return res.status(500).json({ error: 'db update failed', detail: upd.data })

    return res.json({ ok: true, avatar_url: publicUrl })
  } catch (e) {
    console.error('uploadAvatar error:', e)
    return res.status(500).json({ error: 'upload failed' })
  }
}

export async function setCover(req: Request, res: Response) {
  try {
    const { userId, generationId, imageUrl } = req.body
    if (!userId || (!generationId && !imageUrl)) return res.status(400).json({ error: 'invalid payload' })

    // If generationId is provided, we could verify it or just use the imageUrl provided by client (assuming it came from a trusted list)
    // For simplicity and speed per request, we'll trust the imageUrl sent (which comes from a generation object)
    // Or we could fetch it. Let's rely on imageUrl being passed or fetched if missing.

    let urlToSet = imageUrl

    if (!urlToSet && generationId) {
      // Fetch generation image url
      const q = await supaSelect('generations', `?id=eq.${generationId}&select=image_url`)
      if (q.ok && Array.isArray(q.data) && q.data.length > 0) {
        urlToSet = q.data[0].image_url
      }
    }

    if (!urlToSet) return res.status(400).json({ error: 'image not found' })

    const upd = await supaPatch('users', `?user_id=eq.${userId}`, { cover_url: urlToSet })
    if (!upd.ok) return res.status(500).json({ error: 'db update failed', detail: upd.data })

    return res.json({ ok: true, cover_url: urlToSet })
  } catch (e) {
    console.error('setCover error:', e)
    return res.status(500).json({ error: 'setCover failed' })
  }
}



export async function getUserInfo(req: Request, res: Response) {
  try {
    const userId = req.params.userId
    const viewerId = req.query.viewer_id ? Number(req.query.viewer_id) : null
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' })

    // Parallel fetch: User Info + Likes Count + Following Count + Followers Count + Follow Status (if viewerId provided)
    const promises: Promise<any>[] = [
      supaSelect('users', `?user_id=eq.${encodeURIComponent(userId)}&select=user_id,username,first_name,last_name,is_premium,balance,remix_count,updated_at,avatar_url,cover_url,spins,notification_settings`),
      fetch(`${SUPABASE_URL}/rest/v1/rpc/get_user_likes_count`, {
        method: 'POST',
        headers: { ...supaHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: userId })
      }),
      // Count how many users this user is following
      supaSelect('user_subscriptions', `?follower_id=eq.${userId}&select=id`),
      // Count how many followers this user has
      supaSelect('user_subscriptions', `?following_id=eq.${userId}&select=id`)
    ]

    // Add follow status check if viewerId is provided
    if (viewerId && viewerId !== Number(userId)) {
      promises.push(
        supaSelect('user_subscriptions', `?follower_id=eq.${viewerId}&following_id=eq.${userId}&select=id`)
      )
    }

    const results = await Promise.all(promises)
    const userQuery = results[0]
    const likesQuery = results[1]
    const followingCountQuery = results[2]
    const followersCountQuery = results[3]
    const followQuery = results[4] || null

    if (!userQuery.ok) return res.status(500).json({ error: 'query failed', detail: userQuery.data })
    const row = Array.isArray(userQuery.data) ? userQuery.data[0] : null
    if (!row) return res.status(404).json({ error: 'user not found' })

    const likesCount = await likesQuery.json().catch(() => 0)
    const followingCount = followingCountQuery.ok && Array.isArray(followingCountQuery.data) ? followingCountQuery.data.length : 0
    const followersCount = followersCountQuery.ok && Array.isArray(followersCountQuery.data) ? followersCountQuery.data.length : 0
    const isFollowing = followQuery ? (Array.isArray(followQuery.data) && followQuery.data.length > 0) : false

    return res.json({
      ...row,
      likes_count: typeof likesCount === 'number' ? likesCount : 0,
      following_count: followingCount,
      followers_count: followersCount,
      is_following: isFollowing
    })
  } catch {
    return res.status(500).json({ error: 'user info error' })
  }
}

export async function subscribeBot(req: Request, res: Response) {
  try {
    const { userId, botSource, username, first_name, last_name, language_code, ref } = req.body || {}
    const u = Number(userId)
    const src = String(botSource || DEFAULT_BOT_SOURCE)

    if (!u || !src) return res.status(400).json({ error: 'invalid payload' })
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' })

    // Handle referral: only set if user doesn't have one yet
    let refToSet: string | undefined = undefined
    if (ref) {
      const existingUser = await supaSelect('users', `?user_id=eq.${u}&select=ref`)
      if (existingUser.ok && Array.isArray(existingUser.data) && existingUser.data[0]) {
        // User exists, only set ref if they don't have one
        if (!existingUser.data[0].ref) {
          refToSet = String(ref)
          console.log(`[Referral] Setting ref=${refToSet} for existing user ${u}`)
        } else {
          console.log(`[Referral] User ${u} already has ref=${existingUser.data[0].ref}, skipping`)
        }
      } else {
        // New user, can set ref
        refToSet = String(ref)
        console.log(`[Referral] Setting ref=${refToSet} for new user ${u}`)
      }
    }

    // 1. Ensure user exists in 'users' table
    const userPayload: Record<string, unknown> = {
      user_id: u,
      username: username || null,
      first_name: first_name || null,
      last_name: last_name || null,
      language_code: language_code || null,
      updated_at: new Date().toISOString()
    }

    // Only add ref to payload if we determined it should be set
    if (refToSet) {
      userPayload.ref = refToSet
    }

    const userUpsert = await supaPost('users', userPayload, '?on_conflict=user_id')
    if (!userUpsert.ok) {
      console.error('subscribeBot: user upsert failed', userUpsert.data)
    }

    // 2. Create subscription
    const r = await supaPost('bot_subscriptions', { user_id: u, bot_source: src }, `?on_conflict=user_id,bot_source`)
    if (!r.ok) return res.status(500).json({ error: 'upsert failed', detail: r.data })

    return res.json({ ok: true })
  } catch (e) {
    console.error('subscribeBot error:', e)
    return res.status(500).json({ error: 'subscribe failed' })
  }
}

export async function listGenerations(req: Request, res: Response) {
  try {
    const userId = String(req.query.user_id || '')
    const limit = Number(req.query.limit || 6)
    const offset = Number(req.query.offset || 0)
    const publishedOnly = req.query.published_only === 'true'
    const viewerId = req.query.viewer_id ? Number(req.query.viewer_id) : null
    const modelFilter = req.query.model ? String(req.query.model) : null
    const visibility = String(req.query.visibility || 'all')

    if (!userId) return res.status(400).json({ error: 'user_id required' })
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' })

    // Enhanced query to get full details
    let select = `select=id,image_url,prompt,created_at,is_published,model,likes_count,remix_count,input_images,user_id,edit_variants,users(username,first_name,last_name,avatar_url),generation_likes(user_id)`
    let query = `?user_id=eq.${encodeURIComponent(userId)}&status=neq.deleted&image_url=ilike.http%25&model=neq.seedream4.5&${select}&order=created_at.desc&limit=${limit}&offset=${offset}`

    // Legacy: published_only support
    if (publishedOnly) {
      query += `&is_published=eq.true`
    }

    // New: model filter (comma-separated list)
    if (modelFilter) {
      const models = modelFilter.split(',').map(m => m.trim()).filter(Boolean)
      if (models.length > 0) {
        query += `&model=in.(${models.join(',')})`
      }
    }

    // New: visibility filter
    if (visibility === 'published') {
      query += `&is_published=eq.true`
    } else if (visibility === 'private') {
      query += `&is_published=eq.false`
    }

    const q = await supaSelect('generations', query)
    if (!q.ok) return res.status(500).json({ error: 'query failed', detail: q.data })

    const itemsRaw = Array.isArray(q.data) ? q.data : []

    const items = itemsRaw.map((it: any) => {
      const likes = Array.isArray(it.generation_likes) ? it.generation_likes : []
      const author = it.users || {}

      return {
        id: it.id,
        image_url: sanitizeUrl(it.image_url),
        compressed_url: process.env.R2_PUBLIC_URL_THUMBNAILS ? `${process.env.R2_PUBLIC_URL_THUMBNAILS}/gen_${it.id}_thumb.jpg` : null,
        prompt: String(it.prompt || ''),
        created_at: it.created_at || null,
        is_published: !!it.is_published,
        model: it.model || null,
        likes_count: it.likes_count || 0,
        remix_count: it.remix_count || 0,
        input_images: it.input_images || [],
        edit_variants: it.edit_variants || null,
        is_liked: viewerId ? likes.some((l: any) => l.user_id === viewerId) : false,
        author: {
          id: it.user_id,
          username: author.username ? `@${author.username}` : (author.first_name ? `${author.first_name} ${author.last_name || ''}`.trim() : 'User'),
          first_name: author.first_name,
          avatar_url: author.avatar_url || (author.username
            ? `https://api.dicebear.com/9.x/avataaars/svg?seed=${author.username}`
            : `https://api.dicebear.com/9.x/avataaars/svg?seed=${it.user_id}`)
        }
      }
    })

    const cr = String(q.headers['content-range'] || '')
    const total = (() => { const m = /\d+-\d+\/(\d+)/.exec(cr); return m ? Number(m[1]) : undefined })()
    return res.json({ items, total })
  } catch {
    return res.status(500).json({ error: 'list generations failed' })
  }
}

export async function togglePublish(req: Request, res: Response) {
  try {
    const { generationId, isPublished } = req.body
    if (!generationId) return res.status(400).json({ error: 'generationId required' })

    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' })

    const update = await supaPatch('generations', `?id=eq.${generationId}`, { is_published: !!isPublished })
    if (!update.ok) return res.status(500).json({ error: 'update failed', detail: update.data })

    return res.json({ ok: true, is_published: !!isPublished })
  } catch (e) {
    console.error('togglePublish error:', e)
    return res.status(500).json({ error: 'internal error' })
  }
}

export async function getLeaderboard(req: Request, res: Response) {
  try {
    const limit = Number(req.query.limit || 10)
    const offset = Number(req.query.offset || 0)
    const type = String(req.query.type || 'likes')
    const period = String(req.query.period || 'month')

    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' })

    // 1. Remixes + All Time (Query Users Table)
    if (type === 'remixes' && period === 'all_time') {
      const q = await supaSelect('users', `?select=user_id,username,first_name,avatar_url,remix_count&remix_count=gt.0&order=remix_count.desc&limit=${limit}&offset=${offset}`)
      if (!q.ok) return res.status(500).json({ error: 'query failed', detail: q.data })
      return res.json({ items: Array.isArray(q.data) ? q.data : [] })
    }

    // Determine RPC name based on type and period
    let rpcName = 'get_monthly_leaderboard' // Default: Likes + Month

    if (type === 'likes' && period === 'all_time') {
      rpcName = 'get_all_time_likes_leaderboard'
    } else if (type === 'remixes' && period === 'month') {
      rpcName = 'get_monthly_remixes_leaderboard'
    }

    const url = `${SUPABASE_URL}/rest/v1/rpc/${rpcName}`
    const r = await fetch(url, {
      method: 'POST',
      headers: { ...supaHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit_val: limit, offset_val: offset })
    })

    const data = await r.json().catch(() => null)
    if (!r.ok) return res.status(500).json({ error: 'rpc failed', detail: data })

    return res.json({ items: data })
  } catch (e) {
    console.error('getLeaderboard error:', e)
    return res.status(500).json({ error: 'internal error' })
  }
}

export async function getRemixRewards(req: Request, res: Response) {
  try {
    const userId = req.query.user_id
    const limit = Number(req.query.limit || 20)
    const offset = Number(req.query.offset || 0)

    if (!userId) return res.status(400).json({ error: 'user_id required' })
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' })

    // Query remix_rewards and embed related generations
    // Note: We use explicit foreign key embedding syntax if needed, or just rely on auto-detection.
    // Since we have two FKs to the same table, we must specify the FK column.
    const query = `?user_id=eq.${userId}&select=id,amount,created_at,source_generation:generations!source_generation_id(id,image_url,prompt),remix_generation:generations!remix_generation_id(id,image_url,prompt)&order=created_at.desc&limit=${limit}&offset=${offset}`

    const q = await supaSelect('remix_rewards', query)

    if (!q.ok) return res.status(500).json({ error: 'query failed', detail: q.data })

    return res.json({
      items: q.data,
      total: q.headers['content-range'] ? Number(q.headers['content-range'].split('/')[1]) : undefined
    })
  } catch (e) {
    console.error('getRemixRewards error:', e)
    return res.status(500).json({ error: 'internal error' })
  }
}

// Toggle follow/unfollow a user
export async function toggleFollow(req: Request, res: Response) {
  try {
    const { followerId, followingId } = req.body
    if (!followerId || !followingId) return res.status(400).json({ error: 'followerId and followingId required' })
    if (followerId === followingId) return res.status(400).json({ error: 'cannot follow yourself' })

    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' })

    // Check if already following
    const check = await supaSelect('user_subscriptions', `?follower_id=eq.${followerId}&following_id=eq.${followingId}&select=id`)
    const existing = Array.isArray(check.data) && check.data.length > 0 ? check.data[0] : null

    if (existing) {
      // Unfollow
      const url = `${SUPABASE_URL}/rest/v1/user_subscriptions?id=eq.${existing.id}`
      const r = await fetch(url, {
        method: 'DELETE',
        headers: { ...supaHeaders(), 'Content-Type': 'application/json' }
      })
      if (!r.ok) return res.status(500).json({ error: 'unfollow failed' })
      return res.json({ is_following: false })
    } else {
      // Follow
      const result = await supaPost('user_subscriptions', { follower_id: followerId, following_id: followingId })
      if (!result.ok) return res.status(500).json({ error: 'follow failed', detail: result.data })
      return res.json({ is_following: true })
    }
  } catch (e) {
    console.error('toggleFollow error:', e)
    return res.status(500).json({ error: 'toggle follow failed' })
  }
}

// Check if a user is following another user
export async function checkFollowStatus(req: Request, res: Response) {
  try {
    const followerId = req.query.follower_id ? Number(req.query.follower_id) : null
    const followingId = req.params.userId ? Number(req.params.userId) : null

    if (!followerId || !followingId) return res.status(400).json({ error: 'follower_id and userId required' })
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' })

    const check = await supaSelect('user_subscriptions', `?follower_id=eq.${followerId}&following_id=eq.${followingId}&select=id`)
    const isFollowing = Array.isArray(check.data) && check.data.length > 0

    return res.json({ is_following: isFollowing })
  } catch (e) {
    console.error('checkFollowStatus error:', e)
    return res.status(500).json({ error: 'check follow status failed' })
  }
}

// Get list of users that the current user is following
export async function getFollowing(req: Request, res: Response) {
  try {
    const userId = req.params.userId
    if (!userId) return res.status(400).json({ error: 'userId required' })
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' })

    // Get following users with their info
    const query = `?follower_id=eq.${userId}&select=following_id,created_at,users:following_id(user_id,username,first_name,last_name,avatar_url)&order=created_at.desc`
    const q = await supaSelect('user_subscriptions', query)

    if (!q.ok) return res.status(500).json({ error: 'query failed', detail: q.data })

    const items = Array.isArray(q.data) ? q.data.map((item: any) => ({
      user_id: item.following_id,
      username: item.users?.username || null,
      first_name: item.users?.first_name || null,
      last_name: item.users?.last_name || null,
      avatar_url: item.users?.avatar_url || null,
      followed_at: item.created_at
    })) : []

    return res.json({ items })
  } catch (e) {
    console.error('getFollowing error:', e)
    return res.status(500).json({ error: 'get following failed' })
  }
}

// Get list of users who follow the current user (followers)
export async function getFollowers(req: Request, res: Response) {
  try {
    const userId = req.params.userId
    if (!userId) return res.status(400).json({ error: 'userId required' })
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' })

    // Get followers with their info
    const query = `?following_id=eq.${userId}&select=follower_id,created_at,users:follower_id(user_id,username,first_name,last_name,avatar_url)&order=created_at.desc`
    const q = await supaSelect('user_subscriptions', query)

    if (!q.ok) return res.status(500).json({ error: 'query failed', detail: q.data })

    const items = Array.isArray(q.data) ? q.data.map((item: any) => ({
      user_id: item.follower_id,
      username: item.users?.username || null,
      first_name: item.users?.first_name || null,
      last_name: item.users?.last_name || null,
      avatar_url: item.users?.avatar_url || null,
      followed_at: item.created_at
    })) : []

    return res.json({ items })
  } catch (e) {
    console.error('getFollowers error:', e)
    return res.status(500).json({ error: 'get followers failed' })
  }
}
