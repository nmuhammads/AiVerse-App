import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config()

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL

const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID || '',
        secretAccessKey: R2_SECRET_ACCESS_KEY || '',
    },
})

async function testR2Image() {
    console.log('Testing R2 Image Access...')

    // Create a simple 1x1 PNG buffer
    const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
    const fileName = `test-image-${Date.now()}.png`

    try {
        // 1. Upload
        console.log(`Uploading ${fileName}...`)
        await s3Client.send(new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: fileName,
            Body: pngBuffer,
            ContentType: 'image/png',
        }))
        console.log('Upload successful.')

        // 2. Test Access
        const publicUrl = `${R2_PUBLIC_URL}/${fileName}`
        console.log(`Testing access to: ${publicUrl}`)

        // Wait a bit
        await new Promise(r => setTimeout(r, 2000))

        const res = await fetch(publicUrl)
        console.log(`Fetch status: ${res.status} ${res.statusText}`)
        console.log(`Content-Type: ${res.headers.get('content-type')}`)
        console.log(`Content-Length: ${res.headers.get('content-length')}`)

        if (res.ok) {
            console.log('SUCCESS: Image is accessible!')
        } else {
            console.error('FAILURE: Could not access image.')
        }

    } catch (e) {
        console.error('Error during test:', e)
    }
}

testR2Image()
