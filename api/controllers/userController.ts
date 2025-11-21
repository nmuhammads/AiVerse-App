import { Request, Response } from 'express'
import path from 'path'
import fs from 'fs'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const appRoot = process.cwd()
const uploadsDir = path.resolve(appRoot, 'uploads', 'avatars')

function stripQuotes(s: string) { return s.trim().replace(/^['"`]+|['"`]+$/g, '') }

const SUPABASE_URL = stripQuotes(process.env.SUPABASE_URL || '')
const SUPABASE_KEY = stripQuotes(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '')
const SUPABASE_BUCKET = stripQuotes(process.env.SUPABASE_AVATARS_BUCKET || 'photo_reference')
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

function ensureDirs() {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
}

function sanitizeUrl(u: unknown): string | null {
  if (!u) return null
  const s = String(u).trim()
  const cleaned = s.replace(/^['"`\s]+/, '').replace(/['"`\s]+$/, '')
  return cleaned || null
}

export async function getAvatar(req: Request, res: Response) {
  try {
    const userId = req.params.userId
    if (!userId) return res.status(400).json({ error: 'userId required' })
    console.info('avatar:get:start', { userId, supa: Boolean(SUPABASE_URL && SUPABASE_KEY) })
    if (SUPABASE_URL && SUPABASE_KEY) {
      const qp = await supaSelect('avatars', `?user_id=eq.${encodeURIComponent(userId)}&is_profile_pic=eq.true&select=file_path,created_at&order=created_at.desc&limit=1`)
      console.info('avatar:query', { ok: qp.ok, count: Array.isArray(qp.data) ? qp.data.length : null })
      const filePath = Array.isArray(qp.data) && qp.data[0]?.file_path ? String(qp.data[0].file_path) : null
      console.info('avatar:file-path', { filePath })
      if (filePath) {
        const canonical = `${encodeURIComponent(String(userId))}/profile.jpg`
        const candidates = [filePath, ...(filePath !== canonical ? [canonical] : [])]
        for (const p of candidates) {
          const signed = await supaStorageSignedUrl(p)
          if (signed) {
            try {
              const imgResp = await fetch(signed)
              console.info('avatar:fetch', { status: imgResp.status, ct: imgResp.headers.get('content-type'), path: p })
              if (imgResp.ok) {
                const ct = imgResp.headers.get('content-type') || 'image/jpeg'
                const buf = Buffer.from(await imgResp.arrayBuffer())
                res.setHeader('Content-Type', ct)
                res.setHeader('Cache-Control', 'no-store')
                if (p !== filePath) {
                  console.info('avatar:canonical:update', { from: filePath, to: p })
                  await supaPatch('avatars', `?user_id=eq.${encodeURIComponent(String(userId))}&is_profile_pic=eq.true`, { file_path: p })
                }
                return res.end(buf)
              }
            } catch (e) { console.error('avatar:fetch:error', { message: (e as Error)?.message }) }
          }
        }
      }
    }
    // Fallback: fetch from Telegram and return without uploading to Supabase
    if (!TOKEN) return res.status(404).json({ error: 'avatar not found' });
    console.info('avatar:telegram:fetch', { userId });
    const photosResp = await fetch(`https://api.telegram.org/bot${TOKEN}/getUserProfilePhotos?user_id=${encodeURIComponent(userId)}&limit=1`);
    const photosJson = await photosResp.json();
    const first = photosJson?.result?.photos?.[0];
    if (!first) return res.status(404).json({ error: 'no photos' });
    const sizes = first as Array<{ file_id: string }>;
    const largest = sizes[sizes.length - 1];
    const fileResp = await fetch(`https://api.telegram.org/bot${TOKEN}/getFile?file_id=${largest.file_id}`);
    const fileJson = await fileResp.json();
    const filePathTg = fileJson?.result?.file_path;
    if (!filePathTg) return res.status(404).json({ error: 'file not found' });
    const downloadUrl = `https://api.telegram.org/file/bot${TOKEN}/${filePathTg}`;
    const imgResp = await fetch(downloadUrl);
    if (!imgResp.ok) return res.status(404).json({ error: 'download failed' });
    const buf = Buffer.from(await imgResp.arrayBuffer());
    // Return the image directly from Telegram
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-store');
    console.info('avatar:telegram:return', { saved: false });
    return res.end(buf);
  } catch (e) {
    console.error('avatar:get:error', { message: (e as Error)?.message })
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
      const filePath = `${encodeURIComponent(String(userId))}/profile.jpg`
      const up = await supaStorageUpload(filePath, buf, 'image/jpeg')
      if (!up.ok) return res.status(500).json({ error: 'upload to storage failed', detail: up.data })
      const existing = await supaSelect('avatars', `?user_id=eq.${encodeURIComponent(String(userId))}&is_profile_pic=eq.true&select=id&limit=1`)
      const existingId = Array.isArray(existing.data) && existing.data[0]?.id ? Number(existing.data[0].id) : null
      if (existingId) {
        const upd = await supaPatch('avatars', `?id=eq.${existingId}`, { file_path: filePath, is_profile_pic: true })
        if (!upd.ok) return res.status(500).json({ error: 'record update failed', detail: upd.data })
      } else {
        const ins = await supaPost('avatars', { user_id: Number(userId), file_path: filePath, display_name: null, is_profile_pic: true })
        if (!ins.ok) return res.status(500).json({ error: 'record insert failed', detail: ins.data })
      }
      return res.json({ ok: true, file_path: filePath })
    }

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
