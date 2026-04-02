import { getConfiguredModelIds } from './modelConfig'

/** @typedef {'localllm' | 'groq'} ChatProvider */
/** @typedef {{ id: string; label: string; provider: ChatProvider; model: string }} ChatRoute */

export const CHAT_ROUTE_STORAGE_KEY = 'ai-learning-chat:route'

/** Groq chat model id; set `VITE_DISABLE_GROQ=1` to hide Groq in the UI. */
export function getGroqModelId() {
  if (import.meta.env.VITE_DISABLE_GROQ === '1') return null
  const raw = import.meta.env.VITE_GROQ_MODEL?.trim()
  if (raw === '0' || raw === 'false') return null
  return raw || 'llama-3.1-70b-versatile'
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
  const groqModel = getGroqModelId()
  if (groqModel) {
    routes.push({
      id: `groq:${groqModel}`,
      label: `Groq · ${groqModel}`,
      provider: 'groq',
      model: groqModel,
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
