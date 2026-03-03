import { execFile } from 'child_process'
import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { promisify } from 'util'
import { uploadVideoBuffer } from './r2Service.js'

const execFileAsync = promisify(execFile)

const TARGET_WIDTH = 1280
const TARGET_HEIGHT = 720
const TARGET_FPS = 30
const MAX_INPUT_VIDEOS = 12

function sanitizeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48) || 'node'
}

function buildConcatFilter(inputCount: number): string {
  const chains: string[] = []
  for (let index = 0; index < inputCount; index += 1) {
    chains.push(
      `[${index}:v]fps=${TARGET_FPS},scale=${TARGET_WIDTH}:${TARGET_HEIGHT}:force_original_aspect_ratio=decrease,pad=${TARGET_WIDTH}:${TARGET_HEIGHT}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v${index}]`
    )
  }
  const concatInputs = Array.from({ length: inputCount }, (_, idx) => `[v${idx}]`).join('')
  return `${chains.join(';')};${concatInputs}concat=n=${inputCount}:v=1:a=0[vout]`
}

async function downloadVideoToPath(url: string, targetPath: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download input video (${response.status})`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  await fs.writeFile(targetPath, buffer)
}

export async function concatWorkflowVideos(params: {
  runId: number
  nodeId: string
  videoUrls: string[]
}): Promise<string> {
  const { runId, nodeId, videoUrls } = params
  if (videoUrls.length < 2) {
    throw new Error(`video.concat requires at least 2 input videos`)
  }
  if (videoUrls.length > MAX_INPUT_VIDEOS) {
    throw new Error(`video.concat accepts at most ${MAX_INPUT_VIDEOS} input videos`)
  }

  const uid = crypto.randomBytes(6).toString('hex')
  const safeNodeId = sanitizeFilePart(nodeId)
  const tempDir = path.join(process.cwd(), 'uploads', 'temp_workflow', `run_${runId}_${safeNodeId}_${uid}`)
  const outputPath = path.join(tempDir, 'merged.mp4')
  const inputPaths = videoUrls.map((_, index) => path.join(tempDir, `input_${index + 1}.mp4`))

  await fs.mkdir(tempDir, { recursive: true })

  try {
    for (let index = 0; index < videoUrls.length; index += 1) {
      await downloadVideoToPath(videoUrls[index], inputPaths[index])
    }

    const ffmpegArgs: string[] = ['-y', '-hide_banner', '-loglevel', 'error']
    for (const inputPath of inputPaths) {
      ffmpegArgs.push('-i', inputPath)
    }
    ffmpegArgs.push(
      '-filter_complex', buildConcatFilter(inputPaths.length),
      '-map', '[vout]',
      '-r', String(TARGET_FPS),
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-an',
      outputPath
    )

    await execFileAsync('ffmpeg', ffmpegArgs, { maxBuffer: 4 * 1024 * 1024 })

    const mergedBuffer = await fs.readFile(outputPath)
    const fileName = `workflow_${runId}_${safeNodeId}_${Date.now()}.mp4`
    return await uploadVideoBuffer(mergedBuffer, {
      folder: 'workflow/concat',
      fileName,
    })
  } catch (error) {
    const maybeErr = error as { code?: string; stderr?: string; message?: string }
    if (maybeErr.code === 'ENOENT') {
      throw new Error('ffmpeg is not installed on server')
    }
    if (typeof maybeErr.stderr === 'string' && maybeErr.stderr.trim().length > 0) {
      throw new Error(`video.concat ffmpeg failed: ${maybeErr.stderr.trim()}`)
    }
    throw error
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}
