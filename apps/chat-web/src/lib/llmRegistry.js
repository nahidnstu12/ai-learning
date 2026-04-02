import { getConfiguredModelIds } from './modelConfig'

/** @typedef {'localllm' | 'groq'} ChatProvider */
/** @typedef {{ id: string; label: string; provider: ChatProvider; model: string }} ChatRoute */

export const CHAT_ROUTE_STORAGE_KEY = 'ai-learning-chat:route'

/** @param {string} s */
function splitCsv(s) {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
}

/**
 * Groq model ids for route list. Set `VITE_DISABLE_GROQ=1` to hide all Groq routes.
 *
 * - If `VITE_GROQ_MODEL_OPTIONS` is non-empty → comma-separated list (like local `VITE_MODEL_CHAT_OPTIONS`).
 * - Else `VITE_GROQ_MODEL`: comma-separated or single id; `0` / `false` disables.
 * - Else default one model: `llama-3.3-70b-versatile`.
 *
 * @returns {string[]}
 */
export function getGroqModelIds() {
  if (import.meta.env.VITE_DISABLE_GROQ === '1') return []

  const optionsRaw = import.meta.env.VITE_GROQ_MODEL_OPTIONS?.trim()
  if (optionsRaw) {
    const list = splitCsv(optionsRaw)
    if (list.length) return list
  }

  const raw = import.meta.env.VITE_GROQ_MODEL?.trim()
  if (raw === '0' || raw === 'false') return []
  if (raw) return splitCsv(raw)

  return ['llama-3.3-70b-versatile']
}

/** First Groq model id, or `null` if Groq disabled / no ids — for status hints. */
export function getGroqModelId() {
  const ids = getGroqModelIds()
  return ids[0] ?? null
}

/** @returns {ChatRoute[]} */
export function getChatRoutes() {
  /** @type {ChatRoute[]} */
  const routes = []
  for (const model of getConfiguredModelIds()) {
    routes.push({
      id: `localllm:${model}`,
      label: `Local · ${model}`,
      provider: 'localllm',
      model,
    })
  }
  for (const model of getGroqModelIds()) {
    routes.push({
      id: `groq:${model}`,
      label: `Groq · ${model}`,
      provider: 'groq',
      model,
    })
  }
  return routes
}

/** True when requests use same-origin `/groq` (Vite injects `Authorization` on the dev server). */
export function groqUsesDevProxy() {
  const base = import.meta.env.VITE_GROQ_BASE_URL?.trim()
  return !base
}

/**
 * @param {ChatRoute[]} routes
 * @returns {string}
 */
export function readStoredRouteId(routes) {
  if (!routes.length) return ''
  if (typeof localStorage === 'undefined') return routes[0].id
  try {
    const saved = localStorage.getItem(CHAT_ROUTE_STORAGE_KEY)
    if (saved && routes.some((r) => r.id === saved)) return saved
  } catch {
    /* ignore */
  }
  return routes[0].id
}

/**
 * @param {ChatRoute[]} routes
 * @param {string} id
 * @returns {ChatRoute | undefined}
 */
export function findRoute(routes, id) {
  return routes.find((r) => r.id === id)
}
