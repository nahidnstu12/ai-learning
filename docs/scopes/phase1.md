# Phase 1 — Local LLM: scopes & checkpoints

**Goal:** Run a local model, call it from JavaScript, and understand **what you send** (prompt, history, parameters) and **what comes back** (tokens, streaming, limits) — not only that the call succeeds.

**Duration:** ~2 weeks (suggested pacing)

**Stack:** Docker · Ollama · Node.js · JavaScript · (optional) React web chat

---

## Phase map


| Week | Focus                             | Intended outcome                                                                                                               |
| ---- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Environment + first API usage     | Ollama reachable from your machine; non-streaming and streaming `/api/chat` understood                                         |
| 2    | Prompting + small shipped clients | System vs user roles, multi-turn history, sampling knobs; **chat-cli** (and optionally **chat-web**) exercising the same ideas |


---

## Learning scopes (what Phase 1 is *about*)

These are the **themes** you should be able to connect to behavior in your apps.

### A. Runtime & API shape

- **Local inference** — model runs behind Ollama’s HTTP API; `docker compose` (or equivalent) gives a stable base URL.
- `**/api/chat` vs `/api/generate`** — chat format carries **role-based messages**; generation is single-prompt. Phase 1 standard is chat.
- **List / inspect models** — names and tags; knowing what is installed before you switch.

**Checkpoint:** You can explain why a “chat” request is a JSON array of messages, not a single string.

### B. Streaming & lifecycle

- **NDJSON chunks** — `stream: true` yields many small events; the client **accumulates** assistant text until `done`.
- **Cancellation** — aborting the request leaves a **partial** reply; UX should reflect that.
- **Wall time vs server timings** — browser elapsed time and Ollama-reported durations measure different things.

**Checkpoint:** You can trace one user send from “button / Enter” through “last chunk” without hand-waving.

### C. Tokens & context

- **Tokens (concept)** — rough heuristic (e.g. chars ÷ 4) vs exact counters when the API returns them on the final chunk.
- **Context window** — history + system + new user message must fit; “the model forgot” is often “**it was never in the payload**”.
- **Clipping / truncation** — keeping last N turns, dropping middle turns, or summarizing (summaries = later phase).

**Checkpoint:** You can estimate order-of-magnitude prompt size and name one strategy when history exceeds budget.

### D. Prompting & parameters

- **System message** — stable policy / persona; affects every turn.
- **Multi-turn memory** — stateless server; **you** resend history (or a packed subset).
- **Sampling** — `temperature`, `top_p`, `top_k`, `num_predict`: when low settings favor stability vs when higher adds variety.

**Checkpoint:** You can change system prompt and predict at least one observable change in answers.

### E. Models & switching

- **Different weights** — speed, style, and context length differ by model id.
- **Switching** — same client, different `model` field; failure modes when the name is wrong or the model is not pulled.

**Checkpoint:** You can switch models and compare latency and answer shape on the same prompt.

---

## Checkpoints (ordered path)

Use this as a **progress ladder**, not a day-by-day script.


| #   | Checkpoint                                          | Shows you’ve learned                                            |
| --- | --------------------------------------------------- | --------------------------------------------------------------- |
| 1   | Ollama up; **curl** (or equivalent) chat call works | Environment is real; JSON request/response                      |
| 2   | **Node** non-streaming chat                         | `fetch`, roles, parsing final message                           |
| 3   | **Streaming** chat in Node                          | reader loop, incremental output, `done`                         |
| 4   | **Multi-turn** history in memory                    | user/assistant alternation resend                               |
| 5   | **System prompt** + optional slash/config commands  | persona + parameters as data, not magic                         |
| 6   | **chat-cli** (or equivalent) — thin REPL            | one place combining 2–5                                         |
| 7   | Optional **chat-web** — same API, browser UX        | session state, stop, visibility into payload — [chat-web.md](../output/chat-web.md) |


---

## Baseline Phase 1 deliverable vs extras

### Baseline (original scope)

- **chat-cli** — minimal Node client: multi-turn chat, streaming, model name from env, dependency on Ollama only. **→** [chat-cli.md](../output/chat-cli.md) (runbook, env table, flow vs Phase 1 themes).
- **chat-web** — Vite + React optional extra: routes, context pipeline, Stop, Groq proxy. **→** [chat-web.md](../output/chat-web.md).
- Concepts: tokens, context limits, system prompt, sampling, no persistence required beyond the session.

### Extras added in this repo (beyond the thin CLI lesson)

These extend Phase 1 **without** starting RAG/embeddings (that’s Phase 2):


| Extra                       | Learning intent                                                                                                                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Web chat (Vite + React)** | Same Ollama contract as CLI; practice **UI state** (pending assistant message, stream updates, errors).                                                                                                  |
| **Streaming + stop**        | AbortController / cancel path; partial reply handling.                                                                                                                                                   |
| **Per-turn metrics**        | Attach server counters (e.g. prompt/eval counts, durations) to finished assistant turns; compare to wall time.                                                                                           |
| **Multiple models / routes** | Env-driven **local** model list + optional **Groq** route; UI **route** picker (`localllm:…` / `groq:…`), persisted selection.                                                                                                                                        |
| **Fixed system persona**    | Central system prompt (e.g. interview-coach style) — teaches “policy lives in first messages”.                                                                                                           |
| **Context pipeline**        | Before each request: **turn grouping**, **token budget**, **eviction** of unpinned turns; optional **head/tail compression** for long assistant text in the API payload only (full text can stay in UI). |
| **Pinned turns**            | Bias what survives clipping — teaches “not all history is equal”.                                                                                                                                        |
| **Pipeline report / debug** | Structured log of budget, removed turns, warnings — teaches **observability** when context is dropped.                                                                                                   |
| **Constraints module**      | Single place for caps (message size, max reply tokens, temperature ceilings) — teaches **safeguards** as product policy.                                                                                 |
| **API layer (chat-web)**    | **`streamCompletion`** façade + **`llmRegistry` routes** (local Ollama vs optional Groq); **`normalizeAssistantMeta`** for one UI shape; **Vite dev proxies** `/ollama` and `/groq` (CORS + optional Bearer injection so keys need not ship in the bundle for the proxy path). |


**Note:** Rolling **summaries** of old turns and **server-stored** threads are explicitly **out of scope** for Phase 1 in code comments / pipeline placeholders; they belong in later phases.

---

## Completion checklist (outcomes)

### Environment

- Docker (or your chosen runtime) runs Ollama reliably
- At least one small model pulled (e.g. phi-class) and callable
- Verified chat API manually once (no framework required)

### Core skills

- Non-streaming and **streaming** chat both work from your code
- Multi-turn **history** is assembled intentionally (you know what is in `messages`)
- **System** message and sampling options are under your control
- You can read **token-ish** signals from responses (estimate + API counts when available)

### Concepts (explain without looking at notes)

- Token vs character; why context windows matter
- Why the model “forgot” something when middle turns were dropped or never sent
- Temperature vs nucleus (`top_p`) — qualitative difference

### Shipped artifacts (pick what matches your path)

- **chat-cli** runs end-to-end
- (If you took the extra path) **chat-web** runs with streaming and honest context behavior

---

## Toward Phase 2

Phase 1 stops at **chat + packing + local metrics**. Phase 2 adds **embeddings**, **vector storage**, and **RAG** — same Ollama host, different endpoints and data paths.

---

*Phase 1 scope doc — learning checkpoints and extras, not implementation recipes.*