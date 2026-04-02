# chat-web — full manual E2E test procedure

Use this as a **final acceptance checklist** for `apps/chat-web`: environment, core chat, providers, context pipeline, optional Groq/summary, and build.

---

## 0. Prerequisites

| Requirement | Check |
|-------------|--------|
| Node.js **18+** (20+ recommended) | `node -v` |
| npm | `npm -v` |
| **Ollama** running and reachable | Default `http://127.0.0.1:11434` or Docker mapped to same |
| At least one **pulled** model matching your `.env` (e.g. `phi3`) | `ollama list` or `docker exec -it ollama ollama list` |
| (Optional) **Groq** API key for cloud routes | [console.groq.com](https://console.groq.com) |

---

## 1. One-time setup

```bash
cd apps/chat-web
cp .env.example .env
npm install
```

### 1.1 Minimal `.env` (local Ollama only)

Edit `apps/chat-web/.env`:

```env
VITE_OLLAMA_URL=/ollama
VITE_MODEL_CHAT=phi3
```

Ensure Vite can reach Ollama:

- Dev proxy expects Ollama at **`127.0.0.1:11434`** (see `vite.config.js`).
- Pull the model if needed: `ollama pull phi3` (or your chosen id).

### 1.2 Optional: Groq

```env
GROQ_API_KEY=gsk_...
# VITE_GROQ_MODEL=llama-3.3-70b-versatile
```

Leave `VITE_GROQ_BASE_URL` **unset** so the browser uses same-origin `/groq` and the key stays on the dev server.

### 1.3 Optional: tighter context (for eviction / summary tests)

```env
VITE_CONTEXT_TOKEN_BUDGET=512
```

Lower values make **clipping** and **budget-triggered summarizer** easier to trigger in a short session.

---

## 2. Run the app

```bash
cd apps/chat-web
npm run dev
```

Open the URL Vite prints (usually **`http://localhost:5173`**).

**After any `.env` change**, stop and restart `npm run dev`.

---

## 3. Smoke checks (every run)

1. **Page loads** — no blank screen / red error overlay.
2. **Ollama status** — top banner shows **Ollama: OK** (or **unreachable** with hint if host is down).
3. **Groq hint** — same area may say to set `GROQ_API_KEY` when using the `/groq` proxy; after setting key, restart dev.
4. **Composer** — character counter and **Send** work.

---

## 4. Core chat (local LLM)

| Step | Action | Pass criteria |
|------|--------|----------------|
| 4.1 | **Route** dropdown: pick **Local …** (Ollama) | Choice persists after refresh (`localStorage`). |
| 4.2 | Send: `Say hello in one sentence.` | Assistant message streams in; ends with full text, not stuck on “streaming”. |
| 4.3 | Send a **second** message that references the first (e.g. “What did I just ask?”) | Model answers consistently with thread (proves history in payload). |
| 4.4 | While streaming, use **Stop** (if present) | Stream stops; partial text or “(stopped)” behavior matches UI. |
| 4.5 | Toolbar → **API context** | **Ollama context** dialog: last payload, pipeline stages (`stages.turns`, `stages.tokens`, `stages.eviction`, `stages.summary`), **Copy JSON** if present. |

---

## 5. Streaming & metrics

| Step | Action | Pass criteria |
|------|--------|----------------|
| 5.1 | Complete one full reply | Assistant bubble shows **meta** (tokens / timing / provider) when your UI exposes it. |
| 5.2 | Compare **wall** vs server timings | Local Ollama: final chunk durations vs browser wall time can differ (both non-zero when applicable). |

---

## 6. Route switcher (multi-model / multi-provider)

| Step | Action | Pass criteria |
|------|--------|----------------|
| 6.1 | Set `VITE_MODEL_CHAT_OPTIONS=phi3,llama3.2:1b` (both pulled) | Two **Local · …** routes appear. |
| 6.2 | Switch local model, same thread | Replies still work; style/speed may change. |
| 6.3 | With `GROQ_API_KEY` set | **Groq · …** route(s) appear; switch and send — streaming reply from Groq. |
| 6.4 | `VITE_DISABLE_GROQ=1` | Groq routes **disappear** after restart. |

---

## 7. Context pipeline (eviction / pins / clip flag)

Use a **low** `VITE_CONTEXT_TOKEN_BUDGET` (e.g. `512`) for faster feedback.

| Step | Action | Pass criteria |
|------|--------|----------------|
| 7.1 | Send **many** short turns (10–20) or paste a **long** block | Still get a reply (eviction runs). |
| 7.2 | **API context** → pipeline report | `stages.tokens.estimatedBeforeEviction` vs `budget`; `stages.turns.keptTurnCount` &lt; `rawTurnCount` when evicted; `stages.eviction.removedTurnIds` when not skipped. Toolbar may show **· last send trimmed** when `final.clipped`. |
| 7.3 | **Pin** an early important turn; repeat long thread | Pinned content more likely to survive packing (eviction skips pinned). |
| 7.4 | UI transcript | Full scrollback still visible even when payload was clipped (**transcript ≠ payload**). |

---

## 8. History summarizer (budget-triggered)

| Step | Action | Pass criteria |
|------|--------|----------------|
| 8.1 | Set `VITE_ENABLE_HISTORY_SUMMARY=1` and **low** `VITE_CONTEXT_TOKEN_BUDGET` | |
| 8.2 | Short thread, dry-run **under** budget (`meta.estTokensBefore` ≤ `meta.budget`) | **No** extra summarizer round-trip; `stages.summary` stays **skipped** (reuses dry pack). |
| 8.3 | Long thread, **over** budget before eviction, with **unpinned** transcript | Extra latency; `stages.summary.status` = **`applied`** with the fold note. |
| 8.4 | Same but **only pinned** turns in body | No unpinned transcript → **no** summarizer call; normal eviction only. |
| 8.5 | Turn summarizer **off** (`#` out flag), restart | Back to eviction-only behavior. |

---

## 9. Constraints & errors

| Step | Action | Pass criteria |
|------|--------|----------------|
| 9.1 | Send empty / whitespace only | Handled (no send or clear error). |
| 9.2 | Stop Ollama mid-session | Error surfaced; UI doesn’t hang forever. |
| 9.3 | Wrong Groq model id | Error message from API (e.g. decommissioned model). |

---

## 10. Production-like build (optional)

```bash
cd apps/chat-web
npm run build
npm run preview
```

Open the preview URL. **Note:** Vite **dev proxies** (`/ollama`, `/groq`) apply to **`npm run dev`**, not necessarily the same for preview unless you deploy behind a reverse proxy. Treat **preview** as a **static bundle** check; full proxy behavior is validated in **dev**.

---

## 11. Final sign-off checklist

- [ ] Local chat: send, stream, multi-turn  
- [ ] Stop / abort acceptable  
- [ ] Route switcher + persistence  
- [ ] (If configured) Groq route works via `/groq` + env key  
- [ ] Pipeline / clipped visibility under tight budget  
- [ ] Pins affect packing  
- [ ] (If enabled) Summary only when over budget, not every message  
- [ ] `npm run lint` clean  
- [ ] (Optional) `npm run build` succeeds  

---

## 12. Troubleshooting

| Issue | What to check |
|--------|----------------|
| Ollama unreachable | Host running; `VITE_OLLAMA_URL`; firewall; Docker port `11434`. |
| CORS in dev | Use `VITE_OLLAMA_URL=/ollama` with Vite proxy, not raw cross-origin without Ollama `OLLAMA_ORIGINS`. |
| Groq 401 | Key in `apps/chat-web/.env`; restart dev; proxy vs `VITE_GROQ_BASE_URL` + `VITE_GROQ_API_KEY`. |
| Groq 400 model decommissioned | Update `VITE_GROQ_MODEL` — see [Groq deprecations](https://console.groq.com/docs/deprecations). |
| Route stuck after `.env` change | Clear site data or pick route again (stored id may be invalid). |

---

*App path: `apps/chat-web` · Example env: `apps/chat-web/.env.example`*
