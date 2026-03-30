/**
 * Chat limits — single place to tune behavior.
 *
 * Where applied:
 * | Constraint            | File           | Effect |
 * |----------------------|----------------|--------|
 * | maxUserMessageChars  | Chat.jsx       | Blocks send; `maxLength` on textarea |
 * | maxContextChars      | Chat.jsx       | Drops oldest turns (after system) so API payload fits |
 * | maxReplyTokens       | ollamaClient.js| `options.num_predict` ceiling |
 * | temperatureMax, etc. | ollamaClient.js| Clamps env sampling so it can’t exceed these |
 */

export const CHAT_CONSTRAINTS = {
  maxUserMessageChars: 12_000,
  maxContextChars: 48_000,
  maxReplyTokens: 512,
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
