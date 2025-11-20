import { Request, Response } from 'express'
import path from 'path'
import fs from 'fs'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const appRoot = process.cwd()
const uploadsDir = path.resolve(appRoot, 'uploads', 'avatars')

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ''
const SUPABASE_BUCKET = process.env.SUPABASE_AVATARS_BUCKET || 'photo_reference'
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
  const r = await fetch(url, { method: 'POST', headers: { ...supaHeaders(), 'Content-Type': contentType, 'x-upsert': 'true' }, body: buf })
  const data = await r.json().catch(() => null)
  return { ok: r.ok, data }
}

async function supaStoragePublicUrl(pathname: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(SUPABASE_BUCKET)}/${pathname}`
}

// signed URL helper can be added when bucket is private

function ensureDirs() {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
}

export async function getAvatar(req: Request, res: Response) {
  try {
    const userId = req.params.userId
    if (!userId) return res.status(400).json({ error: 'userId required' })
    if (SUPABASE_URL && SUPABASE_KEY) {
      const qp = await supaSelect('avatars', `?user_id=eq.${encodeURIComponent(userId)}&is_profile_pic=eq.true&select=file_path,created_at&order=created_at.desc&limit=1`)
      const filePath = Array.isArray(qp.data) && qp.data[0]?.file_path ? String(qp.data[0].file_path) : null
      if (filePath) {
        const pubUrl = await supaStoragePublicUrl(filePath)
        return res.redirect(pubUrl)
      }
    }
    // Fallback: local cache or Telegram
    ensureDirs()
    const localFile = path.join(uploadsDir, `${userId}.jpg`)
    if (fs.existsSync(localFile)) {
      return res.sendFile(localFile)
    }
    if (!TOKEN) return res.status(404).json({ error: 'avatar not found' })
    const photosResp = await fetch(`https://api.telegram.org/bot${TOKEN}/getUserProfilePhotos?user_id=${encodeURIComponent(userId)}&limit=1`)
    const photosJson = await photosResp.json()
    const first = photosJson?.result?.photos?.[0]
    if (!first) return res.status(404).json({ error: 'no photos' })
    const sizes = first as Array<{ file_id: string }>
    const largest = sizes[sizes.length - 1]
    const fileResp = await fetch(`https://api.telegram.org/bot${TOKEN}/getFile?file_id=${largest.file_id}`)
    const fileJson = await fileResp.json()
    const filePath = fileJson?.result?.file_path
    if (!filePath) return res.status(404).json({ error: 'file not found' })
    const downloadUrl = `https://api.telegram.org/file/bot${TOKEN}/${filePath}`
    const imgResp = await fetch(downloadUrl)
    if (!imgResp.ok) return res.status(404).json({ error: 'download failed' })
    const buf = Buffer.from(await imgResp.arrayBuffer())
    fs.writeFileSync(localFile, buf)
    res.setHeader('Content-Type', 'image/jpeg')
    return res.end(buf)
  } catch {
    return res.status(500).json({ error: 'avatar error' })
  }
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
      const filePath = `${encodeURIComponent(String(userId))}/profile-${Date.now()}.jpg`
      const up = await supaStorageUpload(filePath, buf, 'image/jpeg')
      if (!up.ok) return res.status(500).json({ error: 'upload to storage failed', detail: up.data })
      // Unflag previous profile picture(s)
      await supaPatch('avatars', `?user_id=eq.${encodeURIComponent(String(userId))}&is_profile_pic=eq.true`, { is_profile_pic: false })
      // Insert new avatar flagged as profile pic
      const ins = await supaPost('avatars', { user_id: Number(userId), file_path: filePath, display_name: null, is_profile_pic: true })
      if (!ins.ok) return res.status(500).json({ error: 'record insert failed', detail: ins.data })
      return res.json({ ok: true, file_path: filePath })
    }

    // Fallback to local filesystem
    ensureDirs()
    const localFile = path.join(uploadsDir, `${userId}.jpg`)
    fs.writeFileSync(localFile, buf)
    return res.json({ ok: true })
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
    const q = await supaSelect('generations', `?user_id=eq.${encodeURIComponent(userId)}&select=id,image_url,prompt,created_at&order=created_at.desc&limit=${limit}&offset=${offset}`)
    if (!q.ok) return res.status(500).json({ error: 'query failed', detail: q.data })
    const items = Array.isArray(q.data) ? q.data : []
    const cr = String(q.headers['content-range'] || '')
    const total = (() => { const m = /\d+-\d+\/(\d+)/.exec(cr); return m ? Number(m[1]) : undefined })()
    return res.json({ items, total })
  } catch {
    return res.status(500).json({ error: 'list generations failed' })
  }
}
