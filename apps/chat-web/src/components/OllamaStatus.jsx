import { useEffect, useState } from 'react'
import { getConfiguredModelIds, ollamaHasModel } from '../lib/modelConfig'
import { checkOllamaHealth } from '../lib/ollamaClient'

const configuredModels = getConfiguredModelIds()

export default function OllamaStatus() {
  const [state, setState] = useState({ phase: 'loading' })

  useEffect(() => {
    const ac = new AbortController()
    void (async () => {
      const base = import.meta.env.VITE_OLLAMA_URL ?? '(not set)'
      if (import.meta.env.DEV) {
        console.info(
          '[ollama] VITE_OLLAMA_URL =',
          base,
          '| models:',
          configuredModels.join(', ') || '(none)',
        )
      }
      const result = await checkOllamaHealth({ signal: ac.signal })
      if (result.cancelled) return
      if (result.ok) {
        const missing = configuredModels.filter(
          (id) => !ollamaHasModel(result.models, id),
        )
        setState({
          phase: 'ok',
          models: result.models,
          missingModels: missing,
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
    state.missingModels?.length > 0
      ? `Missing: ${state.missingModels.map((m) => `"${m}"`).join(', ')} — ollama pull ${state.missingModels[0]}`
      : null

  return (
    <aside className={`ollama-status ollama-status--ok`} role="status">
      Ollama: <strong>OK</strong> — {state.models.length} model(s) loaded
      {configuredModels.length ? (
        <>
          {' '}
          · chat models:{' '}
          <code>{configuredModels.join(', ')}</code>
          {state.missingModels?.length ? ' ✗' : ' ✓'}
        </>
      ) : null}
      {warn ? (
        <span className="ollama-status__warn"> — {warn}</span>
      ) : null}
    </aside>
  )
}
