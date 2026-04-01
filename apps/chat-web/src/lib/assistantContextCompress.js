import { CHAT_CONSTRAINTS } from './chatConstraints'

/**
 * Heuristic shrink for long assistant replies in API context only (UI keeps full text).
 * @param {string} text
 */
export function heuristicCompressAssistantContent(text) {
  const head = CHAT_CONSTRAINTS.assistantCompressHeadChars
  const tail = CHAT_CONSTRAINTS.assistantCompressTailChars
  const min = CHAT_CONSTRAINTS.assistantContextCompressMinChars
  if (!text || text.length < min) return text
  if (text.length <= head + tail + 80) return text
  const dropped = text.length - head - tail
  return `${text.slice(0, head)}\n\n… [${dropped} chars omitted for API context] …\n\n${text.slice(-tail)}`
}

/**
 * Fields to merge onto an assistant message when streaming completes.
 * @param {string} fullText
 * @returns {{ contextContent?: string }}
 */
export function maybeAssistantContextContentFields(fullText) {
  const min = CHAT_CONSTRAINTS.assistantContextCompressMinChars
  if (!fullText || fullText.length < min) return {}
  return { contextContent: heuristicCompressAssistantContent(fullText) }
}
