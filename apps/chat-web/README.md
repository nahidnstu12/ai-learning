Suppose the final streamed JSON line looks like this (illustrative):

{
  "model": "phi3",
  "message": { "role": "assistant", "content": "" },
  "done": true,
  "prompt_eval_count": 256,
  "eval_count": 64,
  "total_duration": 4200000000,
  "load_duration": 50000000,
  "prompt_eval_duration": 1200000000,
  "eval_duration": 2800000000
}
Then your metrics ends up roughly:

promptEvalCount → 256 (prompt tokens this run)
evalCount → 64 (generated tokens)
totalDurationNs → 4.2e9 → 4.2 s server total
loadDurationNs → 50 ms
promptEvalDurationNs → 1.2 s prompt phase
evalDurationNs → 2.8 s generation phase
Note: those phases don’t have to add up exactly to total_duration; there is other overhead (scheduling, bookkeeping, etc.).

Meanwhile wallMs might be 4500 if the browser waited longer (network, TLS, queuing) than the server’s total_duration.

Handy rates (approximate):

Output tok/s ≈ eval_count / (eval_duration / 1e9)
Prompt tok/s ≈ prompt_eval_count / (prompt_eval_duration / 1e9) when duration > 0


---


Here’s what **actually applies** in `chat-web` with your current `.env` and code (no hand-wavy “you could…”).

### System prompts (what the model sees)

1. **Main chat** — hardcoded in `systemPrompt.js`, **not** `VITE_CHAT_SYSTEM_PROMPT` (that var isn’t referenced anywhere; your commented line does nothing). First message in session is always:

```1:10:/Users/radiustheme13/project/ai-learning/apps/chat-web/src/components/chat/systemPrompt.js
/** Fixed persona: software interview coach (not configurable via env). */
export const SYSTEM_PROMPT = `You are a sharp interview coach. Give focused, interview-ready answers.

Rules:
- Match answer length to question complexity. Simple question = 2-3 lines. Deep question = structured breakdown.
- Lead with the clearest possible one-liner explanation.
- Use a real analogy or mental model when it makes the concept stick faster than a definition.
- Include a code snippet only when it proves the point better than words. Keep it minimal, modern JS.
- No intros, no "great question", no padding.
- Only mention tradeoffs, pitfalls, or follow-ups when they are genuinely interview-critical — not by default.`
```

2. **History summarizer** (only when `VITE_ENABLE_HISTORY_SUMMARY=1`) — extra system prompt in `summarizeHistory.js` (`SUMMARY_SYSTEM`): compress transcript, preserve facts, bullets, no preamble.

### Env → runtime values (your file + defaults)

| Variable (your `.env`) | Effect |
|------------------------|--------|
| `VITE_OLLAMA_URL=/ollama` | Browser calls same-origin `/ollama`; Vite proxies to `http://127.0.0.1:11434`. |
| `VITE_MODEL_CHAT=phi3` | Default Ollama model id when a route uses local (also fallback if options empty). |
| `VITE_MODEL_CHAT_OPTIONS=phi3,llama3.1:8b` | **Local routes** in the dropdown: those two models. |
| `VITE_CONTEXT_TOKEN_BUDGET=1024` | **Tight** estimated prompt budget (~chars/4) for packing; turns get scored/evicted to fit. |
| `VITE_ENABLE_HISTORY_SUMMARY=1` | If estimated tokens exceed budget *and* there’s unpinned transcript, runs summarizer call first, then packs with summary + pins. |
| `VITE_GROQ_MODEL=openai/gpt-oss-120b,llama-3.3-70b-versatile,llama-3.1-8b-instant` | **Three Groq routes** (unless `VITE_GROQ_MODEL_OPTIONS` overrides — you didn’t set that). |
| `GROQ_API_KEY=…` | Used **only** by Vite dev proxy to add `Authorization` to `/groq` requests — not bundled if you don’t set `VITE_GROQ_API_KEY` + direct base URL. |

**Commented-out in your `.env`** → **code defaults** for **Ollama** sampling (`ollamaClient.js`):  
`temperature=0.7`, `top_p=0.9`, `top_k=40`, `repeat_penalty=1.1`, `num_predict` from env or **`512`**, then **capped by** `CHAT_CONSTRAINTS.maxReplyTokens` (**512**).  
**Groq** (`groqClient.js`): `max_tokens` defaults to **`CHAT_CONSTRAINTS.maxReplyTokens` (512)** for normal chat; temperature same chain as Ollama unless `VITE_GROQ_TEMPERATURE` is set.

**Not in your `.env`** → still applied from code:

- `VITE_SUMMARY_NUM_PREDICT` unset → summarizer `maxReplyTokens` / `num_predict` cap **1024** (`summaryMaxReplyTokens`).
- `VITE_OLLAMA_KEEP_ALIVE` unset → **`5m`** on Ollama requests.

### Hard constraints (`CHAT_CONSTRAINTS` — not env unless noted)

- **User message**: max **12_000** chars — enforced in `useChatSession` send + `textarea` `maxLength` (`ChatComposer.jsx`).
- **Context packing**: token budget **`resolveContextTokenBudget()`** → with your env that’s **1024** (clamped 256–500k in code).
- **Reply length cap (normal chat)**: **512** tokens for both providers unless you raise `maxReplyTokens` in `chatConstraints.js` (Ollama also clamps `num_predict` to `maxReplyTokens` in `chatOptions()`).
- **Assistant compression** for API payload: if assistant text ≥ **3500** chars and no `contextContent`, heuristic head/tail compress (**450** each).
- **Sampling ceilings** (env can’t exceed): `temperatureMax 1.2`, `topPMax 1`, `topKMax 128`, `repeatPenaltyMax 2`.
- **Ollama `num_predict` override** (summarizer path): clamped **64–8192** in `streamChat`.

### “Guardrails”

There’s **no** separate moderation / policy / safety filter in this app. “Guardrails” here are: **persona system prompt**, **length limits**, **context eviction + optional summarization**, and **pinning** (pinned turns aren’t evicted; they affect summarization input).


**Sources:** `systemPrompt.js`, `useChatSession.js`, `chatConstraints.js`, `buildApiPayload.js`, `ollamaClient.js`, `groqClient.js`, `llmRegistry.js`, `modelConfig.js`, `summarizeHistory.js`, `ChatComposer.jsx`, `vite.config.js`, your `apps/chat-web/.env`.

---


Final **effective** runtime values for your current setup (your `.env` + code defaults). Secrets not repeated.

### Env / routing
| Key | Value |
|-----|--------|
| `VITE_OLLAMA_URL` | `/ollama` |
| `Ollama proxy target` | `http://127.0.0.1:11434` |
| `VITE_MODEL_CHAT` | `phi3` |
| `VITE_MODEL_CHAT_OPTIONS` (local models) | `phi3`, `llama3.1:8b` |
| `VITE_GROQ_MODEL` (Groq models) | `openai/gpt-oss-120b`, `llama-3.3-70b-versatile`, `llama-3.1-8b-instant` |
| `VITE_GROQ_BASE_URL` | *(unset)* → requests go to `/groq/chat/completions` |
| `GROQ_API_KEY` | *(set in `.env`; injected by Vite proxy only — not a `VITE_` bundle value)* |
| `VITE_DISABLE_GROQ` | *(unset)* → Groq routes enabled |
| `VITE_GROQ_MODEL_OPTIONS` | *(unset)* |
| `VITE_GROQ_API_KEY` | *(unset)* |
| `VITE_GROQ_TEMPERATURE` | *(unset)* → falls back to chat temperature |

### Context / history
| Key | Value |
|-----|--------|
| `VITE_CONTEXT_TOKEN_BUDGET` | `1024` |
| `VITE_ENABLE_HISTORY_SUMMARY` | `1` |
| `VITE_SUMMARY_NUM_PREDICT` | *(unset)* → `1024` |

### Sampling (Ollama `options` — your `VITE_CHAT_*` lines commented → defaults)
| Key | Value |
|-----|--------|
| `temperature` | `0.7` |
| `top_p` | `0.9` |
| `top_k` | `40` |
| `repeat_penalty` | `1.1` |
| `num_predict` (main chat) | `512` *(env would still be clamped to `CHAT_CONSTRAINTS.maxReplyTokens` = 512)* |
| `keep_alive` | `5m` |

### Sampling (Groq main chat)
| Key | Value |
|-----|--------|
| `max_tokens` | `512` |
| `temperature` | `0.7` |

### `CHAT_CONSTRAINTS` (code, unless env above overrides)
| Key | Value |
|-----|--------|
| `maxUserMessageChars` | `12000` |
| `maxContextChars` | `48000` |
| `maxContextTokenBudget` | `1024` |
| `maxReplyTokens` | `512` |
| `summaryMaxReplyTokens` | `1024` |
| `assistantContextCompressMinChars` | `3500` |
| `assistantCompressHeadChars` | `450` |
| `assistantCompressTailChars` | `450` |
| `temperatureMax` | `1.2` |
| `topPMax` | `1` |
| `topKMax` | `128` |
| `repeatPenaltyMax` | `2` |

### System prompts (exact strings sent)
| Key | Value |
|-----|--------|
| `SYSTEM_PROMPT` (main) | `You are a sharp interview coach. Give focused, interview-ready answers.\n\nRules:\n- Match answer length to question complexity. Simple question = 2-3 lines. Deep question = structured breakdown.\n- Lead with the clearest possible one-liner explanation.\n- Use a real analogy or mental model when it makes the concept stick faster than a definition.\n- Include a code snippet only when it proves the point better than words. Keep it minimal, modern JS.\n- No intros, no "great question", no padding.\n- Only mention tradeoffs, pitfalls, or follow-ups when they are genuinely interview-critical — not by default.` |
| `SUMMARY_SYSTEM` (summarizer only) | `You compress chat transcripts into a single dense summary for another LLM that will continue the conversation.\nRules:\n- Preserve facts: names, numbers, decisions, constraints, tool results, code intent (not full code unless short).\n- Keep open questions and unresolved items explicit.\n- Use clear bullets or short paragraphs. No preamble or "Here is a summary".` |

### Not used (despite comment in `.env`)
| Key | Value |
|-----|--------|
| `VITE_CHAT_SYSTEM_PROMPT` | *(not read by app — ignored)* |