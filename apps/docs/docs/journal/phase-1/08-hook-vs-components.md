---
sidebar_position: 8
title: Hook বনাম components
---

# Hook বনাম components

`apps/chat-web` chat UI **একটা session hook** + **ছোট presentational components**। Logic `useChatSession.js`; layout `Chat.jsx` ও children। কেন: test/readability, UI যা দেখায় সেটা state-এর mirror নয়।

## ১. Responsibility split

| Layer | ফাইল | দায়িত্ব |
|-------|------|----------|
| Session | `useChatSession.js` | `messages`, send/stop, pack, stream, pin, route, debug snapshots |
| Shell | `Chat.jsx` | Wire hook → children; no fetch |
| Toolbar | `ChatToolbar.jsx` | Route select, stats, open modal, clear |
| Transcript | `ChatTranscript.jsx` | Render bubbles, pin button |
| Composer | `ChatComposer.jsx` | Input, Send/Stop, `maxLength` |
| Modal | `ChatContextModal.jsx` | `lastSentPayload`, pipeline report, log snapshot |
| Lib | `src/lib/*` | Pure: `buildApiPayload`, `streamCompletion`, clients |

## ২. Hook exports (চিত্র)

```
useChatSession()
  → routeOptions, selectedRouteId, setRouteId
  → visibleMessages, apiMessages, contextStats
  → input, setInput, busy, error
  → send, stop, togglePin, clearHistory
  → lastSentPayload, lastPipelineReport, lastRequestContextClipped
  → historyOpen, setHistoryOpen, copyJson, onComposerKeyDown
```

`Chat.jsx` শুধু destructure + JSX — নতুন feature যোগ করতে গেলে প্রথমে hook/lib, তারপর UI props।

## ৩. কেন monolithic `Chat.jsx` নয়

- **Pack/stream** ~200 lines — UI markup-এ মিশলে regression সহজ  
- **Pure functions** (`buildApiPayload`) — browser ছাড়াও reason করা যায়  
- **Modal** heavy JSON — transcript re-render থেকে আলাদা  

`components/Chat.jsx` (root) vs `components/chat/Chat.jsx` — app import করে `chat/Chat.jsx` (shell)।

## ৪. Extend করার pattern

নতুন capability (e.g. tool calls):

1. `src/lib/` — wire/parser  
2. `useChatSession` — state + send pipeline step  
3. একটা child component — display only  

UI-তে feature দেখালে hook-এ handler থাকতে হবে; শুধু JSX-এ `fetch` রাখবে না।

> [!TIP]
> Bug “button কাজ করে না” → component props; bug “ভুল context গেছে” → hook + `buildApiPayload` + `lastSentPayload` — layer ঠিক ধরে debug করো।

**Boundary:** Phase 1 শেষ — পরের ধাপ embeddings/RAG (Phase 2 scope)। Multi-provider Groq details `llmRegistry.js` / `groqClient.js` এ; আলাদা journal phase-এ নেওয়া যায়।
