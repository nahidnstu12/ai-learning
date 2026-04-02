import { normalizeAssistantMeta } from './completionMeta'
import { streamChatGroq } from './groqClient'
import { streamChat } from './ollamaClient'

/**
 * @typedef {import('./llmRegistry.js').ChatRoute} ChatRoute
 * @typedef {import('./completionMeta.js').AssistantCompletionMeta} AssistantCompletionMeta
 */

/**
 * @param {object} p
 * @param {ChatRoute} p.route
 * @param {{ role: string; content: string }[]} p.messages
 * @param {AbortSignal} [p.signal]
 * @param {(chunk: string) => void} p.onChunk
 * @param {number} [p.maxReplyTokens] — optional cap for this call (summarizer, etc.)
 * @returns {Promise<{ fullText: string; meta: AssistantCompletionMeta }>}
 */
export async function streamCompletion({
  route,
  messages,
  signal,
  onChunk,
  maxReplyTokens,
}) {
  if (route.provider === 'localllm') {
    const { fullText, metrics } = await streamChat({
      messages,
      signal,
      onChunk,
      model: route.model,
      numPredict: maxReplyTokens,
    })
    return { fullText, meta: normalizeAssistantMeta('localllm', metrics) }
  }
  if (route.provider === 'groq') {
    const { fullText, metrics } = await streamChatGroq({
      messages,
      signal,
      onChunk,
      model: route.model,
      maxTokens: maxReplyTokens,
    })
    return { fullText, meta: normalizeAssistantMeta('groq', metrics) }
  }
  throw new Error(`Unknown provider: ${route.provider}`)
}
