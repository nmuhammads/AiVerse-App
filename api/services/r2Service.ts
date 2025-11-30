import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import crypto from 'crypto'

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

export async function uploadImageFromUrl(imageUrl: string): Promise<string> {
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
        const fileName = `${hash}.${ext}`

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

