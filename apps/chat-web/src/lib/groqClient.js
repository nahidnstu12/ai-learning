import { CHAT_CONSTRAINTS } from './chatConstraints'

/**
 * @typedef {{ wallMs: number; promptEvalCount?: number; evalCount?: number }} GroqStreamMetrics
 */

/**
 * Groq / OpenAI-compat: `usage` on final chunk when `stream_options.include_usage` is set.
 * @param {GroqStreamMetrics} metrics
 * @param {Record<string, unknown>} json
 */
function applyUsageToMetrics(metrics, json) {
  const usage = /** @type {{ prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined} */ (
    json.usage
  )
  const xGroq = /** @type {{ usage?: typeof usage } | undefined} */ (json.x_groq)
  const u = usage ?? xGroq?.usage
  if (!u) return
  if (typeof u.prompt_tokens === 'number') metrics.promptEvalCount = u.prompt_tokens
  if (typeof u.completion_tokens === 'number') metrics.evalCount = u.completion_tokens
}

/**
 * Groq OpenAI-compatible streaming chat.
 *
 * Dev (recommended): leave `VITE_GROQ_BASE_URL` unset → POST `/groq/chat/completions`
 * so Vite can attach `GROQ_API_KEY` / `VITE_GROQ_API_KEY` in the proxy (key not in bundle).
 *
 * Direct browser calls: set `VITE_GROQ_BASE_URL=https://api.groq.com/openai/v1` and
 * `VITE_GROQ_API_KEY` (key is embedded — local / trusted only).
 */

/**
 * @param {object} p
 * @param {{ role: string; content: string }[]} p.messages
 * @param {AbortSignal} [p.signal]
 * @param {(chunk: string) => void} p.onChunk
 * @param {string} p.model
 * @returns {Promise<{ fullText: string; metrics: GroqStreamMetrics }>}
 */
export async function streamChatGroq({
  messages,
  signal,
  onChunk,
  model,
  /** Override max output tokens (e.g. summarizer). */
  maxTokens,
} = {}) {
  const rawBase = import.meta.env.VITE_GROQ_BASE_URL?.trim() ?? ''
  const base = rawBase.replace(/\/$/, '')
  const url = base ? `${base}/chat/completions` : '/groq/chat/completions'

  /** @type {Record<string, string>} */
  const headers = { 'Content-Type': 'application/json' }
  const clientKey = import.meta.env.VITE_GROQ_API_KEY?.trim()
  if (base && clientKey) headers.Authorization = `Bearer ${clientKey}`

  const temperature = Math.min(
    Number.parseFloat(
      import.meta.env.VITE_GROQ_TEMPERATURE ??
        import.meta.env.VITE_CHAT_TEMPERATURE ??
        '0.7',
    ),
    CHAT_CONSTRAINTS.temperatureMax,
  )

  const t0 = performance.now()
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens:
        maxTokens != null && Number.isFinite(maxTokens)
          ? Math.min(Math.max(64, maxTokens), 8192)
          : CHAT_CONSTRAINTS.maxReplyTokens,
      temperature: Number.isFinite(temperature) ? temperature : 0.7,
    }),
    signal,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Groq ${res.status}: ${text}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let carry = ''
  let fullText = ''
  /** @type {GroqStreamMetrics} */
  const metrics = { wallMs: 0 }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      carry += decoder.decode(value, { stream: true })

      let boundary
      while ((boundary = carry.indexOf('\n')) >= 0) {
        let line = carry.slice(0, boundary)
        carry = carry.slice(boundary + 1)
        line = line.replace(/\r$/, '').trimEnd()
        if (!line) continue
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') continue
        try {
          const json = JSON.parse(data)
          const err = json.error?.message
          if (err) throw new Error(err)
          const piece = json.choices?.[0]?.delta?.content ?? ''
          if (piece) {
            fullText += piece
            onChunk(piece)
          }
          applyUsageToMetrics(metrics, json)
        } catch (e) {
          if (e instanceof SyntaxError) continue
          throw e
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  const tail = carry.trim()
  if (tail.startsWith('data:')) {
    const data = tail.slice(5).trim()
    if (data && data !== '[DONE]') {
      try {
        const json = JSON.parse(data)
        const piece = json.choices?.[0]?.delta?.content ?? ''
        if (piece) {
          fullText += piece
          onChunk(piece)
        }
        applyUsageToMetrics(metrics, json)
      } catch {
        /* ignore trailing parse errors */
      }
    }
  }

  metrics.wallMs = Math.round(performance.now() - t0)
  return { fullText, metrics }
}
