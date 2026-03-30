import { formatNs } from './utils'

/** @param {{ visibleMessages: { id: string; role: string; content: string; streaming?: boolean; meta?: Record<string, unknown> }[] }} p */
export default function ChatTranscript({ visibleMessages }) {
  return (
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
  )
}
