import { CHAT_CONSTRAINTS } from '../../lib/chatConstraints'

/**
 * @param {object} p
 * @param {string} p.model
 * @param {string[]} [p.modelOptions]
 * @param {(id: string) => void} [p.onModelChange]
 * @param {{ messageCount: number; userTurns: number; charCount: number }} p.contextStats
 * @param {boolean} p.lastRequestContextClipped
 * @param {() => void} p.onOpenContext
 * @param {() => void} p.onClearHistory
 * @param {boolean} p.busy
 */
export default function ChatToolbar({
  model,
  modelOptions = [],
  onModelChange,
  contextStats,
  lastRequestContextClipped,
  onOpenContext,
  onClearHistory,
  busy,
}) {
  const multi = modelOptions.length > 1 && typeof onModelChange === 'function'
  return (
    <header className="chat__toolbar">
      <div className="chat__meta">
        <strong>Model</strong>{' '}
        {multi ? (
          <select
            className="chat__model-select"
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            disabled={busy}
            aria-label="Chat model"
          >
            {modelOptions.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        ) : (
          <code>{model}</code>
        )}
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
