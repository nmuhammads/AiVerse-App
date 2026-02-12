import { Request, Response } from 'express'
import crypto from 'crypto'
import { supaSelect, supaPost, supaDelete, supaStorageSignedUrl, supaStorageUploadFile, supaStorageDeleteFile } from '../services/supabaseService.js'

const AVATAR_BUCKET = 'photo_reference'

/**
 * GET /api/avatars — List user's avatars with signed URLs
 */
export async function listAvatars(req: Request, res: Response) {
    try {
        const userId = (req as any).user?.id
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })

        const result = await supaSelect('avatars', `?user_id=eq.${encodeURIComponent(String(userId))}&select=id,file_path,display_name,created_at&order=created_at.desc`)

        if (!result.ok || !Array.isArray(result.data)) {
            return res.json({ avatars: [] })
        }

        // Generate signed URLs for each avatar
        const avatars = await Promise.all(result.data.map(async (avatar: any) => {
            const url = avatar.file_path ? await supaStorageSignedUrl(AVATAR_BUCKET, avatar.file_path) : ''
            return {
                id: avatar.id,
                display_name: avatar.display_name,
                url,
                created_at: avatar.created_at
            }
        }))

        return res.json({ avatars })
    } catch (e) {
        console.error('listAvatars error:', e)
        return res.status(500).json({ error: 'Internal server error' })
    }
}

/**
 * POST /api/avatars — Create a new avatar
 * Body: { image: string (base64 data URL), display_name: string }
 */
export async function createAvatar(req: Request, res: Response) {
    try {
        const userId = (req as any).user?.id
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })

        const { image, display_name } = req.body

        if (!image || typeof image !== 'string') {
            return res.status(400).json({ error: 'Image is required (base64 data URL)' })
        }
        if (!display_name || typeof display_name !== 'string' || display_name.trim().length === 0) {
            return res.status(400).json({ error: 'Display name is required' })
        }
        if (display_name.trim().length > 30) {
            return res.status(400).json({ error: 'Display name must be 30 characters or less' })
        }

        // Parse base64 data URL
        const matches = image.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/)
        if (!matches || matches.length !== 3) {
            return res.status(400).json({ error: 'Invalid base64 image format' })
        }

        const contentType = matches[1]
        const data = matches[2]
        const buffer = Buffer.from(data, 'base64')

        // Determine extension from content type
        const extMap: Record<string, string> = {
            'image/jpeg': '.jpg',
            'image/jpg': '.jpg',
            'image/png': '.png',
            'image/webp': '.webp',
            'image/gif': '.gif'
        }
        const ext = extMap[contentType] || '.jpg'

        // Generate path: {user_id}/{uuid}{ext}
        const filePath = `${userId}/${crypto.randomUUID()}${ext}`

        // Upload to Supabase Storage (photo_reference bucket)
        const uploadResult = await supaStorageUploadFile(AVATAR_BUCKET, filePath, buffer, contentType)
        if (!uploadResult.ok) {
            console.error('[Avatar] Upload to Supabase Storage failed:', uploadResult.data)
            return res.status(500).json({ error: 'Failed to upload image' })
        }

        // Create record in avatars table
        const insertResult = await supaPost('avatars', {
            user_id: Number(userId),
            file_path: filePath,
            display_name: display_name.trim()
        })

        if (!insertResult.ok || !Array.isArray(insertResult.data) || insertResult.data.length === 0) {
            console.error('[Avatar] Failed to create DB record:', insertResult.data)
            return res.status(500).json({ error: 'Failed to save avatar' })
        }

        const avatar = insertResult.data[0]

        // Generate signed URL for response
        const url = await supaStorageSignedUrl(AVATAR_BUCKET, filePath)

        console.log(`[Avatar] Created avatar "${display_name.trim()}" for user ${userId}: ${filePath}`)

        return res.json({
            ok: true,
            avatar: {
                id: avatar.id,
                display_name: avatar.display_name,
                url,
                created_at: avatar.created_at
            }
        })
    } catch (e) {
        console.error('createAvatar error:', e)
        return res.status(500).json({ error: 'Internal server error' })
    }
}

/**
 * DELETE /api/avatars/:id — Delete an avatar
 */
export async function deleteAvatar(req: Request, res: Response) {
    try {
        const userId = (req as any).user?.id
        if (!userId) return res.status(401).json({ error: 'Unauthorized' })

        const avatarId = req.params.id
        if (!avatarId) return res.status(400).json({ error: 'Avatar ID is required' })

        // Get avatar to verify ownership and get file_path
        const result = await supaSelect('avatars', `?id=eq.${encodeURIComponent(avatarId)}&user_id=eq.${encodeURIComponent(String(userId))}&select=id,file_path`)

        if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) {
            return res.status(404).json({ error: 'Avatar not found' })
        }

        const avatar = result.data[0]
        const filePath = avatar.file_path

        // Delete from DB
        await supaDelete('avatars', `?id=eq.${encodeURIComponent(avatarId)}&user_id=eq.${encodeURIComponent(String(userId))}`)

        // Delete from Storage
        if (filePath) {
            try {
                await supaStorageDeleteFile(AVATAR_BUCKET, [filePath])
            } catch (e) {
                console.error('[Avatar] Storage delete failed (ignored):', e)
            }
        }

        console.log(`[Avatar] Deleted avatar ${avatarId} for user ${userId}`)

        return res.json({ ok: true })
    } catch (e) {
        console.error('deleteAvatar error:', e)
        return res.status(500).json({ error: 'Internal server error' })
    }
}
