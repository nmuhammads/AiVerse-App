/**
 * Compresses an image file using the Canvas API.
 * Resizes the image if it exceeds max dimensions and compresses it to JPEG.
 * 
 * @param file The image file to compress
 * @param maxWidth Maximum width of the output image (default: 2048)
 * @param maxHeight Maximum height of the output image (default: 2048)
 * @param quality JPEG quality from 0 to 1 (default: 0.8)
 * @returns Promise resolving to the compressed base64 string
 */
export const compressImage = (
    file: File,
    maxWidth = 2048,
    maxHeight = 2048,
    quality = 0.8
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image()
        const objectUrl = URL.createObjectURL(file)

        img.onload = () => {
            URL.revokeObjectURL(objectUrl)

            let width = img.width
            let height = img.height

            // Calculate new dimensions while maintaining aspect ratio
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height)
                width *= ratio
                height *= ratio
            }

            const canvas = document.createElement('canvas')
            canvas.width = width
            canvas.height = height
            const ctx = canvas.getContext('2d')

            if (!ctx) {
                reject(new Error('Failed to get canvas context'))
                return
            }

            ctx.drawImage(img, 0, 0, width, height)

            // Compress to JPEG
            // Note: toDataURL is synchronous and creates a string. 
            // For very large images on low memory devices, toBlob might be safer but requires async handling.
            // Keeping toDataURL for now as it matches the function signature (Promise<string>).
            const compressedDataUrl = canvas.toDataURL('image/jpeg', quality)
            resolve(compressedDataUrl)
        }

        img.onerror = (error) => {
            URL.revokeObjectURL(objectUrl)
            reject(error)
        }

        img.src = objectUrl
    })
}
