import { Request, Response } from 'express'
import path from 'path'
import fs from 'fs'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const appRoot = process.cwd()
const uploadsDir = path.resolve(appRoot, 'uploads', 'avatars')

function ensureDirs() {
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
}

export async function getAvatar(req: Request, res: Response) {
  try {
    const userId = req.params.userId
    if (!userId) return res.status(400).json({ error: 'userId required' })
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
    ensureDirs()
    const localFile = path.join(uploadsDir, `${userId}.jpg`)
    const base64 = String(imageBase64)
    const commaIdx = base64.indexOf(',')
    const data = commaIdx >= 0 ? base64.slice(commaIdx + 1) : base64
    const buf = Buffer.from(data, 'base64')
    fs.writeFileSync(localFile, buf)
    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'upload failed' })
  }
}
