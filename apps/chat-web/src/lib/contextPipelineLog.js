/** In-memory ring buffer + hooks for monitoring the context build pipeline (separate from chat UI state). */

const MAX_ENTRIES = 100
/** @type {object[]} */
const entries = []
/** @type {Set<(e: object) => void>} */
const listeners = new Set()

/**
 * @param {object} entry full run record (ts, runId, stages, final, messages)
 */
export function logPipelineRun(entry) {
  entries.push(entry)
  if (entries.length > MAX_ENTRIES) entries.shift()
  for (const fn of listeners) {
    try {
      fn(entry)
    } catch {
      /* ignore subscriber errors */
    }
  }
}

/** @returns {object[]} newest last */
export function getPipelineLog() {
  return [...entries]
}

export function clearPipelineLog() {
  entries.length = 0
}

/** @param {(e: object) => void} fn */
export function subscribePipelineLog(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__CHAT_CONTEXT_PIPELINE__ = {
    getLog: getPipelineLog,
    clear: clearPipelineLog,
    subscribe: subscribePipelineLog,
  }
}
