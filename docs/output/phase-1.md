# Phase 1 — Prompt, context, and model switching

This phase is about **learning how the model actually sees your conversation**: system vs user turns, what gets sent on each request, how much history fits, and what happens when it does not. The **chat-web** app is the main lab bench; **chat-cli** is the thin baseline that proves the same Ollama API without UI concerns.

In **chat-web**, a small **API layer** sits between the React session and the wire: a **route registry** picks a provider (local Ollama vs optional Groq), a **single streaming façade** delegates to the right client, and **normalized completion meta** keeps metrics consistent in the UI. Dev-time **Vite proxies** (`/ollama`, `/groq`) act like a lightweight gateway (CORS + keeping secrets out of the bundle when you use the proxy path).

---

## How this repo evolved (from commit history)

Commits are listed newest-first; the story reads more naturally bottom-up.

| Step | Commit theme | Intent |
|------|----------------|--------|
| 1 | `setup folder` | Monorepo shape: place for apps and shared learning material. |
| 2 | `chat-cli add` | **CLI → API contract** — minimal Node client: one process, one model call pattern, env-driven host/model. Establishes “what is a chat message” before React state enters the picture. |
| 3 | `web chat` | **CLI → web** — same Ollama `/api/chat` idea, but: persistent transcript in the browser, abort/stop, and UX for multi-turn flow. The hard part moves from “call the API once” to **session lifecycle** (pending assistant row, streaming partial text, errors). |
| 4 | `prompt engineering apply` | **System prompt as fixed policy** — persona and rules live in one place (`SYSTEM_PROMPT`); every request carries that system message. Learning: the model’s “character” is not magic; it is **the first messages** in the payload. |
| 5 | `multi model support` | **Model switching** — configured model list (env), picker in UI, choice persisted (e.g. `localStorage`). Same transcript, different weights: you feel **temperature / speed / verbosity** change without changing client code. |
| 6 | `context improving` | **Context pipeline** — token-ish budget, turn grouping, eviction scoring, optional compression of long assistant replies for *API* context only, pipeline debug report. Learning: **full UI transcript ≠ full model context**. |

**Also in chat-web (architecture, may trail git log):** **API layer** — `getChatRoutes()` / `streamCompletion()` so the UI does not hard-code “always Ollama”; optional Groq (OpenAI-compat streaming) with dev proxy and `completionMeta` normalization.

**Insight:** moving CLI → web did not add “smarts”; it added **state, cancellation, and visibility**. The later commits add **governors** on what actually ships in each request, then a **thin façade** so those governors stay shared when you add a second provider.

---

## Web chat — what we implement (step by step)

### 1. Session model and visible transcript

- In-memory **message list**: system (hidden or separated in UI), user/assistant pairs, stable ids for pinning and debugging.
- **Streaming assistant row**: a provisional message that updates on each chunk until done or aborted.
- **Abort**: user can stop generation; partial text is kept or labeled as stopped.

Representative surface (React hook):

```ts
function useChatSession(): {
  visibleMessages: Message[]
  send(): Promise<void>
  stop(): void
  clearHistory(): void
  // model, input, busy, error, …
}
```

**Learning:** the transcript you *show* can diverge from the array you *serialize to the model* (see clipping and compression below).

### 2. Streaming chat (transport-level)

**Local LLM (Ollama):** the client calls **streaming** `POST …/api/chat` with `stream: true`, **NDJSON** lines, append `message.content` deltas; the **final line** often includes counters and durations.

**Optional Groq:** OpenAI-compatible **`POST …/chat/completions`** with `stream: true`, SSE-style chunks; usage can be requested on the last chunk (`stream_options.include_usage`) for token counts.

Representative **per-provider** client (still used behind the façade; see §6):

```ts
function streamChat(opts: {
  messages: { role: string; content: string }[]
  model: string
  signal?: AbortSignal
  onChunk: (chunk: string) => void
}): Promise<{ fullText: string; metrics: StreamMetrics }>
```

**Learning:** wall-clock time in the browser (network, TLS, UI) is **not** the same as server-reported timings; both matter for UX vs diagnostics.

### 3. Metrics on the assistant turn

After stream completion, the UI attaches **`AssistantCompletionMeta`** (`completionMeta`): **which provider ran**, **wallMs**, **prompt / completion token counts** when available, and for local LLM optionally **server timing** (Ollama nanosecond fields). Raw wire shapes differ; normalization keeps the transcript UI and future tooling stable.

**Learning:** these numbers teach **prompt weight vs generation cost** and approximate throughput; they also make it obvious when you blew the context window with a huge prompt.

### 4. Conversational history (client-side)

- Full thread kept in React state until **clear history**.
- Optional **history / debug panel**: inspect last payload, pipeline report, or copy JSON for learning.

**Learning:** Phase 1 stops at **browser memory** — no durable server-side conversation store yet. That is a deliberate boundary: first you must trust **packing and eviction** before you persist.

### 5. Routes & model / provider selection

- **Chat routes** — each entry is a **`ChatRoute`**: `id` (e.g. `localllm:phi3`, `groq:llama-3.1-70b-versatile`), **provider**, and **model** string passed to that provider’s API.
- **Local routes** — built from the same **env-defined** Ollama model list as before (`getConfiguredModelIds()`).
- **Optional Groq route(s)** — from env (e.g. `VITE_GROQ_MODEL`); can be disabled (`VITE_DISABLE_GROQ=1`).
- UI **route selector**; persisted **`route` id** (e.g. `localStorage`), not just a bare model name.
- Optional **remote check** for local models (e.g. Ollama `/api/tags`).

Representative registry helpers:

```ts
function getChatRoutes(): ChatRoute[]
function readStoredRouteId(routes: ChatRoute[]): string
function findRoute(routes: ChatRoute[], id: string): ChatRoute | undefined
```

**Learning:** switching routes changes **provider + model**; the session and `buildApiPayload` stay the same so **context policy** does not fork per vendor.

### 6. API layer — façade, proxy, normalization

The hook calls **one entry point**; transport and vendor quirks stay in small modules.

| Piece | Role |
|--------|------|
| **`streamCompletion`** | Takes the selected `ChatRoute`, `messages`, `signal`, `onChunk`; dispatches to **`streamChat` (Ollama)** or **`streamChatGroq`**. Returns `{ fullText, meta }` where `meta` is already normalized. |
| **`llmRegistry`** | Builds the route list, storage key, `findRoute` / `readStoredRouteId`. |
| **`completionMeta` / `normalizeAssistantMeta`** | Maps per-provider raw metrics into **`AssistantCompletionMeta`** (`provider`, `wallMs`, token counts, optional `serverTiming` for local). |
| **Vite dev proxy** (`vite.config.js`) | **`/ollama` →** local Ollama (strip prefix); **`/groq` →** Groq OpenAI base URL with **`Authorization: Bearer`** injected from **server-side env** (`GROQ_API_KEY` / `VITE_GROQ_API_KEY` loaded by Vite config) so the key is **not** bundled when using same-origin `/groq/...` in dev. |

Representative façade signature:

```ts
function streamCompletion(opts: {
  route: ChatRoute
  messages: { role: string; content: string }[]
  signal?: AbortSignal
  onChunk: (chunk: string) => void
}): Promise<{ fullText: string; meta: AssistantCompletionMeta }>
```

**Learning:** this is not a heavy “BFF” yet — it is **seams**: same UI and context pipeline, **pluggable backends**, and a place to grow (auth, logging, rate limits) without rewriting React state.

### 7. Context management — one pipeline before each send

Goal: build `messages[]` for **whatever provider** runs next (same shape for Ollama and Groq chat APIs) from **internal rows** (with optional `pinned`, optional `contextContent`).

Key stages:

1. **System row** — always retained as the first message when present.
2. **Turn grouping** — user/assistant pairs for scoring and eviction **as a unit** where possible.
3. **Token budget** — heuristic `chars/4` (or similar) summed over flattened Ollama messages; budget from env/constraints (e.g. `VITE_CONTEXT_TOKEN_BUDGET`).
4. **Eviction loop** — while over budget, drop **whole turns** (not random messages), skipping pinned turns and protecting the in-flight user message as needed. Lower-scored turns go first; scoring boosts recency, code blocks, length, etc.
5. **Compression for API** — long assistant replies can send a shortened **effective** string to the model (`contextContent` or inline head/tail heuristic) while the UI keeps the full text.

Representative pipeline entry:

```ts
function buildApiPayload(input: {
  internalMessages: InternalRow[]
  newUser: { id: string; content: string }
  constraints: ChatConstraints
}): {
  messages: { role: string; content: string }[]
  clipped: boolean
  meta: { report: ContextPipelineReport; … }
}
```

Representative compression hooks:

```ts
function heuristicCompressAssistantContent(text: string): string
function maybeAssistantContextContentFields(fullText: string): { contextContent?: string }
```

**Learning:** **clipping** is not “delete old messages from the UI” — it is **excluding** them from *this* API call. Pins and summaries (future phase) are how you **bias** what survives under a cap.

### 8. Clipping vs UI — “last request” observability

- Flags like **“context was clipped”** for the last request.
- A structured **pipeline report** (turn counts, budget, removed turn ids, warnings) for debugging.

**Learning:** without visibility, users assume “the model forgot” when the client actually **evicted** turns to stay under budget. Phase 1 invests in that honesty.

---

## Phase 1 learning insights (short list)

1. **System prompt is part of the payload** — treat it like code: small edits change behavior across all turns.
2. **Streaming is UX + protocol** — you are implementing a parser and a state machine, not just `await response.json()`.
3. **Metrics connect prompt engineering to cost** — big pasted transcripts show up in prompt eval count and latency before a single new token.
4. **Model switch is a knob, not a new app** — the interesting work is keeping **context policy** consistent across models with different context lengths and quirks.
5. **Transcript ≠ context** — long assistant answers are expensive to resend; compressing for API while showing full text in UI is a standard pattern.
6. **Eviction must be explainable** — pin + scored turns + reports turn “black box” truncation into something you can reason about and improve in later phases.
7. **CLI still matters** — when the web app misbehaves, the CLI is the **control** that isolates frontend bugs from Ollama or model issues.
8. **A façade earns its keep once `n > 1`** — second provider (or second base URL) is when hard-coded `fetch` in components hurts; keep packing, streaming, and meta shape in shared modules.

---

## Optional sample signatures (compression / budget utilities)

```ts
function estimateTokensForText(s: string): number
function estimateTokensForMessages(messages: { content: string }[]): number
function groupIntoTurns(rows: InternalRow[]): Turn[]
function scoreTurn(t: Turn, turnIndex: number, totalTurns: number): number
function streamCompletion(opts: {
  route: ChatRoute
  messages: { role: string; content: string }[]
  signal?: AbortSignal
  onChunk: (chunk: string) => void
}): Promise<{ fullText: string; meta: AssistantCompletionMeta }>
function normalizeAssistantMeta(
  provider: CompletionProvider,
  raw: StreamMetricsLike,
): AssistantCompletionMeta
```

---

## What Phase 1 explicitly defers

- **Rolling summaries** (placeholder in pipeline report: “Phase 3 rolling summary not implemented”).
- **Server-persisted** threads and multi-device history.
- **Tool use** / RAG — context is chat-only.

Those are natural next layers once context packing and observability feel boring.
