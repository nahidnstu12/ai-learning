# chat-cli — Phase 1 reference app

**Parent scope:** [`phase1.md`](../scopes/phase1.md) (local LLM, streaming chat, prompting, context concepts).

**What this app is:** A **thin Node REPL** that keeps multi-turn chat in memory, calls **Ollama’s** `POST /api/chat` with **`stream: true`**, and prints tokens as they arrive. No browser, no Groq, no context packing — deliberately small so you can see the full `messages[]` story.

**Location:** `apps/chat-cli/` · **Entry:** `index.js`

---

## Run

```bash
cd apps/chat-cli
npm install
npm start
```

**Environment file:** `index.js` loads **`ai-learning/.env`** (repo root), not `apps/chat-cli/.env`. Copy from `.env.example` at repo root if needed.

```bash
cp ../../.env.example ../../.env
```

---

## Phase 1 learning map → chat-cli

| Theme in `phase1.md` | What chat-cli does |
| -------------------- | ------------------ |
| **A. Runtime & API** | Uses **`/api/chat`** with JSON `{ model, messages, stream, keep_alive, options }`. Role-based `messages` array. |
| **B. Streaming** | Reads the response body with **`getReader()`**, splits on **newlines**, **`JSON.parse`** per line, prints `message.content` chunks; accumulates full reply for history. |
| **C. Tokens & context** | Sends **the entire in-memory history** every turn — **no** trimming. “Forgot” in the CLI = model/context limit on the **server** or degraded coherence, not an app-side eviction (contrast **chat-web** later). |
| **D. Prompting & params** | **System** message is the first element of `messages`, fixed in code. **Sampling:** `temperature`, `top_p`, `top_k` from env (see table below). |
| **E. Models** | `model` is set **in code** today (`llama3.1:8b`). Switching models = edit `MODEL` in `index.js` (or extend to read `process.env` — see [Gaps](#gaps-vs-phase1-baseline)). |

---

## Request flow (step by step)

1. **Boot** — `dotenv` loads repo-root `.env`.
2. **REPL** — `readline` prints `You:` and waits for a line.
3. **Slash commands** — `/exit` / `/quit` → exit; `/clear` → reset to **system + empty history** (same system string as startup).
4. **Empty line** — ignored; loop continues.
5. **User turn** — `messages.push({ role: "user", content: trimmed })`.
6. **HTTP** — `fetch(OLLAMA_HOST + "/api/chat", …)` with current **`messages`** (includes system + all prior user/assistant turns).
7. **Stream loop** — For each NDJSON line: extract `message.content`, **`stdout.write`** chunk, append to `full`.
8. **History** — `messages.push({ role: "assistant", content: reply })` with the **full** assistant string.
9. **Timing** — Prints **`ms`** wall time for that request (not the same as Ollama-internal timings unless you extend the client to parse `done` metrics from the stream).
10. **Repeat** from step 2.

**Checkpoint:** You can name exactly what is inside `messages` before any given `fetch`.

---

## Environment variables (actually read)

| Variable | Used for | Default if unset |
| -------- | -------- | ---------------- |
| `OLLAMA_HOST` | Base URL (no trailing path) | `http://127.0.0.1:11434` |
| `OLLAMA_KEEP_ALIVE` | `keep_alive` in request body | `5m` |
| `CHAT_TEMPERATURE` | `options.temperature` | `0.7` |
| `CHAT_TOP_P` | `options.top_p` | `0.9` |
| `CHAT_TOP_K` | `options.top_k` | `40` |

---
