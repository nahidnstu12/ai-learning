import { CHAT_CONSTRAINTS } from '../../lib/chatConstraints'

/**
 * @param {object} p
 * @param {boolean} p.open
 * @param {() => void} p.onClose
 * @param {{ role: string; content: string }[] | null} p.lastSentPayload
 * @param {{ role: string; content: string }[]} p.apiMessages
 * @param {boolean} p.lastRequestContextClipped
 * @param {(data: unknown) => void} p.onCopyJson
 */
export default function ChatContextModal({
  open,
  onClose,
  lastSentPayload,
  apiMessages,
  lastRequestContextClipped,
  onCopyJson,
}) {
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
          <strong>Constraints</strong> (see <code>src/lib/chatConstraints.js</code>): max{' '}
          {CHAT_CONSTRAINTS.maxContextChars.toLocaleString()} chars in the payload to Ollama
          (oldest turns dropped after system); max {CHAT_CONSTRAINTS.maxUserMessageChars.toLocaleString()}{' '}
          chars per user message; max {CHAT_CONSTRAINTS.maxReplyTokens} output tokens; sampling
          clamped in <code>ollamaClient.js</code>.
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
                </span>
                <div className="chat__modal-msg-body">{m.content}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
