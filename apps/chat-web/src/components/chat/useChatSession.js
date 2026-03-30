import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CHAT_CONSTRAINTS,
  clipMessagesForApi,
  totalContentChars,
} from '../../lib/chatConstraints'
import { streamChat } from '../../lib/ollamaClient'
import { SYSTEM_PROMPT } from './systemPrompt'
import { uid } from './utils'

export function useChatSession() {
  const [messages, setMessages] = useState(() => [
    { id: uid(), role: 'system', content: SYSTEM_PROMPT },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [lastSentPayload, setLastSentPayload] = useState(null)
  const [lastRequestContextClipped, setLastRequestContextClipped] =
    useState(false)
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

    if (text.length > CHAT_CONSTRAINTS.maxUserMessageChars) {
      setError(
        `Message exceeds ${CHAT_CONSTRAINTS.maxUserMessageChars.toLocaleString()} characters (limit from chatConstraints).`,
      )
      return
    }

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

    const rawPayload = [
      ...messages
        .filter((m) => !m.streaming)
        .map(({ role, content }) => ({ role, content })),
      { role: 'user', content: text },
    ]
    const rawChars = totalContentChars(rawPayload)
    const payload = clipMessagesForApi(
      rawPayload,
      CHAT_CONSTRAINTS.maxContextChars,
    )
    setLastSentPayload(payload)
    setLastRequestContextClipped(totalContentChars(payload) < rawChars)

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
    setLastSentPayload(null)
    setLastRequestContextClipped(false)
    setError(null)
  }, [busy])

  useEffect(() => {
    if (!historyOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') setHistoryOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [historyOpen])

  const copyJson = useCallback(async (data) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    } catch {
      /* ignore */
    }
  }, [])

  const onComposerKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void send()
      }
    },
    [send],
  )

  return {
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
  }
}
