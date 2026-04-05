import { CHAT_CONSTRAINTS } from './chatConstraints'
import { groupIntoTurns } from './buildApiPayload'
import { streamCompletion } from './streamCompletion'

/**
 * @typedef {{ id?: string; role: string; content: string; pinned?: boolean; contextContent?: string }} InternalRow
 */

const SUMMARY_SYSTEM = `You compress chat transcripts into a single dense summary for another LLM with a small context window.
Rules:
- Be ruthlessly short: 5–12 bullet lines max unless the transcript is huge; no paragraphs of prose.
- Preserve facts: names, numbers, decisions, constraints, tool results, code intent (not full code unless ≤5 lines).
- Keep open questions and unresolved items explicit as a final bullet.
- No preamble or "Here is a summary".`

function turnPinned(t) {
  return !!(t.user?.pinned || t.assistant?.pinned)
}

/**
 * Strip stored API compression so pinned rows are packed raw.
 * @param {InternalRow} row
 */
function stripContextField(row) {
  const { id, role, content, pinned } = row
  return { id, role, content, pinned: !!pinned }
}

/**
 * @param {InternalRow[]} internalMessages — committed rows incl. system
 * @returns {{ system: InternalRow | null; pinnedRows: InternalRow[]; unpinnedTranscript: string }}
 */
export function analyzeHistoryForSummary(internalMessages) {
  const system =
    internalMessages[0]?.role === 'system'
      ? stripContextField(internalMessages[0])
      : null
  const body = system ? internalMessages.slice(1) : [...internalMessages]
  const turns = groupIntoTurns(body)

  /** @type {InternalRow[]} */
  const pinnedRows = []
  /** @type {string[]} */
  const lines = []

  for (const t of turns) {
    if (turnPinned(t)) {
      if (t.user) pinnedRows.push(stripContextField(t.user))
      if (t.assistant) pinnedRows.push(stripContextField(t.assistant))
      continue
    }
    if (t.user?.content) lines.push(`User: ${t.user.content}`)
    if (t.assistant?.content) lines.push(`Assistant: ${t.assistant.content}`)
  }

  return {
    system,
    pinnedRows,
    unpinnedTranscript: lines.join('\n\n').trim(),
  }
}

/**
 * Enabled when `VITE_ENABLE_HISTORY_SUMMARY=1`.
 */
export function isHistorySummaryEnabled() {
  return import.meta.env.VITE_ENABLE_HISTORY_SUMMARY === '1'
}

/**
 * One LLM call: summarize unpinned transcript only (system & pins excluded from input).
 * @param {object} p
 * @param {import('./llmRegistry.js').ChatRoute} p.route
 * @param {string} p.transcript
 * @param {AbortSignal} [p.signal]
 */
export async function summarizeTranscript({ route, transcript, signal }) {
  const messages = [
    { role: 'system', content: SUMMARY_SYSTEM },
    {
      role: 'user',
      content: `Transcript to summarize:\n\n---\n${transcript}\n---`,
    },
  ]
  let acc = ''
  const { fullText } = await streamCompletion({
    route,
    messages,
    signal,
    onChunk: (c) => {
      acc += c
    },
    maxReplyTokens: CHAT_CONSTRAINTS.summaryMaxReplyTokens,
  })
  return (fullText || acc).trim()
}

/**
 * Build internal rows for `buildApiPayload`: system + summary user message + pinned-only rows (no contextContent).
 * Omits all unpinned turns from the packing pipeline (they're inside `summaryText`).
 *
 * @param {object} p
 * @param {InternalRow | null} p.system
 * @param {string} p.summaryText
 * @param {InternalRow[]} p.pinnedRows
 * @param {(prefix?: string) => string} p.newId
 */
export function buildSummarizedInternalMessages({ system, summaryText, pinnedRows, newId }) {
  /** @type {InternalRow[]} */
  const out = []
  if (system) out.push(stripContextField(system))
  if (summaryText) {
    out.push({
      id: newId('summary'),
      role: 'user',
      content: `### Prior conversation (summarized)\n${summaryText}`,
      pinned: false,
    })
  }
  for (const r of pinnedRows) {
    out.push(stripContextField(r))
  }
  return out
}
