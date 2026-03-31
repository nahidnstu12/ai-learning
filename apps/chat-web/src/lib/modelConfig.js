/** @param {string} s */
function splitCsv(s) {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

export const CHAT_MODEL_STORAGE_KEY = 'ai-learning-chat:model'

/** Models shown in the UI (comma-separated env) or single `VITE_MODEL_CHAT` / phi3 */
export function getConfiguredModelIds() {
  const raw = import.meta.env.VITE_MODEL_CHAT_OPTIONS?.trim()
  const fallback = import.meta.env.VITE_MODEL_CHAT?.trim() || 'phi3'
  if (!raw) return [fallback]
  const list = splitCsv(raw)
  return list.length ? list : [fallback]
}

/**
 * @param {string[]} options
 * @returns {string}
 */
export function readStoredModel(options) {
  if (typeof localStorage === 'undefined') return options[0]
  try {
    const saved = localStorage.getItem(CHAT_MODEL_STORAGE_KEY)
    if (saved && options.includes(saved)) return saved
  } catch {
    /* ignore */
  }
  return options[0]
}

/**
 * @param {string[]} remoteNames from Ollama /api/tags (e.g. phi3:latest)
 * @param {string} id configured id (e.g. phi3)
 */
export function ollamaHasModel(remoteNames, id) {
  return remoteNames.some((n) => n === id || n.startsWith(`${id}:`))
}
