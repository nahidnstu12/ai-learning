import { CHAT_CONSTRAINTS } from '../../lib/chatConstraints'

/**
 * @param {object} p
 * @param {{ id: string; label: string }[]} [p.routeOptions]
 * @param {string} p.selectedRouteId
 * @param {(id: string) => void} [p.onRouteChange]
 * @param {{ messageCount: number; userTurns: number; charCount: number }} p.contextStats
 * @param {boolean} p.lastRequestContextClipped
 * @param {() => void} p.onOpenContext
 * @param {() => void} p.onClearHistory
 * @param {boolean} p.busy
 */
export default function ChatToolbar({
  routeOptions = [],
  selectedRouteId,
  onRouteChange,
  contextStats,
  lastRequestContextClipped,
  onOpenContext,
  onClearHistory,
  busy,
}) {
  const selected = routeOptions.find((r) => r.id === selectedRouteId)
  const multi =
    routeOptions.length > 1 && typeof onRouteChange === 'function'
  return (
    <header className="chat__toolbar">
      <div className="chat__meta">
        <strong>Route</strong>{' '}
        {multi ? (
          <select
            className="chat__model-select"
            value={selectedRouteId}
            onChange={(e) => onRouteChange(e.target.value)}
            disabled={busy}
            aria-label="LLM route"
          >
            {routeOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        ) : (
          <code>{selected?.label ?? selectedRouteId}</code>
        )}
        <span className="chat__meta-sep">·</span>
        <strong>Context</strong> {contextStats.messageCount} msgs to API
        <span className="chat__meta-sep">·</span>
        {contextStats.userTurns} user turn(s)
        <span className="chat__meta-sep">·</span>
        ~{contextStats.charCount.toLocaleString()} chars
        <span className="chat__meta-sep">·</span>
        cap ~{CHAT_CONSTRAINTS.maxContextTokenBudget.toLocaleString()} tok ctx /{' '}
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
