import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import dotenv from 'dotenv'

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

async function testR2() {
    console.log('Testing R2 Access...')
    console.log('Bucket:', R2_BUCKET_NAME)
    console.log('Public URL Base:', R2_PUBLIC_URL)

    const fileName = `test-${Date.now()}.txt`
    const content = 'Hello from R2 Test!'

    try {
        // 1. Upload
        console.log(`Uploading ${fileName}...`)
        await s3Client.send(new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: fileName,
            Body: content,
            ContentType: 'text/plain',
        }))
        console.log('Upload successful.')

        // 2. Test Access
        const publicUrl = `${R2_PUBLIC_URL}/${fileName}`
        console.log(`Testing access to: ${publicUrl}`)

        // Wait a bit for propagation
        await new Promise(r => setTimeout(r, 2000))

        const res = await fetch(publicUrl)
        console.log(`Fetch status: ${res.status} ${res.statusText}`)

        if (res.ok) {
            const text = await res.text()
            console.log('Content:', text)
            if (text === content) {
                console.log('SUCCESS: R2 bucket is public and accessible!')
            } else {
                console.log('WARNING: Content mismatch.')
            }
        } else {
            console.error('FAILURE: Could not access file via public URL.')
            console.error('This means the bucket is NOT public or the URL is wrong.')
        }

    } catch (e) {
        console.error('Error during test:', e)
    }
}

testR2()
