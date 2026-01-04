import sharp from 'sharp'

/**
 * Calculate position coordinates for watermark text
 */
/**
 * Escape XML special characters for SVG
 */
function escapeXml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

/**
 * Calculate position coordinates for watermark (text or image)
 */
function calculatePosition(
    position: string,
    containerWidth: number,
    containerHeight: number,
    itemWidth: number,
    itemHeight: number
): { x: number; y: number } {
    const padding = 20

    let x: number
    let y: number

    // Horizontal position
    console.log(`[WatermarkCalc] Position: "${position}", W: ${containerWidth}, ItemW: ${itemWidth}`)
    if (position.includes('left')) {
        x = padding
    } else if (position.includes('right')) {
        x = containerWidth - itemWidth - padding
    } else {
        x = (containerWidth - itemWidth) / 2
    }
    console.log(`[WatermarkCalc] Calculated X: ${x}`)

    // Vertical position
    if (position.includes('top')) {
        y = padding
    } else if (position.includes('bottom')) {
        y = containerHeight - itemHeight - padding
    } else {
        y = (containerHeight - itemHeight) / 2
    }

    return { x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)) }
}

// ... existing escapeXml ...

// positionToGravity is no longer needed but kept if needed elsewhere, 
// though we are replacing its usage in applyImageWatermark.

/**
 * Apply image watermark (AI logo)
 */
export async function applyImageWatermark(
    imageBuffer: Buffer,
    watermarkUrl: string,
    position: string = 'bottom-right',
    opacity: number = 0.5,
    scale: number = 20  // Percentage of image width (default 20%)
): Promise<Buffer> {
    try {
        // 1. Fetch watermark image
        const wmResp = await fetch(watermarkUrl)
        if (!wmResp.ok) throw new Error('Failed to fetch watermark image')
        const wmBuffer = Buffer.from(await wmResp.arrayBuffer())

        // Get main image metadata
        const mainImage = sharp(imageBuffer)
        const mainMeta = await mainImage.metadata()
        const mainWidth = mainMeta.width || 1024
        const mainHeight = mainMeta.height || 1024

        // Calculate target width based on scale percentage
        const targetWidth = Math.round(mainWidth * (scale / 100))

        // 2. Resize watermark
        // Trim transparent borders first to ensure accurate positioning
        const trimmedWmBuffer = await sharp(wmBuffer).trim().toBuffer()

        // Resize and apply opacity
        const wmResizedBuffer = await sharp(trimmedWmBuffer)
            .resize(targetWidth, null, { fit: 'inside' }) // resize by width, auto height
            .ensureAlpha()
            .composite([{
                input: Buffer.from([255, 255, 255, Math.round(opacity * 255)]),
                raw: { width: 1, height: 1, channels: 4 },
                tile: true,
                blend: 'dest-in'
            }])
            .toBuffer()

        // Get dimensions of resized watermark for positioning
        const wmMeta = await sharp(wmResizedBuffer).metadata()
        const wmWidth = wmMeta.width || targetWidth
        const wmHeight = wmMeta.height || targetWidth

        // Calculate explicit coordinates
        const { x, y } = calculatePosition(position, mainWidth, mainHeight, wmWidth, wmHeight)

        // 3. Composite onto main image using explicit top/left
        return sharp(imageBuffer)
            .composite([{
                input: wmResizedBuffer,
                top: y,
                left: x
            }])
            .toBuffer()

    } catch (e) {
        console.error('applyImageWatermark error:', e)
        return imageBuffer // Fallback: return original
    }
}

/**
 * Apply text watermark to image using Sharp
 */
export async function applyTextWatermark(
    imageBuffer: Buffer,
    text: string,
    position: string = 'bottom-right',
    opacity: number = 0.5,
    fontSize: number = 48,
    fontColor: string = '#FFFFFF'
): Promise<Buffer> {
    const image = sharp(imageBuffer)
    const metadata = await image.metadata()

    const width = metadata.width || 1024
    const height = metadata.height || 1024

    // Estimate text width and height
    // Text height is approximately fontSize
    const textHeight = fontSize
    const textWidth = text.length * fontSize * 0.6

    // Calculate position
    const { x, y } = calculatePosition(position, width, height, textWidth, textHeight)

    // For SVG text, y is usually the baseline. 
    // If calculatePosition returns top-left corner of the bbox, we need to adjust y for SVG text baseline.
    // SVG text 'y' attribute usually specifies the baseline. 
    // If we want 'y' to be the top of the text, we add approx 0.8 * fontSize (ascender).
    // Let's adjust y for text specific rendering.
    const svgY = y + (fontSize * 0.8)

    // Create SVG text overlay with shadow for better visibility
    const svgText = `
    <svg width="${width}" height="${height}">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.5"/>
        </filter>
      </defs>
      <text 
        x="${x + (textWidth / 2)}" 
        y="${svgY}" 
        font-size="${fontSize}" 
        fill="${fontColor}" 
        opacity="${opacity}"
        font-family="Arial, Helvetica, sans-serif"
        font-weight="bold"
        text-anchor="middle"
        filter="url(#shadow)"
      >${escapeXml(text)}</text>
    </svg>
  `
    // Note: I changed text-anchor to middle and x to center of rect to center text horizontally better

    return image
        .composite([{ input: Buffer.from(svgText), top: 0, left: 0 }])
        .toBuffer()
}
