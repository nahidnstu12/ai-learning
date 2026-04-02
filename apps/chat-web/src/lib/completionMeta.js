/**
 * Canonical assistant-message metrics for any provider (UI + logs).
 *
 * @typedef {'localllm' | 'groq'} CompletionProvider
 */

/**
 * @typedef {{
 *   provider: CompletionProvider
 *   wallMs: number
 *   promptTokens?: number
 *   completionTokens?: number
 *   serverTiming?: {
 *     totalDurationNs?: number
 *     loadDurationNs?: number
 *     promptEvalDurationNs?: number
 *     evalDurationNs?: number
 *   }
 * }} AssistantCompletionMeta
 */

/**
 * @param {CompletionProvider} provider
 * @param {{
 *   wallMs: number
 *   promptEvalCount?: number
 *   evalCount?: number
 *   totalDurationNs?: number
 *   loadDurationNs?: number
 *   promptEvalDurationNs?: number
 *   evalDurationNs?: number
 * }} raw from `streamChat` / `streamChatGroq` (Groq maps tokens onto *EvalCount fields)
 * @returns {AssistantCompletionMeta}
 */
export function normalizeAssistantMeta(provider, raw) {
  const wallMs = typeof raw.wallMs === 'number' ? raw.wallMs : 0
  const promptTokens = raw.promptEvalCount
  const completionTokens = raw.evalCount

  if (provider === 'localllm') {
    const hasServerTiming =
      raw.totalDurationNs != null ||
      raw.loadDurationNs != null ||
      raw.promptEvalDurationNs != null ||
      raw.evalDurationNs != null

    return {
      provider,
      wallMs,
      promptTokens,
      completionTokens,
      serverTiming: hasServerTiming
        ? {
            totalDurationNs: raw.totalDurationNs,
            loadDurationNs: raw.loadDurationNs,
            promptEvalDurationNs: raw.promptEvalDurationNs,
            evalDurationNs: raw.evalDurationNs,
          }
        : undefined,
    }
  }

  if (provider === 'groq') {
    return {
      provider,
      wallMs,
      promptTokens,
      completionTokens,
    }
  }

  throw new Error(`normalizeAssistantMeta: unknown provider ${String(provider)}`)
}
