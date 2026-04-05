/**
 * Chat limits — single place to tune behavior.
 *
 * Where applied:
 * | Constraint            | File           | Effect |
 * |----------------------|----------------|--------|
 * | maxUserMessageChars  | Chat.jsx       | Blocks send; `maxLength` on textarea |
 * | maxContextTokenBudget| buildApiPayload | Est. token budget + scored turn eviction |
 * | maxContextChars      | (legacy / fallback) | Still exported; pipeline prefers tokens |
 * | maxReplyTokens       | ollamaClient.js + groqClient | `VITE_CHAT_MAX_REPLY_TOKENS` (main reply cap) |
 * | summaryMaxReplyTokens| summarizeHistory.js + streamCompletion | `VITE_SUMMARY_NUM_PREDICT` (summarizer only) |
 * | temperatureMax, etc. | ollamaClient.js| Clamps env sampling so it can’t exceed these |
 *
 * Tighter context (simulate small windows / prod caps): `VITE_CONTEXT_TOKEN_BUDGET` in `.env`
 */

function resolveContextTokenBudget() {
  const raw = import.meta.env.VITE_CONTEXT_TOKEN_BUDGET
  if (raw === undefined || raw === '') return 8192
  const n = Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || n < 256) return 8192
  return Math.min(n, 500_000)
}

function resolveSummaryMaxReplyTokens() {
  const raw = import.meta.env.VITE_SUMMARY_NUM_PREDICT
  if (raw === undefined || raw === '') return 1024
  const n = Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || n < 64) return 1024
  return Math.min(n, 8192)
}

/** Main chat completion cap (Groq `max_tokens`, Ollama `num_predict` upper bound). Shorter = crisper answers in practice. */
function resolveMaxReplyTokens() {
  const raw = import.meta.env.VITE_CHAT_MAX_REPLY_TOKENS
  if (raw === undefined || raw === '') return 512
  const n = Number.parseInt(String(raw), 10)
  if (!Number.isFinite(n) || n < 64) return 512
  return Math.min(n, 8192)
}

export const CHAT_CONSTRAINTS = {
  maxUserMessageChars: 12_000,
  maxContextChars: 48_000,
  /** Est. prompt token budget for `buildApiPayload` (chars÷4 heuristic). Override with `VITE_CONTEXT_TOKEN_BUDGET`. */
  maxContextTokenBudget: resolveContextTokenBudget(),
  maxReplyTokens: resolveMaxReplyTokens(),
  /** Max new tokens for the history summarizer call (`streamCompletion` override). */
  summaryMaxReplyTokens: resolveSummaryMaxReplyTokens(),
  /** Assistant replies longer than this get a smaller `contextContent` for API packing. */
  assistantContextCompressMinChars: 3_500,
  assistantCompressHeadChars: 450,
  assistantCompressTailChars: 450,
  temperatureMax: 1.2,
  topPMax: 1,
  topKMax: 128,
  repeatPenaltyMax: 2,
}

/**
 * @param {{ role: string; content: string }[]} messages
 * @param {number} [maxChars]
 * @returns {{ role: string; content: string }[]}
 */
export function clipMessagesForApi(messages, maxChars = CHAT_CONSTRAINTS.maxContextChars) {
  if (!messages?.length) return []
  let head = []
  let tail = messages
  if (messages[0]?.role === 'system') {
    head = [messages[0]]
    tail = messages.slice(1)
  }
  const headChars = head.reduce((n, m) => n + (m.content?.length ?? 0), 0)
  let budget = maxChars - headChars
  if (budget <= 0) return head

  const kept = []
  for (let i = tail.length - 1; i >= 0; i--) {
    const len = tail[i].content?.length ?? 0
    if (len <= budget) {
      kept.unshift(tail[i])
      budget -= len
    } else {
      break
    }
  }
  return [...head, ...kept]
}

/**
 * @param {{ role: string; content: string }[]} messages
 */
export function totalContentChars(messages) {
  return messages.reduce((n, m) => n + (m.content?.length ?? 0), 0)
}
