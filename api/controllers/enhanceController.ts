import { Request, Response } from 'express'

export async function handleEnhancePrompt(req: Request, res: Response) {
  try {
    const { prompt } = req.body || {}
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt required' })
    }
    const enhanced = `masterpiece, highly detailed, ${prompt}`
    return res.json({ prompt: enhanced })
  } catch {
    return res.status(500).json({ error: 'Enhance failed' })
  }
}
