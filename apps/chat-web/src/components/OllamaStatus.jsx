import { useEffect, useState } from 'react'
import { checkOllamaHealth } from '../lib/ollamaClient'

const modelEnv = import.meta.env.VITE_MODEL_CHAT ?? ''

export default function OllamaStatus() {
  const [state, setState] = useState({ phase: 'loading' })

  useEffect(() => {
    const ac = new AbortController()
    void (async () => {
      const base = import.meta.env.VITE_OLLAMA_URL ?? '(not set)'
      if (import.meta.env.DEV) {
        console.info('[ollama] VITE_OLLAMA_URL =', base, '| VITE_MODEL_CHAT =', modelEnv || '(none)')
      }
      const result = await checkOllamaHealth({ signal: ac.signal })
      if (result.cancelled) return
      if (result.ok) {
        const hasModel =
          !modelEnv ||
          result.models.some((n) => n === modelEnv || n.startsWith(`${modelEnv}:`))
        setState({
          phase: 'ok',
          models: result.models,
          hasModel,
        })
        if (import.meta.env.DEV) {
          console.info('[ollama] health OK, models:', result.models.length, result.models)
        }
      } else {
        setState({ phase: 'err', error: result.error })
      }
    })()
    return () => ac.abort()
  }, [])

  if (state.phase === 'loading') {
    return (
      <aside className="ollama-status ollama-status--loading" role="status">
        Ollama: checking…
      </aside>
    )
  }

  if (state.phase === 'err') {
    return (
      <aside className="ollama-status ollama-status--err" role="alert">
        Ollama: <strong>unreachable</strong> — {state.error}. Is the server up? Check{' '}
        <code>VITE_OLLAMA_URL</code> / Vite proxy.
      </aside>
    )
  }

  const warn =
    modelEnv && !state.hasModel
      ? `Model "${modelEnv}" not in list — run: ollama pull ${modelEnv}`
      : null

  return (
    <aside className={`ollama-status ollama-status--ok`} role="status">
      Ollama: <strong>OK</strong> — {state.models.length} model(s) loaded
      {modelEnv ? (
        <>
          {' '}
          · configured: <code>{modelEnv}</code>
          {state.hasModel ? ' ✓' : ' ✗'}
        </>
      ) : null}
      {warn ? (
        <span className="ollama-status__warn"> — {warn}</span>
      ) : null}
    </aside>
  )
}
