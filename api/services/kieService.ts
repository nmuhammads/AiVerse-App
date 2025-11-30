const KIE_API_KEY = process.env.KIE_API_KEY
const KIE_BASE_URL = 'https://kieai.redpandaai.co'

interface KieUploadResponse {
    success: boolean
    code: number
    msg: string
    data?: {
        fileId: string
        fileName: string
        fileUrl: string
        downloadUrl: string
    }
}

export async function uploadImageToKie(fileUrl: string): Promise<string> {
    if (!KIE_API_KEY) {
        console.warn('KIE_API_KEY missing, skipping Kie upload')
        return fileUrl
    }

    try {
        const response = await fetch(`${KIE_BASE_URL}/api/file-url-upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${KIE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fileUrl,
                uploadPath: 'generations',
                // Optional: fileName could be added if needed
            })
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Kie upload failed (${response.status}): ${errorText}`)
        }

        const result = await response.json() as KieUploadResponse

        if (result.success && result.data?.fileUrl) {
            return result.data.fileUrl
        } else {
            throw new Error(result.msg || 'Kie upload failed with unknown error')
        }
    } catch (error) {
        console.error('Kie upload error:', error)
        // Fallback to original URL if upload fails, though it might fail generation too
        return fileUrl
    }
}
