import { useCallback, useEffect, useRef } from 'react'
import { formatNs } from './utils'

const PIN_THRESHOLD_PX = 72

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true
  )
}

/** @param {{ visibleMessages: { id: string; role: string; content: string; streaming?: boolean; pinned?: boolean; meta?: Record<string, unknown> }[]; busy?: boolean; onTogglePin?: (id: string) => void }} p */
export default function ChatTranscript({
  visibleMessages,
  busy = false,
  onTogglePin,
}) {
  const containerRef = useRef(null)
  /** When true, new content keeps the view pinned to the bottom. */
  const isPinnedRef = useRef(true)
  const streamScrollRafRef = useRef(0)

  const onScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isPinnedRef.current = fromBottom <= PIN_THRESHOLD_PX
  }, [])

  useEffect(() => {
    if (busy) isPinnedRef.current = true
  }, [busy])

  useEffect(() => {
    const el = containerRef.current
    if (!el || !isPinnedRef.current) return

    const reduced = prefersReducedMotion()
    const behavior = reduced ? 'auto' : 'smooth'
    const streaming = visibleMessages.some((m) => m.streaming)

    const run = y => {
      if (!containerRef.current || !isPinnedRef.current) return
      containerRef.current.scrollTo({ top: y, behavior })
    }

    if (reduced || !streaming) {
      run(el.scrollHeight)
      return undefined
    }

    if (streamScrollRafRef.current) {
      cancelAnimationFrame(streamScrollRafRef.current)
    }
    streamScrollRafRef.current = requestAnimationFrame(() => {
      streamScrollRafRef.current = 0
      const e = containerRef.current
      if (!e || !isPinnedRef.current) return
      run(e.scrollHeight)
    })

    return () => {
      if (streamScrollRafRef.current) {
        cancelAnimationFrame(streamScrollRafRef.current)
        streamScrollRafRef.current = 0
      }
    }
  }, [visibleMessages])

  return (
    <div
      ref={containerRef}
      className="chat__transcript"
      aria-live="polite"
      onScroll={onScroll}
    >
      {visibleMessages.length === 0 ? (
        <p className="chat__empty">Say something below.</p>
      ) : (
        visibleMessages.map((m) => (
          <div
            key={m.id}
            className={`chat__row chat__row--${m.role}${m.streaming ? ' chat__row--streaming' : ''}${m.pinned ? ' chat__row--pinned' : ''}`}
          >
            <div className="chat__bubble">
              <div className="chat__role-row">
                <div className="chat__role">
                  {m.role === 'user' ? 'You' : 'Assistant'}
                  {m.pinned ? (
                    <span className="chat__pin-badge" title="Pinned for API context">
                      pinned
                    </span>
                  ) : null}
                </div>
                {!m.streaming && typeof onTogglePin === 'function' ? (
                  <button
                    type="button"
                    className="chat__pin-btn"
                    onClick={() => onTogglePin(m.id)}
                    aria-pressed={!!m.pinned}
                    aria-label={m.pinned ? 'Unpin message' : 'Pin message for context'}
                    title={m.pinned ? 'Unpin' : 'Pin (kept when context is trimmed)'}
                  >
                    {m.pinned ? 'Unpin' : 'Pin'}
                  </button>
                ) : null}
              </div>
              <div className="chat__text">{m.content || (m.streaming ? '…' : '')}</div>
              {m.role === 'assistant' && !m.streaming && m.meta && (
                <dl className="chat__stats">
                  <div>
                    <dt>Provider</dt>
                    <dd>
                      {m.meta.provider === 'groq'
                        ? 'Groq'
                        : m.meta.provider === 'localllm'
                          ? 'Local (Ollama)'
                          : m.meta.provider}
                    </dd>
                  </div>
                  <div>
                    <dt>Wall time</dt>
                    <dd>{m.meta.wallMs ?? '—'} ms</dd>
                  </div>
                  <div>
                    <dt>Prompt tokens</dt>
                    <dd>
                      {m.meta.promptTokens ?? m.meta.promptEvalCount ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Completion tokens</dt>
                    <dd>
                      {m.meta.completionTokens ?? m.meta.evalCount ?? '—'}
                    </dd>
                  </div>
                  {m.meta.serverTiming?.totalDurationNs != null ? (
                    <div>
                      <dt>Ollama compute (total)</dt>
                      <dd>{formatNs(m.meta.serverTiming.totalDurationNs)}</dd>
                    </div>
                  ) : null}
                </dl>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
