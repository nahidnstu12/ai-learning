import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildApiPayload } from '../../lib/buildApiPayload'
import { CHAT_CONSTRAINTS } from '../../lib/chatConstraints'
import { maybeAssistantContextContentFields } from '../../lib/assistantContextCompress'
import { clearPipelineLog } from '../../lib/contextPipelineLog'
import {
  CHAT_MODEL_STORAGE_KEY,
  getConfiguredModelIds,
  readStoredModel,
} from '../../lib/modelConfig'
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
  const [lastPipelineReport, setLastPipelineReport] = useState(null)
  const abortRef = useRef(null)

  const modelOptions = useMemo(() => getConfiguredModelIds(), [])
  const [selectedModel, setSelectedModel] = useState(() =>
    readStoredModel(modelOptions),
  )

  useEffect(() => {
    if (modelOptions.includes(selectedModel)) return
    const next = modelOptions[0]
    setSelectedModel(next)
    try {
      localStorage.setItem(CHAT_MODEL_STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [modelOptions, selectedModel])

  const setModel = useCallback((id) => {
    if (!modelOptions.includes(id)) return
    setSelectedModel(id)
    try {
      localStorage.setItem(CHAT_MODEL_STORAGE_KEY, id)
    } catch {
      /* ignore */
    }
  }, [modelOptions])

  const apiMessages = useMemo(
    () =>
      messages
        .filter((m) => !m.streaming)
        .map(({ role, content, pinned }) => ({
          role,
          content,
          pinned: !!pinned,
        })),
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

    const internalMessages = messages
      .filter((m) => !m.streaming)
      .map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        pinned: !!m.pinned,
        contextContent: m.contextContent,
      }))

    const {
      messages: payload,
      clipped,
      meta: pipelineMeta,
    } = buildApiPayload({
      internalMessages,
      newUser: { id: userId, content: text },
      constraints: CHAT_CONSTRAINTS,
    })
    setLastSentPayload(payload)
    setLastRequestContextClipped(clipped)
    setLastPipelineReport(pipelineMeta.report)

    let acc = ''
    try {
      const { fullText, metrics } = await streamChat({
        messages: payload,
        signal: ac.signal,
        model: selectedModel,
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
                ...maybeAssistantContextContentFields(fullText),
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
        setLastPipelineReport(null)
      }
    } finally {
      abortRef.current = null
      setBusy(false)
    }
  }, [busy, input, messages, selectedModel])

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const togglePin = useCallback((id) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, pinned: !m.pinned } : m)),
    )
  }, [])

  const clearHistory = useCallback(() => {
    if (busy) abortRef.current?.abort()
    setMessages([{ id: uid(), role: 'system', content: SYSTEM_PROMPT }])
    setLastSentPayload(null)
    setLastRequestContextClipped(false)
    setLastPipelineReport(null)
    clearPipelineLog()
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
    model: selectedModel,
    modelOptions,
    setModel,
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
    lastPipelineReport,
    send,
    stop,
    clearHistory,
    togglePin,
    copyJson,
    onComposerKeyDown,
  }
}
