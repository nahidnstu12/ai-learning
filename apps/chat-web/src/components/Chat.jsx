import { useCallback, useMemo, useRef, useState } from 'react'
import { streamChat } from '../lib/ollamaClient'

const SYSTEM_PROMPT =
  import.meta.env.VITE_CHAT_SYSTEM_PROMPT ??
  'You are a helpful, concise assistant.'

function uid() {
  return crypto.randomUUID()
}

function formatNs(ns) {
  if (ns == null || Number.isNaN(ns)) return '—'
  return `${(ns / 1e6).toFixed(0)} ms`
}

export default function Chat() {
  const [messages, setMessages] = useState(() => [
    { id: uid(), role: 'system', content: SYSTEM_PROMPT },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const model = import.meta.env.VITE_MODEL_CHAT ?? 'phi3'

  const apiMessages = useMemo(
    () =>
      messages
        .filter((m) => !m.streaming)
        .map(({ role, content }) => ({ role, content })),
    [messages],
  )

  const contextStats = useMemo(() => {
    const api = apiMessages
    const chars = api.reduce((n, m) => n + (m.content?.length ?? 0), 0)
    const userTurns = api.filter((m) => m.role === 'user').length
    return {
      messageCount: api.length,
      userTurns,
      charCount: chars,
    }
  }, [apiMessages])

  const visibleMessages = useMemo(
    () => messages.filter((m) => m.role !== 'system'),
    [messages],
  )

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || busy) return

    setError(null)
    setInput('')
    const userId = uid()
    const asstId = uid()

    setMessages((prev) => [
      ...prev,
      { id: userId, role: 'user', content: text },
      { id: asstId, role: 'assistant', content: '', streaming: true },
    ])
    setBusy(true)

    const ac = new AbortController()
    abortRef.current = ac

    const payload = [
      ...messages
        .filter((m) => !m.streaming)
        .map(({ role, content }) => ({ role, content })),
      { role: 'user', content: text },
    ]

    let acc = ''
    try {
      const { fullText, metrics } = await streamChat({
        messages: payload,
        signal: ac.signal,
        onChunk: (chunk) => {
          acc += chunk
          setMessages((prev) =>
            prev.map((m) =>
              m.id === asstId ? { ...m, content: acc } : m,
            ),
          )
        },
      })

      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstId
            ? {
                ...m,
                content: fullText,
                streaming: false,
                meta: {
                  wallMs: metrics.wallMs,
                  promptEvalCount: metrics.promptEvalCount,
                  evalCount: metrics.evalCount,
                  totalDurationNs: metrics.totalDurationNs,
                  promptEvalDurationNs: metrics.promptEvalDurationNs,
                  evalDurationNs: metrics.evalDurationNs,
                },
              }
            : m,
        ),
      )
    } catch (e) {
      if (e?.name === 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstId
              ? {
                  ...m,
                  content: acc || '(stopped)',
                  streaming: false,
                }
              : m,
          ),
        )
      } else {
        setError(e?.message ?? String(e))
        setMessages((prev) => prev.filter((m) => m.id !== asstId))
      }
    } finally {
      abortRef.current = null
      setBusy(false)
    }
  }, [busy, input, messages])

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clearHistory = useCallback(() => {
    if (busy) abortRef.current?.abort()
    setMessages([{ id: uid(), role: 'system', content: SYSTEM_PROMPT }])
    setError(null)
  }, [busy])

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="chat">
      <header className="chat__toolbar">
        <div className="chat__meta">
          <strong>Model</strong> <code>{model}</code>
          <span className="chat__meta-sep">·</span>
          <strong>Context</strong> {contextStats.messageCount} msgs to API
          <span className="chat__meta-sep">·</span>
          {contextStats.userTurns} user turn(s)
          <span className="chat__meta-sep">·</span>
          ~{contextStats.charCount.toLocaleString()} chars
        </div>
        <button
          type="button"
          className="chat__btn chat__btn--ghost"
          onClick={clearHistory}
          disabled={busy}
        >
          Clear history
        </button>
      </header>

      <div className="chat__transcript" aria-live="polite">
        {visibleMessages.length === 0 ? (
          <p className="chat__empty">Say something below.</p>
        ) : (
          visibleMessages.map((m) => (
            <div
              key={m.id}
              className={`chat__row chat__row--${m.role}${m.streaming ? ' chat__row--streaming' : ''}`}
            >
              <div className="chat__bubble">
                <div className="chat__role">
                  {m.role === 'user' ? 'You' : 'Assistant'}
                </div>
                <div className="chat__text">{m.content || (m.streaming ? '…' : '')}</div>
                {m.role === 'assistant' && !m.streaming && m.meta && (
                  <dl className="chat__stats">
                    <div>
                      <dt>Wall time</dt>
                      <dd>{m.meta.wallMs ?? '—'} ms</dd>
                    </div>
                    <div>
                      <dt>Prompt tokens</dt>
                      <dd>{m.meta.promptEvalCount ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Gen tokens</dt>
                      <dd>{m.meta.evalCount ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Ollama total</dt>
                      <dd>{formatNs(m.meta.totalDurationNs)}</dd>
                    </div>
                  </dl>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {error ? (
        <div className="chat__error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="chat__composer">
        <textarea
          className="chat__input"
          rows={2}
          placeholder="Message… (Enter to send, Shift+Enter newline)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
        />
        <div className="chat__actions">
          {busy ? (
            <button type="button" className="chat__btn" onClick={stop}>
              Stop
            </button>
          ) : (
            <button
              type="button"
              className="chat__btn chat__btn--primary"
              onClick={() => void send()}
              disabled={!input.trim()}
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
