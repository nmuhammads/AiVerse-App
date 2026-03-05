import { Request, Response } from 'express'
import { getAppConfig } from '../services/supabaseService.js'

function parseBooleanConfig(value: string | null, defaultValue: boolean): boolean {
  if (value == null) return defaultValue
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return defaultValue
}

export async function getPublicAppConfig(_req: Request, res: Response) {
  try {
    const workflowValue = await getAppConfig('workflow_screen_enabled')

    return res.json({
      workflow_screen_enabled: parseBooleanConfig(workflowValue, true),
    })
  } catch (error) {
    console.error('getPublicAppConfig error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
