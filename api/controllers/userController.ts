import { Request, Response } from 'express'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''

function stripQuotes(s: string) { return s.trim().replace(/^['"`]+|['"`]+$/g, '') }

const SUPABASE_URL = stripQuotes(process.env.SUPABASE_URL || '')
const SUPABASE_KEY = stripQuotes(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '')
const SUPABASE_BUCKET = stripQuotes(process.env.SUPABASE_USER_AVATARS_BUCKET || 'avatars')
const DEFAULT_BOT_SOURCE = process.env.TELEGRAM_BOT_USERNAME || 'AiVerseAppBot'

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

async function supaStorageUpload(pathname: string, buf: Buffer, contentType = 'image/jpeg') {
  const url = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(SUPABASE_BUCKET)}/${pathname}`
  const ab: ArrayBuffer = new ArrayBuffer(buf.length)
  new Uint8Array(ab).set(buf)
  const r = await fetch(url, { method: 'POST', headers: { ...supaHeaders(), 'Content-Type': contentType, 'x-upsert': 'true' }, body: ab })
  const data = await r.json().catch(() => null)
  return { ok: r.ok, data }
}

async function supaStorageSignedUrl(pathname: string, expiresIn = Number(process.env.SUPABASE_SIGNED_URL_TTL || 3600)) {
  const url = `${SUPABASE_URL}/storage/v1/object/sign/${encodeURIComponent(SUPABASE_BUCKET)}/${pathname}`
  const r = await fetch(url, { method: 'POST', headers: { ...supaHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn }) })
  const data = await r.json().catch(() => null)
  const signed = (data && (data.signedURL || data.signedUrl)) ? String(data.signedURL || data.signedUrl) : null
  if (!r.ok || !signed) {
    console.error('avatar:signed-url:fail', { status: r.status, data })
    return null
  }
  const abs = signed.startsWith('http')
  console.info('avatar:signed-url:ok', { abs, len: signed.length })
  return abs ? signed : `${SUPABASE_URL}${signed}`
}

// signed URL helper can be added when bucket is private

function sanitizeUrl(u: unknown): string | null {
  if (!u) return null
  const s = String(u).trim()
  const cleaned = s.replace(/^['"`\s]+/, '').replace(/['"`\s]+$/, '')
  return cleaned || null
}

// Sync avatar from Telegram to Supabase Storage
export async function syncAvatar(req: Request, res: Response) {
  try {
    const { userId } = req.body
    if (!userId) return res.status(400).json({ error: 'userId required' })

    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' })

    // 1. Check if user already has an avatar_url in users table
    const userQuery = await supaSelect('users', `?user_id=eq.${userId}&select=avatar_url`)
    if (userQuery.ok && Array.isArray(userQuery.data) && userQuery.data[0]?.avatar_url) {
      // Avatar already exists, no need to sync
      return res.json({ ok: true, avatar_url: userQuery.data[0].avatar_url })
    }

    // 2. Fetch from Telegram
    if (!TOKEN) return res.status(500).json({ error: 'Telegram token not configured' })

    const photosResp = await fetch(`https://api.telegram.org/bot${TOKEN}/getUserProfilePhotos?user_id=${userId}&limit=1`)
    const photosJson = await photosResp.json()
    const first = photosJson?.result?.photos?.[0]

    if (!first) {
      // No photos in Telegram, maybe set a default or do nothing
      return res.json({ ok: true, message: 'no telegram photos' })
    }

    // Get the largest size
    const largest = first[first.length - 1]
    const fileResp = await fetch(`https://api.telegram.org/bot${TOKEN}/getFile?file_id=${largest.file_id}`)
    const fileJson = await fileResp.json()
    const filePathTg = fileJson?.result?.file_path

    if (!filePathTg) return res.status(404).json({ error: 'telegram file path not found' })

    // Download image
    const downloadUrl = `https://api.telegram.org/file/bot${TOKEN}/${filePathTg}`
    const imgResp = await fetch(downloadUrl)
    if (!imgResp.ok) return res.status(500).json({ error: 'failed to download from telegram' })

    const buf = Buffer.from(await imgResp.arrayBuffer())

    // 3. Upload to Supabase Storage
    // Use fixed filename to save space (overwrite existing)
    const fileName = `profile.jpg`
    const uploadPath = `${userId}/${fileName}`

    const upload = await supaStorageUpload(uploadPath, buf, 'image/jpeg')
    if (!upload.ok) return res.status(500).json({ error: 'upload failed', detail: upload.data })

    // 4. Get Public URL
    // Add timestamp to query param to bust cache if needed, but for DB we store clean URL
    // Actually, better to store clean URL and let frontend handle caching
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${uploadPath}`

    // 5. Update users table
    const update = await supaPatch('users', `?user_id=eq.${userId}`, { avatar_url: publicUrl })
    if (!update.ok) return res.status(500).json({ error: 'db update failed', detail: update.data })

    return res.json({ ok: true, avatar_url: publicUrl })

  } catch (e) {
    console.error('syncAvatar error:', e)
    return res.status(500).json({ error: 'sync failed' })
  }
}

export async function getAvatar(req: Request, res: Response) {
  // Legacy or fallback if needed, but for now we rely on avatar_url in users table
  // We can redirect to the public URL if we want, or just return 404 if not found
  return res.status(404).json({ error: 'use avatar_url from user object' })
}

export async function uploadAvatar(req: Request, res: Response) {
  try {
    const { userId, imageBase64 } = req.body || {}
    if (!userId || !imageBase64) return res.status(400).json({ error: 'invalid payload' })
    const base64 = String(imageBase64)
    const commaIdx = base64.indexOf(',')
    const data = commaIdx >= 0 ? base64.slice(commaIdx + 1) : base64
    const buf = Buffer.from(data, 'base64')

    if (SUPABASE_URL && SUPABASE_KEY) {
      const filePath = `${encodeURIComponent(String(userId))}/profile.jpg`
      const up = await supaStorageUpload(filePath, buf, 'image/jpeg')
      if (!up.ok) return res.status(500).json({ error: 'upload to storage failed', detail: up.data })

      // Update user avatar_url if not set (or just always update to be safe)
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${filePath}`
      const upd = await supaPatch('users', `?user_id=eq.${userId}`, { avatar_url: publicUrl })

      return res.json({ ok: true, file_path: filePath, avatar_url: publicUrl })
    }

    return res.status(500).json({ error: 'Supabase not configured, local storage removed' });

    return res.status(500).json({ error: 'Supabase not configured, local storage removed' });
  } catch {
    return res.status(500).json({ error: 'upload failed' })
  }
}

export async function getUserInfo(req: Request, res: Response) {
  try {
    const userId = req.params.userId
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' })
    const q = await supaSelect('users', `?user_id=eq.${encodeURIComponent(userId)}&select=user_id,username,first_name,last_name,is_premium,balance,updated_at`)
    if (!q.ok) return res.status(500).json({ error: 'query failed', detail: q.data })
    const row = Array.isArray(q.data) ? q.data[0] : null
    if (!row) return res.status(404).json({ error: 'user not found' })
    return res.json(row)
  } catch {
    return res.status(500).json({ error: 'user info error' })
  }
}

export async function subscribeBot(req: Request, res: Response) {
  try {
    const { userId, botSource } = req.body || {}
    const u = Number(userId)
    const src = String(botSource || DEFAULT_BOT_SOURCE)
    if (!u || !src) return res.status(400).json({ error: 'invalid payload' })
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' })
    const r = await supaPost('bot_subscriptions', { user_id: u, bot_source: src }, `?on_conflict=user_id,bot_source`)
    if (!r.ok) return res.status(500).json({ error: 'upsert failed', detail: r.data })
    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'subscribe failed' })
  }
}

export async function listGenerations(req: Request, res: Response) {
  try {
    const userId = String(req.query.user_id || '')
    const limit = Number(req.query.limit || 6)
    const offset = Number(req.query.offset || 0)
    if (!userId) return res.status(400).json({ error: 'user_id required' })
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'Supabase not configured' })
    const q = await supaSelect('generations', `?user_id=eq.${encodeURIComponent(userId)}&image_url=ilike.http%25&select=id,image_url,prompt,created_at&order=created_at.desc&limit=${limit}&offset=${offset}`)
    if (!q.ok) return res.status(500).json({ error: 'query failed', detail: q.data })
    const itemsRaw = Array.isArray(q.data) ? q.data : [] as Array<{ id: number; image_url?: string | null; prompt?: string; created_at?: string | null }>
    const items = itemsRaw.map((it) => ({
      id: it.id,
      prompt: String(it.prompt || ''),
      created_at: it.created_at || null,
      image_url: sanitizeUrl(it.image_url),
    }))
    const cr = String(q.headers['content-range'] || '')
    const total = (() => { const m = /\d+-\d+\/(\d+)/.exec(cr); return m ? Number(m[1]) : undefined })()
    return res.json({ items, total })
  } catch {
    return res.status(500).json({ error: 'list generations failed' })
  }
}
