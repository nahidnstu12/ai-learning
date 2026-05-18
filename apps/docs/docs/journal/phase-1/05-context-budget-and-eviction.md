---
sidebar_position: 5
title: Context budget ও eviction
---

# Context budget ও eviction

LLM-এর **context window** সীমিত। UI-তে পুরো transcript থাকতে পারে; wire-এ যায় `buildApiPayload` যা budget মেনে **turn-level eviction** করে। ফাইল: `buildApiPayload.js`, `chatConstraints.js`.

## ১. Token budget

Heuristic: `estimateTokensForText(s) ≈ ceil(s.length / 4)`।

Budget: `CHAT_CONSTRAINTS.maxContextTokenBudget` — default `8192`, override:

```env
VITE_CONTEXT_TOKEN_BUDGET=4096
```

Pack-এর আগে estimated tokens > budget হলে eviction loop চলে।

## ২. Turn, not random message

`groupIntoTurns` — `user` + পরের `assistant` এক **turn**। Evict করলে পুরো turn সরে; শুধু assistant রেখে user ফেলা হয় না (weird context এড়াতে)।

Exception: শেষ turn যদি শুধু নতুন `user` (assistant এখনো নেই) — সেটা victim হিসেবে বাদ।

## ৩. Scored eviction

`scoreTurn(t, turnIndex, totalTurns)` — **নিম্ন score = আগে evict** (sort ascending):

| Signal | Score effect |
|--------|----------------|
| `pinned` | `+Infinity` — evict হয় না |
| Recent (index > 70% of turns) | +50 |
| Code fence in text | +30 |
| Long user/assistant (>500 chars) | +10 |
| Has user message | +5 |

Loop: budget ঠিক না হওয়া পর্যন্ত lowest-scoring unpinned turn remove (`removedTurnIds` log)।

## ৪. Output

`flattenToOllama(system, workingTurns)` → `{ role, content }[]` যা `streamCompletion`-এ যায়।

`clipped: true` যখন কিছু turn dropped বা estimate এখনও budget ছাড়িয়ে (pinned / এক বিশাল message)।

Toolbar warning + modal: “Last request omitted older messages…” — **UI transcript অপরিবর্তিত**।

> [!TIP]
> `VITE_CONTEXT_TOKEN_BUDGET` কমিয়ে dev-এ eviction দ্রুত trigger করো; তারপর *Pipeline debug* modal-এ `keptTurnCount` / `removedTurnIds` মিলাও।

**Boundary:** Pre-pack summarizer (`VITE_ENABLE_HISTORY_SUMMARY`) — *Pins compression and summary*। RAG / embeddings — Phase 2।
