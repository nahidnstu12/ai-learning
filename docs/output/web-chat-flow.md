### Scope

`send` runs when the user submits a non-empty message: validate → append user + streaming assistant shell → build the **API message list** (with optional summarization + trimming) → **stream** the model reply → finalize or clean up.

---

### Step 0 — Guards (no network)

1. `text = input.trim()`. If empty or `busy`, **return**.
2. If `text.length > maxUserMessageChars` → **setError**, **return**.
3. If `!selectedRoute` (no LLM in registry) → **setError**, **return**.

**Example:** User pasted 20k chars → error immediately, nothing appended.

---

### Step 1 — UI prep (before any LLM work)

4. `setError(null)`, `setInput('')`.
319. New ids: `userId`, `asstId`.
6. `setMessages`: append **user row** with `text` and **assistant row** with `content: ''`, `streaming: true`.
7. `setBusy(true)`.
8. `AbortController` → `abortRef` (for Stop button).

**Example:** You type “explain closures” → input clears; transcript shows your message + empty assistant bubble that will fill as tokens arrive.

---

### Step 2 — Snapshot `internalMessages` (what history packaging sees)

9. From **current** `messages` (React state from **before** the append in the closure — see caveat below): drop `streaming` rows, keep `id`, `role , `content`, `pinned`, `contextContent`.

**Important nuance:** `internalMessages` is built from `messages` in the dependency array; it **does not include** the two rows you just pushed in step 1. The **new user turn** is passed separately as `newUserArg = { id: userId, content: text }`.

**Example:** Before send you had: `[system, U1, A1, U2, A2]` and nothing streaming.  
`internalMessages` = those five. `newUserArg` = your new `U3`.

---

### Step 3a — **`VITE_ENABLE_HISTORY_SUMMARY !== '1'`** (simple path)

10. One `buildApiPayload({ internalMessages, newUser: newUserArg, constraints })`.
11. `payload = packed.messages`, `clipped`, `pipelineMeta = packed.meta`.

**Example:** Budget 1024 tokens, history is long → `buildApiPayload` **evicts** old unpinned turns; you might see **5/7 turns kept**, `clipped` true if still tight.

---

### Step 3b — **History summary ON** (`VITE_ENABLE_HISTORY_SUMMARY === '1'`)

11. **Dry pack:** `dry = buildApiPayload(..., historySummaryApplied: false)` — same as 3a, used to **measure** `estTokensBefore` vs `budget`.
12. `analyzeHistoryForSummary(internalMessages)` →  
    - `system` (system row stripped),  
    - `pinnedRows` (verbatim user/assistant rows that are pinned),  
    - `unpinnedTranscript` (plain-text of all **unpinned** user/assistant content).

13. `overBudget = dry.meta.estTokensAfter > dry.meta.budget` (tokens **after** dry-run eviction; `estTokensBefore` is only pre-eviction and must not gate summarization).

**Case B1 — `!overBudget` OR `!unpinnedTranscript`**

- Skip summarizer.
- `payload = dry.messages`, `clipped = dry.clipped`, `pipelineMeta = dry.meta`.

**Example:** Short chat → dry run under budget → no summary call; same as summary-off behavior.

**Case B2 — `overBudget && unpinnedTranscript`**

14. **`summarizeTranscript({ route, transcript, signal })`** — **extra LLM call** with its own system prompt; writes a short summary of unpinned history only.
15. `pipelineInternal = buildSummarizedInternalMessages({ system, summaryText, pinnedRows, newId })`  
    Typical shape: `[system, user("### Prior conversation (summarized)\n…"), …pinned rows…]` (no old unpinned turns; they’re inside the summary block).
16. **`packed = buildApiPayload({ internalMessages: pipelineInternal, newUser, historySummaryApplied: true })`** — may still evict if summary+pins+huge new message exceed budget.
17. `payload / clipped / pipelineMeta` from `packed`.

**Errors in summarize path:**

- **`AbortError`** (user hit Stop): remove assistant placeholder, `busy` false, **return** (no main `streamCompletion`).
- **Other error:** `setError`, remove assistant row, **return**.

**Example:** Long unpinned thread; budget 1024 → first call summarizes “User asked X, Assistant said Y…” → second packing adds your new question; Groq/Ollama sees: system + summary user blob + pins + new user message.

---

### Step 4 — Bookkeeping for dev UI

18. `setLastSentPayload(payload)` — exact messages sent to the API.
19. `setLastRequestContextClipped(clipped)` — trimming warning flag from packer.
20. `setLastPipelineReport(pipelineMeta.report)` — turn counts, eviction ids, token estimates, etc. (what drives “turns kept: 5/7” in the modal).

---

### Step 5 — Main completion (`streamCompletion`)

21. `acc = ''`.
22. `await streamCompletion({ route, messages: payload, signal, onChunk })`  
    - Each chunk → `acc += chunk` → update assistant row with `content: acc`.
23. On success: same assistant row gets `fullText`, `streaming: false`, `maybeAssistantContextContentFields(fullText)` (stores compressed `contextContent` for future packing if long), `meta` (metrics).

**Example:** Stream shows token-by-token; when done, assistant message is final and may get `contextContent` for long replies.

---

### Step 6 — **`catch`**

24. **`AbortError`:** keep assistant message with `acc || '(stopped)'`, `streaming: false` (user sees partial answer).
25. **Any other error:** `setError`, **remove** assistant row, `setLastPipelineReport(null)` (pipeline report cleared on failure).

---

### Step 7 — **`finally`**

26. `abortRef = null`, `setBusy(false)` — always runs.

---

### Mental model (one diagram)

```text
[validate] → [append U + streaming A] → [internalMessages + newUser]
    → summary off OR (summary on but under budget / no transcript)
         → buildApiPayload → payload
    OR (summary on and over budget and have transcript)
         → summarizeTranscript → buildSummarizedInternalMessages → buildApiPayload → payload
    → streamCompletion(payload) → finalize assistant / handle errors
```

---

### React caveat (expert detail)

`send` closes over `messages` from when the callback was created. If two sends fired in a weird edge case before a re-render, you could theoretically get a stale `internalMessages`. Normal UX (`busy` blocks re-entry) avoids that.

If you want, we can trace one **full numeric example** (fake token estimates) through `buildApiPayload` eviction + summary in the same narrative style.

---


### Setup (concrete numbers)

- **`VITE_CONTEXT_TOKEN_BUDGET=1024`** → `budget = 1024` “tokens” (app uses **chars÷4** rounding up per message).
- **History summary:** `VITE_ENABLE_HISTORY_SUMMARY=1`.
- **Messages in UI (committed, no streaming):**

| id | role | pinned | content (for sizing) |
|----|------|--------|-------------------------|
| s1 | system | — | **800 chars** (system prompt) |
| u1 | user | no | 400 chars (“old Q1”) |
| a1 | assistant | no | 2000 chars (“old A1”) |
| u2 | user | **yes** | 100 chars (“pinned Q”) |
| a2 | assistant | **yes** | 300 chars (“pinned A”) |

User types **new message** `U3`: **200 chars** (“new Q3”).

Token heuristic: **tokens ≈ ceil(chars / 4)** (per message, then summed).

---

### Step 1 — `internalMessages` + `newUserArg`

- `internalMessages` = rows **s1, u1, a1, u2, a2** (snapshot before append).
- `newUserArg` = `{ id: u3, content: U3 }` (200 chars).

After mentally appending U3 to the body for packing, turns are roughly:

- **T0:** u1 + a1 (unpinned)
- **T1:** u2 + a2 (**pinned**)
- **T2:** u3 only (current user message, no assistant yet)

---

### Step 2 — Dry `buildApiPayload` (no summary yet)

Rough token estimates for **flattened** messages (system + alternating user/assistant for kept turns):

- System alone: 800 → **200** tokens  
- Whole thread if everything kept: system 200 + u1 100 + a1 500 + u2 25 + a2 75 + u3 50 = **950**?  
  Wait: u1 400→100, a1 2000→500, u2 100→25, a2 300→75, u3 200→50 → 200+100+500+25+75+50 = **950** tokens.

So **`estTokensBefore ≈ 950`**, **`budget = 1024`** → **950 < 1024** → **not over budget**.

So in **this** scenario:

- **`overBudget` is false** → **no `summarizeTranscript` call**.
- You use **`dry.messages`** as **`payload`**.
- **`rawTurnCount` / `keptTurnCount`**: e.g. **3 / 3** turns (T0, T1, T2); nothing evicted.

That’s **Case B1** from the earlier flow.

---

### Step 2b — Dry pack still **over** budget **after** eviction (trigger summary)

Unpinned bulk alone often evicts away (e.g. huge **a1** in an unpinned turn disappears in the dry-run loop, so **`estTokensAfter ≤ budget`** → **Case B1**, no summarizer). To actually need **Case B2**, assume **pinned** fat rows so eviction cannot drop enough: e.g. **a2** is **15_000** chars (~3750 tok) **and pinned**, plus system + u2 + U3 so **`estTokensAfter` stays > 1024** even after unpinned **u1/a1** is evicted.

**`analyzeHistoryForSummary(internalMessages)`:**

- **`unpinnedTranscript`** = text built from **u1/a1 only** (u2/a2 are pinned → skipped in transcript, they go to `pinnedRows`).
- So summarizer input is basically “User: Q1 … Assistant: huge A1 …”.

**First LLM call:** `summarizeTranscript` → pretend it returns **400 chars** summary → **~100** tokens.

**`buildSummarizedInternalMessages`:**

1. system (still ~800 chars → 200 tok)  
2. one **user** row: `### Prior conversation (summarized)\n` + summary → say **450 chars** → **~113** tok  
3. pinned **u2, a2** verbatim → 25 + 75 = **100** tok  
4. Then `buildApiPayload` adds **new user U3** (50 tok) inside the same turn grouping.

Rough **post-summary** total before eviction:  
200 + 113 + 100 + 50 = **~463** tokens **well under 1024** → **no eviction loop needed** → e.g. **`keptTurnCount` / `rawTurnCount`** might look like **3 / 3** in the **second** pack (turns are **summary pseudo-turn**, **pin turn**, **current user turn** — exact counts follow `groupIntoTurns`, but idea is **small**).

---

### Step 3 — Second pack **still** tight (eviction after summary)

Pretend summary is **lazy** and returns **15_000 chars** (~3750 tok).  
Plus system 200 + pins 100 + U3 50 → **~4100** > 1024 → **eviction** runs on **unpinned** turn groups.

- **Pinned** u2/a2: **never** candidates.
- **Summary user message** + **system**: eviction loop in `buildApiPayload` works on **`working`** turn list; pinned turns skipped as victims. The **in-flight user** turn (U3 only) is protected from being the victim when it’s the last incomplete pair (see `i === lastIdx && t.user && !t.assistant`).

So victims tend to be **middle** low-score turns if any exist; with only [summary blob] + [pinned] + [U3], if **summary blob is one big user message** in one turn, it might be **one fat turn** — if it can’t all fit, you get **`clipped: true`** and warnings about still exceeding budget after eviction (your code warns if `estAfter > budget`).

So the UI can show something like **turns kept: 5 / 7** when you had **7** turn objects before trimming and **5** survived scored eviction — same mechanism, just with more turns than this toy example.

---

### Map labels to what you see

| Label | Meaning |
|--------|--------|
| **`estTokensBefore`** | Estimated tokens **before** eviction (dry run or final pack). |
| **`budget`** | `VITE_CONTEXT_TOKEN_BUDGET` (clamped in code). |
| **`overBudget` (summary branch)** | `dry.meta.estTokensAfter > dry.meta.budget` → packed size still over budget after eviction; then may summarize. |
| **`rawTurnCount` / `keptTurnCount`** | Turn groups **with `newUser` merged in** before vs after eviction. |
| **`clipped`** | Turn count dropped **or** estimate still over budget **or** post-eviction estimate still over budget. |

---

### One-line takeaway

**Summary path:** *measure with `dry` → if too big and there’s unpinned text, replace unpinned history with one summary block + pins → pack again (maybe evict again).*  
**Numbers above** show three situations: **under budget (no summary)**, **over budget (summary fixes it)**, **over budget after summary (eviction / clipped)**.