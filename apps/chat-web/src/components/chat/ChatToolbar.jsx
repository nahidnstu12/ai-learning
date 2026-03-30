import { CHAT_CONSTRAINTS } from '../../lib/chatConstraints'

/**
 * @param {object} p
 * @param {string} p.model
 * @param {{ messageCount: number; userTurns: number; charCount: number }} p.contextStats
 * @param {boolean} p.lastRequestContextClipped
 * @param {() => void} p.onOpenContext
 * @param {() => void} p.onClearHistory
 * @param {boolean} p.busy
 */
export default function ChatToolbar({
  model,
  contextStats,
  lastRequestContextClipped,
  onOpenContext,
  onClearHistory,
  busy,
}) {
  return (
    <header className="chat__toolbar">
      <div className="chat__meta">
        <strong>Model</strong> <code>{model}</code>
        <span className="chat__meta-sep">·</span>
        <strong>Context</strong> {contextStats.messageCount} msgs to API
        <span className="chat__meta-sep">·</span>
        {contextStats.userTurns} user turn(s)
        <span className="chat__meta-sep">·</span>
        ~{contextStats.charCount.toLocaleString()} chars
        <span className="chat__meta-sep">·</span>
        cap {CHAT_CONSTRAINTS.maxContextChars.toLocaleString()} ctx /{' '}
        {CHAT_CONSTRAINTS.maxUserMessageChars.toLocaleString()} msg /{' '}
        {CHAT_CONSTRAINTS.maxReplyTokens} tok out
        {lastRequestContextClipped ? (
          <span className="chat__meta-warn"> · last send trimmed</span>
        ) : null}
      </div>
      <div className="chat__toolbar-actions">
        <button
          type="button"
          className="chat__btn chat__btn--ghost"
          onClick={onOpenContext}
        >
          API context
        </button>
        <button
          type="button"
          className="chat__btn chat__btn--ghost"
          onClick={onClearHistory}
          disabled={busy}
        >
          Clear history
        </button>
      </div>
    </header>
  )
}
