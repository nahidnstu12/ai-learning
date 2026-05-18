---
sidebar_position: 3
title: Streaming ও Stop
---

# Streaming ও Stop

Ollama `stream: true` দিলে response **NDJSON** — প্রতি line একটা JSON event। UI-তে incremental text; user **Stop** দিলে `AbortController` fetch cancel। Repo: `ollamaClient.js` (`streamChat`), `useChatSession.js` (`send` / `stop`).

## ১. Streaming = parser, শুধু text flow নয়

Loop:

1. `fetch` + `response.body.getReader()`
2. Chunk → buffer
3. `\n` boundary-তে line কাটো
4. `JSON.parse(line)` → `obj.message.content` accumulate
5. `obj.done === true` হলে server metrics (`prompt_eval_count`, `eval_count`, …)

উদাহরণ line (Ollama):

```json
{"message":{"content":"হ্যা"},"done":false}
```

`onChunk(piece)` প্রতি piece-এ React state update — assistant bubble grow হয়।

## ২. Send path (hook)

`useChatSession.send`:

1. Guard — empty input, `busy`, message length, route missing
2. UI — user row + `streaming: true` assistant row
3. `buildApiPayload` → `payload` (roles only, no `id`)
4. `setLastSentPayload(payload)`
5. `streamCompletion({ route, messages: payload, signal, onChunk })`
6. Done — `streaming: false`, `meta` on assistant message

`streamCompletion` provider অনুযায়ী `streamChat` (Ollama) বা `streamChatGroq` (SSE) — UI এক interface।

## ৩. Stop

```js
const ac = new AbortController()
abortRef.current = ac
// fetch(..., { signal: ac.signal })

stop() { abortRef.current?.abort() }
```

`AbortError`:

- Assistant row রাখে, content = accumulated text বা `'(stopped)'`
- Error banner নয় (network error থেকে আলাদা)

Composer: `busy` হলে **Stop** বাটন, নাহলে **Send** (`ChatComposer.jsx`).

## ৪. Metrics (completion)

`normalizeAssistantMeta` → assistant message-এ `meta`:

| Field | উৎস |
|-------|------|
| `wallMs` | browser `performance.now()` |
| `promptTokens` / `completionTokens` | Ollama `prompt_eval_count` / `eval_count` (Groq-ও map) |
| `serverTiming` | Ollama ns durations (localllm only) |

TTFT আলাদা field নেই — প্রথম `onChunk` timestamp দিয়ে নিজে measure করা যায়।

> [!TIP]
> Debug-এ প্রতিটি send-এর আগে জানো `payload`-এ কী আছে (`lastSentPayload`); stream ঠিক হলেও wrong context = wrong answer।

**Boundary:** Token budget, eviction, summarizer — *Context budget and eviction*, *Pins compression and summary*।
