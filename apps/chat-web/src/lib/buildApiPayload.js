import { CHAT_CONSTRAINTS } from './chatConstraints'
import { heuristicCompressAssistantContent } from './assistantContextCompress'
import { logPipelineRun } from './contextPipelineLog'

/**
 * @typedef {{ id?: string; role: string; content: string; pinned?: boolean; contextContent?: string }} InternalRow
 */

/** Phase 2 placeholder: ~4 chars/token heuristic. */
export function estimateTokensForText(s) {
  if (!s) return 0
  return Math.max(1, Math.ceil(s.length / 4))
}

/**
 * @param {{ role: string; content: string }[]} ollamaMessages
 */
export function estimateTokensForMessages(ollamaMessages) {
  return ollamaMessages.reduce((n, m) => n + estimateTokensForText(m.content), 0)
}

/**
 * @param {InternalRow} row
 */
function apiUserContent(row) {
  return row.content ?? ''
}

/**
 * [3] Effective string sent to Ollama for an assistant row (compression layer).
 * @param {InternalRow} row
 */
function effectiveAssistantApiContent(row) {
  if (row.contextContent) return row.contextContent
  const raw = row.content ?? ''
  if (raw.length >= CHAT_CONSTRAINTS.assistantContextCompressMinChars) {
    return heuristicCompressAssistantContent(raw)
  }
  return raw
}

/**
 * @param {InternalRow[]} rows no system
 * @returns {{ user: InternalRow | null; assistant: InternalRow | null; index: number }[]}
 */
export function groupIntoTurns(rows) {
  /** @type {{ user: InternalRow | null; assistant: InternalRow | null; index: number }[]} */
  const turns = []
  let i = 0
  while (i < rows.length) {
    const r = rows[i]
    const index = turns.length
    if (r.role === 'user') {
      const turn = { user: r, assistant: null, index }
      i++
      if (i < rows.length && rows[i].role === 'assistant') {
        turn.assistant = rows[i]
        i++
      }
      turns.push(turn)
    } else if (r.role === 'assistant') {
      turns.push({ user: null, assistant: r, index })
      i++
    }
  }
  return turns
}

function turnPinned(t) {
  return !!(t.user?.pinned || t.assistant?.pinned)
}

function turnId(t) {
  return t.user?.id ?? t.assistant?.id ?? `turn-${t.index}`
}

/**
 * @param {{ user: InternalRow | null; assistant: InternalRow | null; index: number }} t
 * @param {number} turnIndex
 * @param {number} totalTurns
 */
export function scoreTurn(t, turnIndex, totalTurns) {
  if (turnPinned(t)) return Number.POSITIVE_INFINITY
  let score = 0
  if (totalTurns > 0 && turnIndex / totalTurns > 0.7) score += 50
  const u = t.user?.content ?? ''
  const aRaw = t.assistant?.content ?? ''
  const aEff = t.assistant ? effectiveAssistantApiContent(t.assistant) : ''
  const combined = `${u}\n${aEff}`
  if (combined.includes('```')) score += 30
  if (aRaw.length > 500 || u.length > 500) score += 10
  if (t.user) score += 5
  return score
}

/**
 * @param {typeof CHAT_CONSTRAINTS} c
 */
function tokenBudget(c) {
  return c.maxContextTokenBudget ?? Math.ceil(c.maxContextChars / 4)
}

/**
 * @param {InternalRow | null} system
 * @param {{ user: InternalRow | null; assistant: InternalRow | null; index: number }[]} turns
 * @returns {{ role: string; content: string }[]}
 */
function flattenToOllama(system, turns) {
  /** @type {{ role: string; content: string }[]} */
  const out = []
  if (system) out.push({ role: 'system', content: system.content ?? '' })
  for (const t of turns) {
    if (t.user) out.push({ role: 'user', content: apiUserContent(t.user) })
    if (t.assistant) {
      out.push({
        role: 'assistant',
        content: effectiveAssistantApiContent(t.assistant),
      })
    }
  }
  return out
}

function countInlineCompression(turns) {
  let n = 0
  for (const t of turns) {
    if (!t.assistant) continue
    const raw = t.assistant.content ?? ''
    if (!t.assistant.contextContent && raw.length >= CHAT_CONSTRAINTS.assistantContextCompressMinChars)
      n++
  }
  return n
}

/**
 * @param {object} p
 * @param {InternalRow[]} p.internalMessages committed + system; no streaming assistant row for pending reply
 * @param {{ id?: string; content: string }} p.newUser
 * @param {typeof CHAT_CONSTRAINTS} [p.constraints]
 * @param {boolean} [p.historySummaryApplied] — unpinned history was replaced by one summary message before this run
 */
export function buildApiPayload({
  internalMessages,
  newUser,
  constraints = CHAT_CONSTRAINTS,
  historySummaryApplied = false,
}) {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const budget = tokenBudget(constraints)

  const system =
    internalMessages[0]?.role === 'system' ? internalMessages[0] : null
  const body = system ? internalMessages.slice(1) : [...internalMessages]
  const withNewUser = [
    ...body,
    { id: newUser.id, role: 'user', content: newUser.content, pinned: false },
  ]

  const pinnedIds = withNewUser.filter((m) => m.pinned).map((m) => m.id).filter(Boolean)

  const turns = groupIntoTurns(withNewUser)
  const compressionInlineCount = countInlineCompression(turns)

  let working = [...turns]
  const removedTurnIds = []
  let rounds = 0

  const estBefore = () => estimateTokensForMessages(flattenToOllama(system, working))

  let tokensBeforeEviction = estBefore()

  while (estBefore() > budget && working.length > 0) {
    const lastIdx = working.length - 1
    /** @type {number[]} */
    const candidateIdx = []
    for (let i = 0; i < working.length; i++) {
      const t = working[i]
      if (turnPinned(t)) continue
      if (i === lastIdx && t.user && !t.assistant) continue
      candidateIdx.push(i)
    }
    if (!candidateIdx.length) break

    candidateIdx.sort((ia, ib) => {
      const ta = working[ia]
      const tb = working[ib]
      const sa = scoreTurn(ta, ia, working.length)
      const sb = scoreTurn(tb, ib, working.length)
      if (sa !== sb) return sa - sb
      return ia - ib
    })

    const victimIdx = candidateIdx[0]
    removedTurnIds.push(turnId(working[victimIdx]))
    working.splice(victimIdx, 1)
    rounds++
    if (rounds > 200) break
  }

  const messages = flattenToOllama(system, working)
  const estAfter = estimateTokensForMessages(messages)
  const rawTurnCount = turns.length
  const clipped =
    working.length < turns.length ||
    tokensBeforeEviction > budget ||
    estAfter > budget

  /** @type {string[]} */
  const warnings = []
  if (estAfter > budget) {
    warnings.push(
      'Estimated tokens still exceed budget after eviction (pinned / huge single message). Raise maxContextTokenBudget or unpin.',
    )
  }

  const stages = {
    pin: {
      pinnedMessageIds: pinnedIds,
      pinnedCount: pinnedIds.length,
    },
    turns: {
      rawTurnCount,
      keptTurnCount: working.length,
    },
    compression: {
      assistantsEligibleInline: compressionInlineCount,
      note: 'Stored contextContent preferred; else inline heuristic over assistantContextCompressMinChars',
    },
    tokens: {
      budget,
      estimatedBeforeEviction: tokensBeforeEviction,
      estimatedAfter: estAfter,
    },
    eviction: rounds
      ? { removedTurnIds, rounds }
      : { skipped: true, reason: 'under budget' },
    summary: historySummaryApplied
      ? {
          status: 'applied',
          note: 'Unpinned history folded into one user message; pinned verbatim (contextContent cleared)',
        }
      : {
          status: 'skipped',
          reason: 'Phase 3 auto rolling summary not implemented',
        },
    warnings,
  }

  const report = {
    runId,
    ts: Date.now(),
    stages,
    final: {
      ollamaMessageCount: messages.length,
      clipped,
      rawTurnCount,
      keptTurnCount: working.length,
    },
  }

  logPipelineRun({
    ...report,
    /* shallow copy for log viewers without huge bodies */
    messagesByteEstimate: JSON.stringify(messages).length,
  })

  return {
    messages,
    clipped,
    meta: {
      runId,
      estTokensAfter: estAfter,
      estTokensBefore: tokensBeforeEviction,
      budget,
      removedTurnIds,
      report,
    },
  }
}
