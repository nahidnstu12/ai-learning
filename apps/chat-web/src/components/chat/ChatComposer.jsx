import { CHAT_CONSTRAINTS } from '../../lib/chatConstraints'

/**
 * @param {object} p
 * @param {string} p.input
 * @param {(s: string) => void} p.onInputChange
 * @param {boolean} p.busy
 * @param {() => void} p.onSend
 * @param {() => void} p.onStop
 * @param {(e: import('react').KeyboardEvent<HTMLTextAreaElement>) => void} p.onKeyDown
 */
export default function ChatComposer({
  input,
  onInputChange,
  busy,
  onSend,
  onStop,
  onKeyDown,
}) {
  return (
    <div className="chat__composer">
      <textarea
        className="chat__input"
        rows={2}
        maxLength={CHAT_CONSTRAINTS.maxUserMessageChars}
        placeholder="Message… (Enter to send, Shift+Enter newline)"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={busy}
      />
      <div className="chat__composer-meta">
        {input.length.toLocaleString()} / {CHAT_CONSTRAINTS.maxUserMessageChars.toLocaleString()}{' '}
        characters
      </div>
      <div className="chat__actions">
        {busy ? (
          <button type="button" className="chat__btn" onClick={onStop}>
            Stop
          </button>
        ) : (
          <button
            type="button"
            className="chat__btn chat__btn--primary"
            onClick={() => void onSend()}
            disabled={!input.trim()}
          >
            Send
          </button>
        )}
      </div>
    </div>
  )
}
