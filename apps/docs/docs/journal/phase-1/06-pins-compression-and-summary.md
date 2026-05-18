---
sidebar_position: 6
title: Pins, compression, summary
---

# Pins, compression, ও history summary

তিনটা আলাদা লেয়ার — একই “context ছোট করো” লক্ষ্য, ভিন্ন trigger:

1. **Pin** — turn evict হয় না  
2. **Assistant compression** — দীর্ঘ reply API-তে ছোট representation  
3. **History summary** — budget ছাড়ালে unpinned history এক LLM call-এ bullet summary  

## ১. Pin

Transcript-এ pin toggle → `message.pinned = true`। `buildApiPayload`-এ pinned turn-এর `scoreTurn` = ∞।

Pinned rows summary path-এ **verbatim** থাকে; `contextContent` strip (`summarizeHistory.js`).

## ২. Assistant compression (inline)

UI-তে full `content` থাকে। API-তে `effectiveAssistantApiContent`:

- `contextContent` set থাকলে সেটা ব্যবহার  
- নাহলে length ≥ `assistantContextCompressMinChars` (3500) হলে head + `… [N chars omitted] …` + tail  

Stream শেষে `maybeAssistantContextContentFields(fullText)` নতুন assistant row-এ `contextContent` set করতে পারে।

## ৩. History summary (optional)

`.env`:

```env
VITE_ENABLE_HISTORY_SUMMARY=1
VITE_SUMMARY_NUM_PREDICT=1024
```

`useChatSession.send` flow:

1. `buildApiPayload` dry run → `estTokensAfter` vs budget  
2. Over budget + unpinned transcript থাকলে → `summarizeTranscript` (extra `streamCompletion`)  
3. `buildSummarizedInternalMessages` — একটা synthetic `user` message: summary text  
4. আবার `buildApiPayload` with `historySummaryApplied: true`

Summarizer system prompt: dense bullets, facts preserve, no preamble (`SUMMARY_SYSTEM` in `summarizeHistory.js`).

Pipeline report `stages.summary.status`: `applied` | `skipped`.

## ৪. কখন কী

| সমস্যা | প্রথমে চেক |
|---------|------------|
| গুরুত্বপূর্ণ turn হারিয়ে যায় | Pin আছে কিনা |
| দীর্ঘ code answer context খায় | Compression + eviction score |
| অনেক পুরনো turn, budget ছাড়ায় | Summary on + eviction report |

> [!NOTE]
> Summary = **অতিরিক্ত LLM call** শুধু over-budget send-এ; প্রতিটি message-এ নয়। Abort করলে summarizer-ও `AbortController` দিয়ে বাতিল।

**Boundary:** Groq vs Ollama wire format — proxy/stream পেজ; vector RAG — Phase 2।
