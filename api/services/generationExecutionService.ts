import type { Request, Response } from 'express'
import { handleGenerateImage } from '../controllers/generationController.js'

type GenerateExecutionResult = {
  ok: boolean
  status: number
  data: any
}

export async function executeGenerationRequest(body: Record<string, unknown>): Promise<GenerateExecutionResult> {
  return new Promise((resolve) => {
    const req = { body } as Request

    let statusCode = 200
    const res = {
      status(code: number) {
        statusCode = code
        return this
      },
      json(payload: any) {
        resolve({
          ok: statusCode >= 200 && statusCode < 300,
          status: statusCode,
          data: payload,
        })
        return this
      },
    } as unknown as Response

    Promise.resolve(handleGenerateImage(req, res)).catch((error) => {
      resolve({
        ok: false,
        status: 500,
        data: { error: error instanceof Error ? error.message : 'Generation execution failed' },
      })
    })
  })
}
