import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import crypto from 'crypto'
import sharp from 'sharp'

let s3Client: S3Client | null = null

function getS3Client() {
    if (s3Client) return s3Client

    const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
    const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
    const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
        return null
    }

    s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
    })
    return s3Client
}

export async function uploadImageFromUrl(imageUrl: string, folder: string = ''): Promise<string> {
    const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME
    const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL
    const client = getS3Client()

    console.log('Starting R2 upload for:', imageUrl)

    if (!client || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
        console.warn('R2 credentials missing:', {
            hasClient: !!client,
            hasBucket: !!R2_BUCKET_NAME,
            hasPublicUrl: !!R2_PUBLIC_URL
        })
        return imageUrl
    }

    // Optimization: If image is already on R2, skip re-upload
    if (imageUrl.startsWith(R2_PUBLIC_URL)) {
        console.log('Image is already on R2, skipping upload:', imageUrl)
        return imageUrl
    }

    try {
        // 1. Fetch the image
        const response = await fetch(imageUrl)
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`)
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const contentType = response.headers.get('content-type') || 'image/png'

        // 2. Generate unique filename
        const hash = crypto.randomBytes(16).toString('hex')
        const ext = contentType.split('/')[1] || 'png'
        const fileName = folder ? `${folder}/${hash}.${ext}` : `${hash}.${ext}`

        // 3. Upload to R2
        await client.send(new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: fileName,
            Body: buffer,
            ContentType: contentType,
        }))

        // 4. Return public URL
        return `${R2_PUBLIC_URL}/${fileName}`
    } catch (error) {
        console.error('R2 upload failed:', error)
        return imageUrl // Fallback to original URL on failure
    }
}



export async function uploadImageFromBase64(
    base64Data: string,
    folder: string = '',
    options: { bucket?: string; publicUrl?: string; customFileName?: string } = {}
): Promise<string> {
    const { bucket, publicUrl: customUrl, customFileName } = options
    const R2_BUCKET_NAME = bucket || process.env.R2_BUCKET_NAME
    const R2_PUBLIC_URL = customUrl || process.env.R2_PUBLIC_URL
    const client = getS3Client()

    console.log('Starting R2 upload for Base64 data', customFileName ? `(custom name: ${customFileName})` : '')

    if (!client || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
        console.warn('R2 credentials missing for Base64 upload', {
            hasClient: !!client,
            hasBucket: !!R2_BUCKET_NAME,
            hasPublicUrl: !!R2_PUBLIC_URL
        })
        return base64Data // Return original data if upload not possible
    }

    try {
        // 1. Parse Base64
        // Format: "data:image/png;base64,iVBORw0KGgo..."
        const matches = base64Data.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/)

        if (!matches || matches.length !== 3) {
            throw new Error('Invalid Base64 string format')
        }

        const contentType = matches[1]
        const data = matches[2]
        const buffer = Buffer.from(data, 'base64')

        // 2. Generate filename (use custom or generate unique)
        let fileName: string
        if (customFileName) {
            // Use custom filename - allows overwriting existing files
            fileName = folder ? `${folder}/${customFileName}` : customFileName
        } else {
            const hash = crypto.randomBytes(16).toString('hex')
            const ext = contentType.split('/')[1] || 'png'
            fileName = folder ? `${folder}/${hash}.${ext}` : `${hash}.${ext}`
        }

        // 3. Upload to R2
        await client.send(new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: fileName,
            Body: buffer,
            ContentType: contentType,
        }))

        const finalUrl = `${R2_PUBLIC_URL}/${fileName}`
        console.log('R2 Base64 upload success:', finalUrl)
        return finalUrl
    } catch (error) {
        console.error('R2 Base64 upload failed:', error)
        return base64Data // Fallback to original on failure
    }
}



export async function createThumbnail(input: Buffer | string, originalUrl?: string, customFileName?: string): Promise<string> {
    const THUMB_BUCKET = process.env.R2_BUCKET_THUMBNAILS
    const THUMB_PUBLIC_URL = process.env.R2_PUBLIC_URL_THUMBNAILS
    const client = getS3Client()

    if (!client || !THUMB_BUCKET || !THUMB_PUBLIC_URL) {
        console.warn('R2 thumbnails configuration missing')
        return ''
    }

    try {
        let buffer: Buffer

        if (typeof input === 'string') {
            // URL
            const response = await fetch(input)
            if (!response.ok) throw new Error(`Failed to fetch image for thumbnail: ${response.statusText}`)
            const arrayBuffer = await response.arrayBuffer()
            buffer = Buffer.from(arrayBuffer)
        } else {
            buffer = input
        }

        // Resize and compress
        const processedBuffer = await sharp(buffer)
            .resize({ width: 600, withoutEnlargement: true })
            .jpeg({ quality: 80, mozjpeg: true })
            .toBuffer()

        // Determine filename
        let fileName = ''
        if (customFileName) {
            fileName = customFileName
        } else {
            // New random filename
            const hash = crypto.randomBytes(16).toString('hex')
            fileName = `${hash}_thumb.jpg`
        }

        // Upload to Thumbnail Bucket
        await client.send(new PutObjectCommand({
            Bucket: THUMB_BUCKET,
            Key: fileName,
            Body: processedBuffer,
            ContentType: 'image/jpeg',
        }))

        const publicUrl = `${THUMB_PUBLIC_URL}/${fileName}`
        console.log('Thumbnail created:', publicUrl)
        return publicUrl
    } catch (e) {
        console.error('Thumbnail creation failed:', e)
        return ''
    }
}


export async function uploadToEditedBucket(imageUrl: string): Promise<string> {
    const EDITED_BUCKET = process.env.R2_BUCKET_EDITED
    const EDITED_PUBLIC_URL = process.env.R2_PUBLIC_URL_EDITED
    const client = getS3Client()

    console.log('Starting R2 upload to edited bucket for:', imageUrl)

    if (!client || !EDITED_BUCKET || !EDITED_PUBLIC_URL) {
        console.warn('R2 edited bucket configuration missing:', {
            hasClient: !!client,
            hasBucket: !!EDITED_BUCKET,
            hasPublicUrl: !!EDITED_PUBLIC_URL
        })
        return imageUrl
    }

    if (imageUrl.startsWith(EDITED_PUBLIC_URL)) {
        console.log('Image is already on edited bucket, skipping:', imageUrl)
        return imageUrl
    }

    try {
        const response = await fetch(imageUrl)
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`)
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const contentType = response.headers.get('content-type') || 'image/png'

        const hash = crypto.randomBytes(16).toString('hex')
        const ext = contentType.split('/')[1] || 'png'
        const fileName = `${hash}.${ext}`

        await client.send(new PutObjectCommand({
            Bucket: EDITED_BUCKET,
            Key: fileName,
            Body: buffer,
            ContentType: contentType,
        }))

        const publicUrl = `${EDITED_PUBLIC_URL}/${fileName}`
        console.log('R2 edited bucket upload success:', publicUrl)
        return publicUrl
    } catch (error) {
        console.error('R2 edited bucket upload failed:', error)
        return imageUrl
    }
}

// === Video S3 Client ===
let videoS3Client: S3Client | null = null

function getVideoS3Client() {
    if (videoS3Client) return videoS3Client

    const R2_ACCOUNT_ID = process.env.R2_VIDEO_ACCOUNT_ID || process.env.R2_ACCOUNT_ID
    const R2_ACCESS_KEY_ID = process.env.R2_VIDEO_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID
    const R2_SECRET_ACCESS_KEY = process.env.R2_VIDEO_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY

    // Log which credentials strategy is used
    if (process.env.R2_VIDEO_ACCOUNT_ID) {
        console.log('[R2 Video] Using separate video credentials')
    } else {
        console.log('[R2 Video] Using default shared credentials')
    }

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
        return null
    }

    videoS3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
    })
    return videoS3Client
}

export async function uploadVideoFromBase64(
    base64Data: string,
    folder: string = '',
    options: { bucket?: string; publicUrl?: string; customFileName?: string } = {}
): Promise<string> {
    // Explicitly use Video bucket config
    const { bucket, publicUrl: customUrl, customFileName } = options
    const R2_BUCKET_NAME = bucket || process.env.R2_BUCKET_VIDEO_REFS
    const R2_PUBLIC_URL = customUrl || process.env.R2_PUBLIC_URL_VIDEO_REFS
    const client = getVideoS3Client()

    console.log('Starting R2 Video upload', customFileName ? `(custom name: ${customFileName})` : '...')

    if (!client || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
        console.warn('R2 Video configuration missing:', {
            hasClient: !!client,
            hasBucket: !!R2_BUCKET_NAME,
            hasPublicUrl: !!R2_PUBLIC_URL
        })
        return base64Data // Return original data if upload not possible
    }

    try {
        // 1. Parse Base64
        // Format: "data:video/mp4;base64,AAAA..." or just base64? 
        // Typically data URL format.
        const matches = base64Data.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/)

        if (!matches || matches.length !== 3) {
            throw new Error('Invalid Video Base64 string format')
        }

        const rawContentType = matches[1]
        // Normalize content-type: Kling API only supports video/mp4
        // MOV files may come as video/quicktime, treat them as MP4
        const contentType = rawContentType === 'video/quicktime' || rawContentType === 'video/mov'
            ? 'video/mp4'
            : rawContentType
        const data = matches[2]
        const buffer = Buffer.from(data, 'base64')

        // 2. Generate filename
        let fileName: string
        // Always use mp4 extension for compatibility
        const ext = 'mp4'

        if (customFileName) {
            // If custom name provided, ensure extension is correct or append it if missing?
            // Usually customFileName implies full name. But let's restart logic to be safe.
            // If user passes "123", we might want "123.mp4".
            // But usually customFileName is treated as the full key.
            // Let's assume user passes the full name or we just use it as is.
            // Wait, for images `customFileName` logic was:
            // fileName = folder ? `${folder}/${customFileName}` : customFileName
            fileName = folder ? `${folder}/${customFileName}` : customFileName
        } else {
            const hash = crypto.randomBytes(16).toString('hex')
            fileName = folder ? `${folder}/${hash}.${ext}` : `${hash}.${ext}`
        }

        // 3. Upload to R2
        await client.send(new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: fileName,
            Body: buffer,
            ContentType: contentType,
        }))

        const finalUrl = `${R2_PUBLIC_URL}/${fileName}`
        console.log('R2 Video upload success:', finalUrl)
        return finalUrl
    } catch (error) {
        console.error('R2 Video upload failed:', error)
        return base64Data // Fallback
    }
}
