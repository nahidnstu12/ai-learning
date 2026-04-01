import { CHAT_CONSTRAINTS } from '../../lib/chatConstraints'
import { getPipelineLog } from '../../lib/contextPipelineLog'

/**
 * @param {object} p
 * @param {boolean} p.open
 * @param {() => void} p.onClose
 * @param {{ role: string; content: string }[] | null} p.lastSentPayload
 * @param {{ role: string; content: string; pinned?: boolean }[]} p.apiMessages
 * @param {boolean} p.lastRequestContextClipped
 * @param {object | null} [p.lastPipelineReport]
 * @param {(data: unknown) => void} p.onCopyJson
 */
export default function ChatContextModal({
  open,
  onClose,
  lastSentPayload,
  apiMessages,
  lastRequestContextClipped,
  lastPipelineReport = null,
  onCopyJson,
}) {
  const logSnapshot = open ? getPipelineLog() : []

  if (!open) return null

  return (
    <div
      className="chat__modal-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="chat__modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-context-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="chat__modal-head">
          <h2 id="chat-context-title" className="chat__modal-title">
            Ollama context
          </h2>
          <button
            type="button"
            className="chat__btn chat__btn--ghost"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <p className="chat__modal-hint">
          <strong>Last request</strong> is the exact JSON sent on the most recent generate.
          <strong> Current context</strong> is all committed messages (no in-flight stream);
          the next send appends your new user message to that list.
        </p>
        <p className="chat__modal-hint chat__modal-hint--constraints">
          <strong>Constraints</strong> (see <code>src/lib/chatConstraints.js</code>): ~{' '}
          {CHAT_CONSTRAINTS.maxContextTokenBudget.toLocaleString()} est. tokens budget (pipeline); max{' '}
          {CHAT_CONSTRAINTS.maxUserMessageChars.toLocaleString()} chars per user message; max{' '}
          {CHAT_CONSTRAINTS.maxReplyTokens} output tokens. Context is built via{' '}
          <code>buildApiPayload</code> (turns, pins, compression, scored eviction). Dev:{' '}
          <code>window.__CHAT_CONTEXT_PIPELINE__</code>.
        </p>
        {lastRequestContextClipped ? (
          <p className="chat__modal-warn" role="status">
            Last request omitted older messages so total context stayed under the cap. Full
            transcript remains in the UI.
          </p>
        ) : null}

        <section className="chat__modal-section">
          <div className="chat__modal-section-head">
            <h3>Last request</h3>
            <button
              type="button"
              className="chat__btn chat__btn--ghost chat__btn--tiny"
              onClick={() => lastSentPayload && onCopyJson(lastSentPayload)}
              disabled={!lastSentPayload}
            >
              Copy JSON
            </button>
          </div>
          {lastSentPayload ? (
            <pre className="chat__modal-pre">
              {JSON.stringify(lastSentPayload, null, 2)}
            </pre>
          ) : (
            <p className="chat__modal-empty">No request yet this session.</p>
          )}
        </section>

        <section className="chat__modal-section">
          <div className="chat__modal-section-head">
            <h3>Current context ({apiMessages.length} msgs)</h3>
            <button
              type="button"
              className="chat__btn chat__btn--ghost chat__btn--tiny"
              onClick={() => onCopyJson(apiMessages)}
            >
              Copy JSON
            </button>
          </div>
          <ul className="chat__modal-list">
            {apiMessages.map((m, i) => (
              <li key={i} className="chat__modal-msg">
                <span className={`chat__modal-role chat__modal-role--${m.role}`}>
                  {m.role}
                  {m.pinned ? (
                    <span className="chat__modal-pin"> · pinned</span>
                  ) : null}
                </span>
                <div className="chat__modal-msg-body">{m.content}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="chat__modal-section">
          <div className="chat__modal-section-head">
            <h3>Pipeline: last run</h3>
            <button
              type="button"
              className="chat__btn chat__btn--ghost chat__btn--tiny"
              onClick={() => lastPipelineReport && onCopyJson(lastPipelineReport)}
              disabled={!lastPipelineReport}
            >
              Copy JSON
            </button>
          </div>
          {lastPipelineReport ? (
            <pre className="chat__modal-pre chat__modal-pre--compact">
              {JSON.stringify(lastPipelineReport, null, 2)}
            </pre>
          ) : (
            <p className="chat__modal-empty">No pipeline run yet.</p>
          )}
        </section>

        <section className="chat__modal-section chat__modal-section--pipeline-log">
          <div className="chat__modal-section-head">
            <h3>Pipeline log ({logSnapshot.length})</h3>
            <button
              type="button"
              className="chat__btn chat__btn--ghost chat__btn--tiny"
              onClick={() => onCopyJson(logSnapshot)}
              disabled={!logSnapshot.length}
            >
              Copy all
            </button>
          </div>
          <p className="chat__modal-hint chat__modal-hint--constraints">
            Ring buffer (last {logSnapshot.length} runs). Cleared with Clear history.
          </p>
          {logSnapshot.length ? (
            <ul className="chat__modal-list chat__modal-list--log">
              {logSnapshot.map((entry) => (
                <li key={entry.runId} className="chat__modal-msg chat__modal-log-item">
                  <span className="chat__modal-role">
                    {new Date(entry.ts).toLocaleTimeString()} · {entry.runId}
                  </span>
                  <div className="chat__modal-msg-body chat__modal-log-body">
                    clipped: {String(!!entry.final?.clipped)} · msgs:{' '}
                    {entry.final?.ollamaMessageCount ?? '—'} · turns kept:{' '}
                    {entry.final?.keptTurnCount ?? '—'} / {entry.final?.rawTurnCount ?? '—'}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="chat__modal-empty">Empty.</p>
          )}
        </section>
      </div>
    </div>
  )
}
