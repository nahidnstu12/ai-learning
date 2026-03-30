import ChatComposer from './ChatComposer'
import ChatContextModal from './ChatContextModal'
import ChatToolbar from './ChatToolbar'
import ChatTranscript from './ChatTranscript'
import { useChatSession } from './useChatSession'

/** Shell: layout + wires session hook to presentational pieces. */
export default function Chat() {
  const {
    model,
    apiMessages,
    contextStats,
    visibleMessages,
    input,
    setInput,
    busy,
    error,
    historyOpen,
    setHistoryOpen,
    lastSentPayload,
    lastRequestContextClipped,
    send,
    stop,
    clearHistory,
    copyJson,
    onComposerKeyDown,
  } = useChatSession()

  return (
    <div className="chat">
      <ChatToolbar
        model={model}
        contextStats={contextStats}
        lastRequestContextClipped={lastRequestContextClipped}
        onOpenContext={() => setHistoryOpen(true)}
        onClearHistory={clearHistory}
        busy={busy}
      />

      <ChatContextModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        lastSentPayload={lastSentPayload}
        apiMessages={apiMessages}
        lastRequestContextClipped={lastRequestContextClipped}
        onCopyJson={copyJson}
      />

      <ChatTranscript visibleMessages={visibleMessages} />

      {error ? (
        <div className="chat__error" role="alert">
          {error}
        </div>
      ) : null}

      <ChatComposer
        input={input}
        onInputChange={setInput}
        busy={busy}
        onSend={send}
        onStop={stop}
        onKeyDown={onComposerKeyDown}
      />
    </div>
  )
}
