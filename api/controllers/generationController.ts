import { Request, Response } from 'express'

// Типы для запросов к Kie.ai
interface KieAIRequest {
  model: string
  prompt: string
  aspect_ratio?: string
  image?: string // Для Qwen Edit
}

interface KieAIResponse {
  images?: string[]
  error?: string
}

// Конфигурация моделей
const MODEL_CONFIGS = {
  'flux': {
    modelId: 'flux',
    type: 'text-to-image'
  },
  'seedream4': {
    modelId: 'seedream4',
    type: 'text-to-image'
  },
  'nanobanana': {
    modelId: 'nanobanana',
    type: 'text-to-image'
  },
  'qwen-edit': {
    modelId: 'qwen-edit',
    type: 'image-to-image'
  }
}

// Функция для генерации изображения через Kie.ai
async function generateImageWithKieAI(
  apiKey: string,
  requestData: KieAIRequest
): Promise<KieAIResponse> {
  try {
    const { model, prompt, aspect_ratio, image } = requestData
    
    // Подготовка данных для запроса
    const requestBody: any = {
      model: MODEL_CONFIGS[model as keyof typeof MODEL_CONFIGS].modelId,
      prompt: prompt
    }

    // Добавление aspect_ratio для text-to-image моделей
    if (MODEL_CONFIGS[model as keyof typeof MODEL_CONFIGS].type === 'text-to-image' && aspect_ratio) {
      requestBody.aspect_ratio = aspect_ratio
    }

    // Добавление изображения для image-to-image моделей (Qwen Edit)
    if (MODEL_CONFIGS[model as keyof typeof MODEL_CONFIGS].type === 'image-to-image' && image) {
      requestBody.image = image
    }

    const response = await fetch('https://kie.ai/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data

  } catch (error) {
    console.error('Kie.ai API error:', error)
    return { 
      error: error instanceof Error ? error.message : 'Failed to generate image' 
    }
  }
}

// Основной контроллер для обработки запросов генерации
export async function handleGenerateImage(req: Request, res: Response) {
  try {
    const { prompt, model, aspect_ratio, image } = req.body

    // Валидация входных данных
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ 
        error: 'Prompt is required and must be a string' 
      })
    }

    if (!model || !MODEL_CONFIGS[model as keyof typeof MODEL_CONFIGS]) {
      return res.status(400).json({ 
        error: 'Valid model is required. Available models: flux, seedream4, nanobanana, qwen-edit' 
      })
    }

    // Проверка API ключа
    const apiKey = process.env.KIE_API_KEY
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'KIE_API_KEY is not configured' 
      })
    }

    // Для Qwen Edit требуется изображение
    if (model === 'qwen-edit' && !image) {
      return res.status(400).json({ 
        error: 'Image is required for qwen-edit model' 
      })
    }

    // Вызов Kie.ai API
    const result = await generateImageWithKieAI(apiKey, {
      model,
      prompt,
      aspect_ratio,
      image
    })

    if (result.error) {
      return res.status(500).json({ error: result.error })
    }

    // Возвращаем первое изображение из массива
    if (result.images && result.images.length > 0) {
      return res.json({ 
        image: result.images[0],
        prompt: prompt,
        model: model
      })
    } else {
      return res.status(500).json({ 
        error: 'No images generated' 
      })
    }

  } catch (error) {
    console.error('Generation error:', error)
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    })
  }
}