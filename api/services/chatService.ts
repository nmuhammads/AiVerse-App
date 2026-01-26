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

export type ContentPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant'
    content: string | ContentPart[]
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
  "size": "1024x1024",
\`\`\`json:generate_image
{
  "prompt": "подробное описание на английском",
  "model": "z-image-turbo",
  "resolution": "1024x1024",
  "image": "https://..." // ТОЧНАЯ ССЫЛКА НА КАРТИНКУ ИЗ СООБЩЕНИЯ ПОЛЬЗОВАТЕЛЯ
}
\`\`\`

ЕСЛИ ПОЛЬЗОВАТЕЛЬ ПРИКРЕПИЛ ИЗОБРАЖЕНИЕ:
- В поле "image" ВСТАВЬ ТОЧНУЮ ССЫЛКУ на это изображение из истории чата (она приходит в поле image_url).
- ЗАПРЕЩЕНО ПРИДУМЫВАТЬ ССЫЛКИ или использовать example.com.
- Это включит режим Image-to-Image (i2i).
- В "prompt" опиши ЧТО ИЗМЕНИТЬ или КАКОЙ СТИЛЬ ПРИМЕНИТЬ к этому изображению.
- ДЛЯ МОДЕЛИ "resolution": Устанавливай "auto" ПО УМОЛЧАНИЮ, если пользователь не указал конкретное соотношение сторон. Если указал — используй запрошенный формат (например, 1024x1024).

ДОСТУПНЫЕ МОДЕЛИ ДЛЯ ГЕНЕРАЦИИ В ЧАТЕ:
- z-image-turbo (2 токена) — быстрая генерация, хорошее качество
- qwen-image (2 токена) — Qwen Image, художественный стиль. ВАЖНО: Использует параметр "resolution".
- qwen-image-plus (4 токена) — Qwen Image +, без ограничений (18+ разрешено).

  Доступные разрешения для Qwen:
  - 1024x1024 (Square HD)
  - 512x512 (Square)
  - 768x1024 (Portrait 3:4)
  - 576x1024 (Portrait 9:16)
  - 1024x768 (Landscape 4:3)
  - 1024x576 (Landscape 16:9)

ВАЖНО — ПРАВИЛА ОБРАБОТКИ ПРОМПТА:
1. В поле "prompt" (в JSON) ты должен вставить ТЕКСТ ЗАПРОСА ПОЛЬЗОВАТЕЛЯ.
2. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО изменять, "улучшать", дополнять или приукрашивать промпт. Не добавляй от себя слова "cinematic", "photorealistic", "hyper detailed" и т.д., если их не было в запросе.
3. ЕДИНСТВЕННОЕ допустимое изменение — это перевод на английский язык (если запрос был не на английском). Перевод должен быть МАКСИМАЛЬНО ТОЧНЫМ и ДОСЛОВНЫМ, без творческой адаптации.
4. Если запрос уже на английском — вставляй его в json ИДЕНТИЧНО, символ в символ.
5. Твоя задача — просто превратить намерение пользователя в JSON команду, ничего не выдумывая от себя.

⛔️ ПРАВИЛА БЕЗОПАСНОСТИ (СТРОГО):
Ты ЗАПРЕЩЕНО генерировать JSON команду для создания следующего контента, ЕСЛИ выбрана модель "z-image-turbo" или "qwen-image":
- Порнография, сексуально откровенный контент, нагота (NSFW, 18+).
- Насилие, расчленение, кровь.
- Незаконные действия.

ИСКЛЮЧЕНИЕ: Модель "qwen-image-plus" НЕ ИМЕЕТ ограничений на NSFW контент. Для неё эти запреты НЕ действуют.

ЕСЛИ пользователь просит NSFW контент и выбрана обычная модель:
1. НЕ ГЕНЕРИРУЙ JSON команду.
2. Вежливо откажи, объяснив, что не можешь создавать такой контент (на языке пользователя).


КАК ГЕНЕРИРОВАТЬ ИЗОБРАЖЕНИЯ В СТУДИИ:
1. Открой вкладку "Студия" в нижнем меню
2. Выбери тип контента: Фото или Видео
3. Выбери модель (NanoBanana, Seedream и др.)
4. Введи промпт — описание того, что хочешь получить
5. Выбери соотношение сторон (1:1, 16:9, 9:16 и др.)
6. Нажми "Сгенерировать"

МОДЕЛИ В СТУДИИ (ФОТО):
- NanoBanana (3 токена) — быстрая
- NanoBanana Pro (15 токенов) — фотореализм
- Seedream 4.0 (4 токена) — арт
- Seedream 4.5 (7 токенов) — улучшенный арт
- GPT Image 1.5 (от 5 токенов) — DALL-E 3 качество

МОДЕЛИ В СТУДИИ (ВИДЕО):
- Seedance 1.5 Pro (от 12 токенов) — анимация
- Kling AI (55-110 токенов) — реалистичное видео высокого качества. Доступна генерация 5с и 10с.

ЦЕНЫ НА ТОКЕНЫ:
- 50 токенов — 100₽
- 120 токенов — 230₽
- 300 токенов — 540₽
- 800 токенов — 1440₽
- 1500 токенов — 2550₽

💡 Через администратора +15% бонус: https://t.me/aiversebots?direct

ТВОИ ЗАДАЧИ:
1. Генерировать изображения по запросу (используй JSON формат выше)
2. Помогать составлять эффективные промпты
3. Объяснять функции приложения
4. Отвечать на вопросы о моделях

ЕСЛИ ПОЛЬЗОВАТЕЛЬ ПРОСИТ СОСТАВИТЬ ПРОМПТ (для генерации):
1. Сначала опиши по-русски детали изображения, разбив на секции: Стиль, Субъект/Объект, Окружение, Освещение, Цвета.
2. Сформируй итоговый, богатый деталями промпт на АНГЛИЙСКОМ языке.
3. ОБЯЗАТЕЛЬНО оберни этот английский промпт в блок кода (\`\`\`text), чтобы пользователь мог его скопировать.

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

    console.log('[ChatService] Starting stream to NanoGPT:', {
        model,
        messageCount: messages.length,
        // Log last user message for context (truncated)
        lastMessage: messages.length > 0 ? JSON.stringify(messages[messages.length - 1]).slice(0, 200) : 'none'
    })

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
        let errorMsg = `Stream failed: ${response.status} ${response.statusText}`
        try {
            const errorData = await response.json()
            errorMsg = errorData.error?.message || errorMsg
        } catch {
            try {
                const textData = await response.text()
                if (textData) errorMsg += ` - ${textData.slice(0, 200)}`
            } catch { /* ignore */ }
        }
        console.error('[ChatService] Stream request failed:', errorMsg)
        throw new Error(errorMsg)
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
                } catch (e) {
                    console.error('[ChatService] Failed to parse stream chunk:', {
                        line: line.slice(0, 100), // Log only first 100 chars
                        error: e
                    })
                }
            }
        }
    } catch (e) {
        console.error('[ChatService] Stream processing error:', e)
        throw e
    } finally {
        reader.releaseLock()
    }
}
