import axios, { isCancel } from 'axios'
import { CHAT_CONSTRAINTS } from './chatConstraints'

/**
 * @typedef {{
 *   wallMs: number
 *   promptEvalCount?: number
 *   evalCount?: number
 *   totalDurationNs?: number
 *   loadDurationNs?: number
 *   promptEvalDurationNs?: number
 *   evalDurationNs?: number
 * }} StreamMetrics
 */

/** Base URL: `/ollama` (Vite proxy) or full `http://...:11434` */
const baseURL = (import.meta.env.VITE_OLLAMA_URL ?? '').replace(/\/$/, '')

export const ollamaAxios = axios.create({
  baseURL,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
})

if (import.meta.env.DEV) {
  ollamaAxios.interceptors.request.use((config) => {
    const url = `${config.baseURL ?? ''}${config.url ?? ''}`
    console.info('[ollama]', config.method?.toUpperCase(), url)
    return config
  })
  ollamaAxios.interceptors.response.use(
    (res) => {
      console.info('[ollama]', res.status, res.config.url, res.data)
      return res
    },
    (err) => {
      if (isCancel(err) || err?.code === 'ERR_CANCELED' || err?.name === 'AbortError') {
        return Promise.reject(err)
      }
      const msg = err.response?.data ?? err.message
      console.error('[ollama]', err.response?.status ?? err.code, err.config?.url, msg)
      return Promise.reject(err)
    },
  )
}

function chatOptions() {
  const npRaw = Number.parseInt(
    import.meta.env.VITE_CHAT_NUM_PREDICT ?? String(CHAT_CONSTRAINTS.maxReplyTokens),
    10,
  )
  const num_predict = Math.min(
    Number.isFinite(npRaw) ? npRaw : CHAT_CONSTRAINTS.maxReplyTokens,
    CHAT_CONSTRAINTS.maxReplyTokens,
  )
  return {
    temperature: Math.min(
      Number.parseFloat(import.meta.env.VITE_CHAT_TEMPERATURE ?? '0.7'),
      CHAT_CONSTRAINTS.temperatureMax,
    ),
    top_p: Math.min(
      Number.parseFloat(import.meta.env.VITE_CHAT_TOP_P ?? '0.9'),
      CHAT_CONSTRAINTS.topPMax,
    ),
    top_k: Math.min(
      Number.parseInt(import.meta.env.VITE_CHAT_TOP_K ?? '40', 10),
      CHAT_CONSTRAINTS.topKMax,
    ),
    repeat_penalty: Math.min(
      Number.parseFloat(import.meta.env.VITE_CHAT_REPEAT_PENALTY ?? '1.1'),
      CHAT_CONSTRAINTS.repeatPenaltyMax,
    ),
    num_predict,
  }
}

/**
 * @param {object} p
 * @param {{ role: string; content: string }[]} p.messages
 * @param {AbortSignal} [p.signal]
 * @param {(chunk: string) => void} p.onChunk
 * @returns {Promise<{ fullText: string; metrics: StreamMetrics }>}
 */
export async function streamChat({ messages, signal, onChunk }) {
  const model = import.meta.env.VITE_MODEL_CHAT ?? 'phi3'
  const url = `${baseURL}/api/chat`
  const body = {
    model,
    messages,
    stream: true,
    keep_alive: import.meta.env.VITE_OLLAMA_KEEP_ALIVE ?? '5m',
    options: chatOptions(),
  }

  const t0 = performance.now()
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ollama ${res.status}: ${text}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  /** @type {StreamMetrics} */
  const metrics = {
    wallMs: 0,
    promptEvalCount: undefined,
    evalCount: undefined,
    totalDurationNs: undefined,
    loadDurationNs: undefined,
    promptEvalDurationNs: undefined,
    evalDurationNs: undefined,
  }

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let nl
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        if (!line) continue

        const obj = JSON.parse(line)
        const piece = obj.message?.content ?? ''
        if (piece) {
          fullText += piece
          onChunk(piece)
        }

        if (obj.done) {
          metrics.promptEvalCount = obj.prompt_eval_count
          metrics.evalCount = obj.eval_count
          metrics.totalDurationNs = obj.total_duration
          metrics.loadDurationNs = obj.load_duration
          metrics.promptEvalDurationNs = obj.prompt_eval_duration
          metrics.evalDurationNs = obj.eval_duration
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  const tail = buffer.trim()
  if (tail) {
    const obj = JSON.parse(tail)
    const piece = obj.message?.content ?? ''
    if (piece) {
      fullText += piece
      onChunk(piece)
    }
    if (obj.done) {
      metrics.promptEvalCount = obj.prompt_eval_count
      metrics.evalCount = obj.eval_count
      metrics.totalDurationNs = obj.total_duration
      metrics.loadDurationNs = obj.load_duration
      metrics.promptEvalDurationNs = obj.prompt_eval_duration
      metrics.evalDurationNs = obj.eval_duration
    }
  }

  metrics.wallMs = Math.round(performance.now() - t0)
  return { fullText, metrics }
}

/**
 * @param {object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<{ ok: true, models: string[] } | { ok: false, error: string } | { cancelled: true }>}
 */
export async function checkOllamaHealth(options = {}) {
  const { signal } = options
  try {
    const { data } = await ollamaAxios.get('/api/tags', { signal })
    const models = (data?.models ?? []).map((m) => m.name).filter(Boolean)
    return { ok: true, models }
  } catch (e) {
    if (isCancel(e) || e?.code === 'ERR_CANCELED' || e?.name === 'AbortError') {
      return { cancelled: true }
    }
    const msg =
      e.response?.data?.error ??
      e.message ??
      (typeof e.response?.data === 'string' ? e.response.data : 'Request failed')
    return { ok: false, error: String(msg) }
  }
}
