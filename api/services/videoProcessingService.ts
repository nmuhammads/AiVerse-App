/**
 * Video Processing Service for Kling Motion Control
 * Handles video resolution check and upscaling for Kling API
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

const execAsync = promisify(exec)

const MIN_RESOLUTION = 720 // Minimum resolution required by Kling API

// === R2 Client for Video Processing ===
let s3Client: S3Client | null = null

function getS3Client(): S3Client | null {
    if (s3Client) return s3Client

    const R2_ACCOUNT_ID = process.env.R2_VIDEO_ACCOUNT_ID || process.env.R2_ACCOUNT_ID
    const R2_ACCESS_KEY_ID = process.env.R2_VIDEO_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID
    const R2_SECRET_ACCESS_KEY = process.env.R2_VIDEO_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY

    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
        console.warn('[VideoProcessing] R2 credentials missing')
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

interface VideoResolution {
    width: number
    height: number
}

interface ProcessedVideo {
    url: string
    storageKey: string | null  // R2 key for cleanup
    originalResolution: string
    newResolution: string
    upscaled: boolean
}

/**
 * Get video resolution using ffprobe
 */
async function getVideoResolution(filePath: string): Promise<VideoResolution> {
    const cmd = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${filePath}"`

    const { stdout } = await execAsync(cmd)
    const [width, height] = stdout.trim().split(',').map(Number)

    if (!width || !height || isNaN(width) || isNaN(height)) {
        throw new Error(`Failed to get video resolution: ${stdout}`)
    }

    return { width, height }
}

/**
 * Check if video needs upscaling
 */
function needsUpscale(width: number, height: number): boolean {
    return Math.min(width, height) < MIN_RESOLUTION
}

/**
 * Calculate new resolution maintaining aspect ratio
 * Upscale smaller side to 720px
 */
function calculateNewResolution(width: number, height: number): { newWidth: number; newHeight: number } {
    if (width <= height) {
        // Portrait: width is smaller, scale width to 720
        const newWidth = MIN_RESOLUTION
        const newHeight = Math.round((height / width) * MIN_RESOLUTION)
        // Ensure height is even (required by some codecs)
        return { newWidth, newHeight: newHeight % 2 === 0 ? newHeight : newHeight + 1 }
    } else {
        // Landscape: height is smaller, scale height to 720
        const newHeight = MIN_RESOLUTION
        const newWidth = Math.round((width / height) * MIN_RESOLUTION)
        return { newWidth: newWidth % 2 === 0 ? newWidth : newWidth + 1, newHeight }
    }
}

/**
 * Upscale video using FFmpeg
 */
async function upscaleVideo(inputPath: string, outputPath: string, newWidth: number, newHeight: number): Promise<void> {
    // Use scale filter with explicit dimensions
    // -y: overwrite output
    // -c:v libx264: H.264 codec for compatibility
    // -preset fast: balance between speed and quality
    // -crf 23: quality level (lower = better, 23 is default)
    // -c:a copy: copy audio without re-encoding
    const cmd = `ffmpeg -y -i "${inputPath}" -vf "scale=${newWidth}:${newHeight}" -c:v libx264 -preset fast -crf 23 -c:a copy "${outputPath}"`

    console.log(`[VideoProcessing] Running ffmpeg: scale=${newWidth}:${newHeight}`)
    await execAsync(cmd)
}

/**
 * Ensure temp directory exists
 */
function ensureTempDir(): string {
    const tempDir = path.join(process.cwd(), 'uploads', 'temp_videos')
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
    }
    return tempDir
}

/**
 * Upload video buffer to R2
 */
async function uploadToR2(buffer: Buffer, fileName: string): Promise<{ url: string; key: string }> {
    const client = getS3Client()
    const bucket = process.env.R2_BUCKET_VIDEO_REFS
    const publicUrl = process.env.R2_PUBLIC_URL_VIDEO_REFS

    if (!client || !bucket || !publicUrl) {
        throw new Error('R2 configuration missing for video upload')
    }

    const key = `processed/${fileName}`

    await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: 'video/mp4',
    }))

    return {
        url: `${publicUrl}/${key}`,
        key
    }
}

/**
 * Delete video from R2
 */
export async function deleteFromR2(key: string): Promise<boolean> {
    const client = getS3Client()
    const bucket = process.env.R2_BUCKET_VIDEO_REFS

    if (!client || !bucket) {
        console.warn('[VideoProcessing] Cannot delete from R2: config missing')
        return false
    }

    try {
        await client.send(new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
        }))
        console.log(`[VideoProcessing] Deleted from R2: ${key}`)
        return true
    } catch (error) {
        console.error('[VideoProcessing] R2 delete failed:', error)
        return false
    }
}

/**
 * Main function: Process video for Kling API
 * - Decodes base64 video
 * - Checks resolution
 * - Upscales if needed
 * - Uploads to R2
 * - Returns public URL
 */
export async function processVideoForKling(base64Data: string): Promise<ProcessedVideo> {
    const tempDir = ensureTempDir()
    const uniqueId = crypto.randomBytes(8).toString('hex')
    const inputPath = path.join(tempDir, `input_${uniqueId}.mp4`)
    const outputPath = path.join(tempDir, `output_${uniqueId}.mp4`)

    try {
        // 1. Parse and decode Base64
        const matches = base64Data.match(/^data:video\/[^;]+;base64,(.+)$/)
        if (!matches || matches.length !== 2) {
            throw new Error('Invalid video Base64 format')
        }

        const buffer = Buffer.from(matches[1], 'base64')
        fs.writeFileSync(inputPath, buffer)
        console.log(`[VideoProcessing] Saved input video: ${buffer.length} bytes`)

        // 2. Get resolution
        const { width, height } = await getVideoResolution(inputPath)
        const originalResolution = `${width}x${height}`
        console.log(`[VideoProcessing] Input resolution: ${originalResolution}`)

        // 3. Check if upscale needed
        const shouldUpscale = needsUpscale(width, height)
        console.log(`[VideoProcessing] Needs upscale: ${shouldUpscale}`)

        let finalBuffer: Buffer
        let newResolution = originalResolution

        if (shouldUpscale) {
            // 4. Calculate new dimensions
            const { newWidth, newHeight } = calculateNewResolution(width, height)
            newResolution = `${newWidth}x${newHeight}`
            console.log(`[VideoProcessing] Upscaling to: ${newResolution}`)

            // 5. Upscale video
            await upscaleVideo(inputPath, outputPath, newWidth, newHeight)
            finalBuffer = fs.readFileSync(outputPath)
            console.log(`[VideoProcessing] Upscaled video: ${finalBuffer.length} bytes`)
        } else {
            // Use original video
            finalBuffer = buffer
        }

        // 6. Upload to R2
        const fileName = `kling_mc_${uniqueId}.mp4`
        const { url, key } = await uploadToR2(finalBuffer, fileName)
        console.log(`[VideoProcessing] Uploaded to R2: ${url}`)

        return {
            url,
            storageKey: key,
            originalResolution,
            newResolution,
            upscaled: shouldUpscale
        }

    } finally {
        // Cleanup temp files
        try {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath)
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath)
        } catch (e) {
            console.warn('[VideoProcessing] Cleanup warning:', e)
        }
    }
}

/**
 * Check if a URL is a base64 data URL
 */
export function isBase64Video(url: string): boolean {
    return url.startsWith('data:video/')
}
