/**
 * AI Chat Service
 * Интеграция с NanoGPT API для чата с ИИ
 */

const NANOGPT_API_KEY = process.env.NANOGPT_API_KEY || ''
const NANOGPT_BASE_URL = 'https://nano-gpt.com/api/v1'

export type ChatModel =
    | 'deepseek/deepseek-v3.2'
    | 'zai-org/glm-4.7'
    | 'minimax/minimax-m2.1'
    | 'Qwen/Qwen3-235B-A22B'
    | 'openai/gpt-oss-20b'
    | 'openai/gpt-oss-120b'

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

const SYSTEM_PROMPT = `Ты — AI-ассистент приложения AiVerse, Telegram Mini App для генерации изображений и видео с помощью нейросетей.

ТЫ МОЖЕШЬ ГЕНЕРИРОВАТЬ ИЗОБРАЖЕНИЯ!
Когда пользователь просит сгенерировать изображение, ты должен:
1. Уточнить что именно нужно сгенерировать (если не ясно)
2. Предложить модель генерации
3. Вернуть JSON команду в ТОЧНОМ формате:

\`\`\`json:generate_image
{
  "prompt": "подробное описание на английском",
  "model": "z-image-turbo",
  "size": "1024x1024"
}
\`\`\`

ДОСТУПНЫЕ МОДЕЛИ ДЛЯ ГЕНЕРАЦИИ В ЧАТЕ:
- z-image-turbo (1 токен) — быстрая генерация, хорошее качество
- qwen-image (1 токен) — Qwen Image, художественный стиль

ВАЖНО: Промпт ВСЕГДА пиши на АНГЛИЙСКОМ языке!

КАК ГЕНЕРИРОВАТЬ ИЗОБРАЖЕНИЯ В СТУДИИ:
1. Открой вкладку "Студия" в нижнем меню
2. Выбери тип контента: Фото или Видео
3. Выбери модель (NanoBanana, Seedream и др.)
4. Введи промпт — описание того, что хочешь получить
5. Выбери соотношение сторон (1:1, 16:9, 9:16 и др.)
6. Нажми "Сгенерировать"

МОДЕЛИ В СТУДИИ:
- NanoBanana (3 токена) — быстрая генерация
- NanoBanana Pro (10-15 токенов) — фотореализм
- Seedream 4.0 (4 токена) — художественный стиль
- Seedream 4.5 (7 токенов) — улучшенный художественный
- GPT Image 1.5 (5-15 токенов) — OpenAI

ЦЕНЫ НА ТОКЕНЫ:
- 50 токенов — 100₽
- 120 токенов — 230₽
- 300 токенов — 540₽

💡 Через администратора +15% бонус: https://t.me/aiversebots?direct

ТВОИ ЗАДАЧИ:
1. Генерировать изображения по запросу (используй JSON формат выше)
2. Помогать составлять эффективные промпты
3. Объяснять функции приложения
4. Отвечать на вопросы о моделях

СТИЛЬ:
- Дружелюбный и лаконичный
- Используй эмодзи умеренно
- Отвечай на языке пользователя (RU/EN)`

/**
 * Получить ответ от AI (non-streaming)
 */
export async function getChatCompletion(
    messages: ChatMessage[],
    model: ChatModel = 'deepseek/deepseek-v3.2'
): Promise<string> {
    const fullMessages: ChatMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
    ]

    console.log('[ChatService] Sending request to NanoGPT:', { model, messageCount: messages.length })

    const response = await fetch(`${NANOGPT_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${NANOGPT_API_KEY}`
        },
        body: JSON.stringify({
            model,
            messages: fullMessages,
            stream: false
        })
    })

    const data = await response.json()

    if (!response.ok) {
        console.error('[ChatService] Error response:', data)
        throw new Error(data.error?.message || 'Chat completion failed')
    }

    const content = data.choices?.[0]?.message?.content
    if (!content) {
        throw new Error('No response content')
    }

    console.log('[ChatService] Response received:', content.slice(0, 100))
    return content
}

/**
 * Стриминг ответа от AI (SSE)
 */
export async function* streamChatCompletion(
    messages: ChatMessage[],
    model: ChatModel = 'deepseek/deepseek-v3.2'
): AsyncGenerator<string, void, unknown> {
    const fullMessages: ChatMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
    ]

    console.log('[ChatService] Starting stream to NanoGPT:', { model, messageCount: messages.length })

    const response = await fetch(`${NANOGPT_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${NANOGPT_API_KEY}`,
            'Accept': 'text/event-stream'
        },
        body: JSON.stringify({
            model,
            messages: fullMessages,
            stream: true
        })
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error?.message || `Stream failed: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
        throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
        while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
                if (!line.trim() || !line.startsWith('data: ')) continue

                const data = line.slice(6).trim()
                if (data === '[DONE]') return

                try {
                    const parsed = JSON.parse(data)
                    const content = parsed.choices?.[0]?.delta?.content
                    if (content) {
                        yield content
                    }
                } catch {
                    // Skip invalid JSON
                }
            }
        }
    } finally {
        reader.releaseLock()
    }
}
