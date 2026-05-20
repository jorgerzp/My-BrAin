/**
 * Cliente mínimo Groq (API compatible con OpenAI).
 * https://console.groq.com/docs/quickstart
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

function defaultModel() {
  return process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile'
}

/**
 * @param {string} apiKey
 * @param {{ role: string, content: string }[]} messages
 * @param {{ model?: string, temperature?: number, maxOutputTokens?: number }} [options]
 */
export async function groqChatCompletion(apiKey, messages, options = {}) {
  const model = options.model || defaultModel()

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.65,
      max_tokens: options.maxOutputTokens ?? 8192,
    }),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const msg = data?.error?.message || data?.message || `Groq HTTP ${res.status}`
    throw new Error(msg)
  }

  const text = data.choices?.[0]?.message?.content
  if (!text) {
    throw new Error('La IA no devolvió texto.')
  }
  return { text, model }
}

export async function groqGenerateText(apiKey, prompt, options = {}) {
  return groqChatCompletion(apiKey, [{ role: 'user', content: String(prompt) }], options)
}

export function parseJsonFromModel(text) {
  const trimmed = text.trim()
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = fence ? fence[1].trim() : trimmed
  return JSON.parse(raw)
}

/**
 * Intenta extraer JSON del texto del modelo (fence, objeto raíz, o primer bloque `{...}`).
 * @returns {{ ok: true, value: unknown } | { ok: false, error: string, raw: string }}
 */
export function safeParseJsonFromModel(text) {
  const rawFull = String(text || '')
  try {
    return { ok: true, value: parseJsonFromModel(rawFull) }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    try {
      const t = rawFull.trim()
      const start = t.indexOf('{')
      const end = t.lastIndexOf('}')
      if (start >= 0 && end > start) {
        return { ok: true, value: JSON.parse(t.slice(start, end + 1)) }
      }
    } catch (_) {
      /* continuar */
    }
    return { ok: false, error: errMsg, raw: rawFull.slice(0, 1200) }
  }
}
