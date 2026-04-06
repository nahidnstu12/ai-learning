# chat-web — Phase 1 browser app (Vite + React)

**Parent scope:** [`phase1.md`](../scopes/phase1.md) — especially the **Extras** table (streaming + stop, routes, context pipeline, pins, Groq proxy).

**What this app is:** A **multi-route** chat UI: **local Ollama** and optional **Groq**, streaming replies, **Stop** (abort), **pinned turns**, and a **context pipeline** that **estimates tokens**, **evicts** unpinned history to fit a budget, optionally **summarizes** unpinned transcript, and **compresses** long assistant text in the **API payload** only (full text stays in the transcript).

**Location:** `apps/chat-web/` · **Entry:** `index.html` → `src/main.jsx` · Shell: `src/components/chat/Chat.jsx`

**Contrast:** [`chat-cli.md`](./chat-cli.md) — CLI sends full history every time; **chat-web** sends a **packed** subset per policy.

---

## Run

```bash
cd apps/chat-web
cp .env.example .env
# Edit .env — at minimum VITE_OLLAMA_URL; for Groq in dev set GROQ_API_KEY (Vite proxy injects it).
npm install
npm run dev
```

**Env file:** `apps/chat-web/.env` (Vite **`VITE_*`** vars are exposed to the client; **`GROQ_API_KEY`** is **not** prefixed — read by **`vite.config.js`** for the `/groq` proxy only.)

**Production note:** Dev proxies (`/ollama`, `/groq`) are **Vite server** features. A static build needs another way to reach Ollama/Groq (same-origin API, env at build time for direct Groq, etc.) — out of scope for this doc.

---

## Architecture (where logic lives)

| Area | Files / modules |
| ---- | ----------------- |
| Session & send flow | `src/components/chat/useChatSession.js` |
| System prompt | `src/components/chat/systemPrompt.js` |
| Pack messages for API | `src/lib/buildApiPayload.js` |
| Limits & budgets | `src/lib/chatConstraints.js` |
| Routes (local + Groq) | `src/lib/llmRegistry.js`, `src/lib/modelConfig.js` |
| Streaming façade | `src/lib/streamCompletion.js` |
| Ollama HTTP | `src/lib/ollamaClient.js` |
| Groq HTTP | `src/lib/groqClient.js` |
| Optional summarizer | `src/lib/summarizeHistory.js` |
| Assistant payload compression | `src/lib/assistantContextCompress.js` |
| Pipeline logging / modal | `src/lib/contextPipelineLog.js`, `ChatContextModal.jsx` |
| Dev proxies | `vite.config.js` (`/ollama` → `127.0.0.1:11434`, `/groq` → Groq OpenAI base + Bearer) |

---

## Phase 1 learning map → chat-web

| Theme in `phase1.md` | What chat-web does |
| -------------------- | ------------------ |
| **A. Runtime & API** | Same **chat** pattern as Ollama (`messages`, `stream`). Groq uses **OpenAI-compatible** `chat/completions` with SSE-style `data:` lines. |
| **B. Streaming + cancel** | **AbortController** on send; **Stop** aborts fetch; partial text kept on cancel. |
| **C. Tokens & context** | **Estimated** prompt size (≈ chars÷4 per message) vs **`VITE_CONTEXT_TOKEN_BUDGET`**. Unpinned turns **evicted** by score; **pinned** turns protected. Optional **summary** of unpinned text before pack. Long assistant rows can use **`contextContent`** / heuristic **head+tail** in the payload only. |
| **D. Prompting & params** | **System** row is first in React state; main persona in `systemPrompt.js`. Summarizer uses separate **`SUMMARY_SYSTEM`** in `summarizeHistory.js`. Sampling: **`VITE_CHAT_*`** for Ollama; Groq uses **`VITE_GROQ_TEMPERATURE`** or falls back to **`VITE_CHAT_TEMPERATURE`**. Ceilings in **`CHAT_CONSTRAINTS`**. |
| **E. Models / routes** | Toolbar **route** = `localllm:<model>` or `groq:<model>`. Lists from **`VITE_MODEL_CHAT_OPTIONS`** / **`VITE_MODEL_CHAT`** and **`VITE_GROQ_MODEL`** / **`VITE_GROQ_MODEL_OPTIONS`**. **`VITE_DISABLE_GROQ=1`** removes Groq routes. Selection persisted in **`localStorage`**. |

---

## Send pipeline (one user message)

High level; details in `useChatSession.js`.

1. **Validate** — non-empty, under **`maxUserMessageChars`**, **`selectedRoute`** exists.
2. **UI** — append user message + empty **streaming** assistant; **`busy`**, new **AbortController**.
3. **Snapshot** — committed messages → **`internalMessages`**; new text as **`newUserArg`** (not yet in that snapshot array).
4. **If `VITE_ENABLE_HISTORY_SUMMARY=1`:**  
   - **Dry** `buildApiPayload` → compare **`estTokensBefore`** to **`budget`**.  
   - If **over budget** and there is **unpinned** transcript → **`summarizeTranscript`** (extra LLM call) → **`buildSummarizedInternalMessages`** (system + summary user blob + pinned rows).  
   - Else use dry pack only.
5. **If summary off:** single **`buildApiPayload`**.
6. **Bookkeeping** — save **`lastSentPayload`**, **`clipped`**, **`lastPipelineReport`** (for **Context** modal / pipeline log).
7. **`streamCompletion(route, payload)`** — chunk into assistant bubble; on success attach **`meta`**, **`maybeAssistantContextContentFields`** for long replies.
8. **Errors** — other than abort: drop assistant row + **`setError`**. **Finally** clear abort ref + **`busy`**.

**Modal:** “turns kept **a / b**” = **`keptTurnCount` / `rawTurnCount`** from **`buildApiPayload`** (turn groups before vs after eviction).

---

## Environment variables (reference)

Values are documented in **`apps/chat-web/.env.example`**. Below: **meaning** (not your private keys).

### URLs & models

| Variable | Role |
| -------- | ---- |
| `VITE_OLLAMA_URL` | Browser base for Ollama, e.g. `/ollama` (proxied) or full `http://127.0.0.1:11434` |
| `VITE_MODEL_CHAT` | Fallback single local model id |
| `VITE_MODEL_CHAT_OPTIONS` | Comma-separated local models → multiple **`localllm:`** routes |
| `VITE_GROQ_MODEL` | One or comma-separated Groq model ids (or `0` / `false` to disable list) |
| `VITE_GROQ_MODEL_OPTIONS` | If set (non-empty), overrides model list for Groq routes |
| `VITE_DISABLE_GROQ` | `1` → no Groq routes |
| `VITE_GROQ_BASE_URL` | If unset, browser uses **`/groq`** (proxy). If set, **direct** OpenAI-compatible base (may need **`VITE_GROQ_API_KEY`** in bundle) |

### Keys (Groq)

| Variable | Role |
| -------- | ---- |
| `GROQ_API_KEY` | Read by **Vite** only; proxy adds **`Authorization`** to upstream Groq (**not** exposed as `import.meta.env` in the default setup) |
| `VITE_GROQ_API_KEY` | Alternative name supported by **`vite.config.js`** for the same proxy |

### Context & summarization

| Variable | Role |
| -------- | ---- |
| `VITE_CONTEXT_TOKEN_BUDGET` | Estimated prompt token budget (invalid / missing → **8192** in code) |
| `VITE_ENABLE_HISTORY_SUMMARY` | `1` → budget-triggered summarizer path |
| `VITE_SUMMARY_NUM_PREDICT` | Max new tokens for summarizer call (default **1024**) |

### Sampling & generation (Ollama + partly Groq)

| Variable | Role |
| -------- | ---- |
| `VITE_CHAT_TEMPERATURE`, `VITE_CHAT_TOP_P`, `VITE_CHAT_TOP_K`, `VITE_CHAT_REPEAT_PENALTY` | Ollama **`options`**; Groq temp can fall back to **`VITE_CHAT_TEMPERATURE`** |
| `VITE_GROQ_TEMPERATURE` | Overrides Groq temperature when set |
| `VITE_CHAT_NUM_PREDICT` | Ollama `num_predict` input; **capped** by **`CHAT_CONSTRAINTS.maxReplyTokens`** |
| `VITE_CHAT_MAX_REPLY_TOKENS` | Caps main reply for **both** providers (`num_predict` / `max_tokens`) |
| `VITE_OLLAMA_KEEP_ALIVE` | Ollama **`keep_alive`** (default **5m**) |

### Prompt

| Variable | Role |
| -------- | ---- |
| `VITE_CHAT_SYSTEM_PROMPT` | **Not wired** in current `systemPrompt.js` (comment-only); persona = **`SYSTEM_PROMPT`** in that file |

---

## `CHAT_CONSTRAINTS` (code defaults & caps)

Defined in **`src/lib/chatConstraints.js`**. Highlights:

- **`maxUserMessageChars`** — **12000** (send guard + textarea `maxLength`)
- **`maxContextTokenBudget`** — from **`VITE_CONTEXT_TOKEN_BUDGET`** or default **8192**
- **`maxReplyTokens`** — from **`VITE_CHAT_MAX_REPLY_TOKENS`** or default **512**
- **`summaryMaxReplyTokens`** — summarizer cap (**`VITE_SUMMARY_NUM_PREDICT`**)
- **Assistant compression** — threshold **3500** chars; head/tail **450** chars each for API `contextContent`
- **Sampling ceilings** — e.g. `temperatureMax` **1.2**, `topPMax` **1**, etc.

---

## Security / operational notes

- Prefer **`GROQ_API_KEY`** + empty **`VITE_GROQ_BASE_URL`** in dev so the **key stays on the dev server**, not in the JS bundle.
- **No** content moderation layer: “policy” = **system prompt** + **limits** + **packing**, not third-party safety APIs.

---

## What chat-web does *not* include

- **Server-side** persisted threads (refresh = in-memory state lost unless you add storage)
- **RAG / embeddings** (Phase 2 direction in `phase1.md`)
- **Production** hosting story for proxies (dev-focused)

---

## Completion checklist (chat-web)

You’re comfortable with this app when you can:

- Trace **one send** from UI → **`buildApiPayload`** → **`streamCompletion`** → final assistant row  
- Explain **why** “turns kept” can be **less** than total turns (budget + eviction)  
- Switch **route** and see the **same** pipeline with a different provider  
- Use **Context** / pipeline UI to inspect **what actually shipped** in `messages`

---

*Companion to [`chat-cli.md`](./chat-cli.md) and [`phase1.md`](../scopes/phase1.md).*
