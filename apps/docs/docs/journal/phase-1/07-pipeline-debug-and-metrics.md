---
sidebar_position: 7
title: Pipeline debug ও metrics
---

# Pipeline debug ও metrics

Guess ছাড়া chat debug = **শেষ request-এ ঠিক কী গেছে** দেখা। Repo: `lastSentPayload`, `lastPipelineReport`, `ChatContextModal`, `contextPipelineLog.js`, assistant `meta`.

## ১. lastSentPayload

`useChatSession` — pack-এর পর, stream-এর আগে:

```js
setLastSentPayload(payload)  // { role, content }[]
setLastRequestContextClipped(clipped)
setLastPipelineReport(pipelineMeta.report)
```

Modal **Last request** = Ollama/Groq-এ যাওয়া exact JSON। UI scroll ≠ এটা।

## ২. Pipeline report

`buildApiPayload` → `meta.report`:

```json
{
  "runId": "...",
  "stages": {
    "pin": { "pinnedCount", "pinnedMessageIds" },
    "turns": { "rawTurnCount", "keptTurnCount" },
    "compression": { "assistantsEligibleInline" },
    "tokens": { "budget", "estimatedBeforeEviction", "estimatedAfter" },
    "eviction": { "removedTurnIds", "rounds" },
    "summary": { "status", "note" }
  },
  "final": { "clipped", "ollamaMessageCount" }
}
```

Toolbar: `lastRequestContextClipped` হলে clipped indicator।

## ৩. In-memory log (dev)

`logPipelineRun` — ring buffer (max 100 entries). Dev console:

```js
window.__CHAT_CONTEXT_PIPELINE__.getLog()
window.__CHAT_CONTEXT_PIPELINE__.clear()
```

UI state থেকে আলাদা — monitoring / copy without re-send।

## ৪. Completion metrics

Stream শেষে assistant bubble-এ `meta` (`completionMeta.js`):

- `wallMs` — client wall clock  
- `promptTokens`, `completionTokens` — provider counts  
- Ollama: `serverTiming.*Ns` optional  

Network error vs user abort vs API 4xx — আলাদা UI path (*Streaming and stop*).

> [!TIP]
> Weird answer → modal খোলো → Last request-এ system + শেষ user আছে কিনা, eviction-এ গুরুত্বপূর্ণ turn `removedTurnIds`-এ কিনা — একই স্ক্রিনে তিনটা জবাব মেলাও।

**Boundary:** React component split — *Hook vs components*। Production logging/export — implement করা নেই।
