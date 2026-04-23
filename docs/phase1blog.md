# Framework ছাড়া ChatGPT-এর মত Chat App বানানো — আমার AI Journey, Phase 1

*No LangChain. No OpenAI SDK. Just raw HTTP, Node.js, আর একটা locally running model.*

---

## শুরুতে একটা confession

AI/LLM-এর জগতে ঢুকবো বলে ঠিক করলাম। সবাই বলছে LangChain দিয়ে শুরু করো, OpenAI SDK install করো, দুই দিনে chatbot বানানো যায়।

কিন্তু আমার একটা সমস্যা আছে — **আমি না বুঝে কিছু use করতে পারি না।** Framework দিয়ে শুরু করলে আমি কখনো জানতে পারবো না actually নিচে কী হচ্ছে।

তুমি কি বলতে পারবে —

- `messages[]` এ ঠিক কী যায় যখন তুমি ChatGPT-তে message পাঠাও?
- মডেলের কি আসলেই memory আছে?
- Streaming মানে কি শুধু "text আসছে"? নাকি অন্য কিছু?
- Context window "fill up" হলে কী হয়?

আমিও জানতাম না। তাই ঠিক করলাম — **scratch থেকে একটা full chat app বানাবো**। CLI দিয়ে শুরু, তারপর browser, তারপর multi-provider support।

এই blog আমার **Phase 1** journey — যেখানে প্রতি step-এ আমি ধাক্কা খেয়েছি, আর প্রতি ধাক্কা আমাকে কিছু শিখিয়েছে।

Tutorial-driven, pain points সহ। চলো শুরু করি।

---

## Part 1: CLI দিয়ে শুরু — raw HTTP, no magic

প্রথমে একটা simple Node.js REPL বানালাম। User input → Ollama API → streamed response। Ekdom bare-bones, পঞ্চাশ লাইনের কম code।

প্রথম message পাঠালাম। Response আসলো। খুশি।
তারপর দ্বিতীয় message পাঠালাম। আর ধাক্কা খেলাম।

### ধাক্কা #১: মডেলের কোনো memory নেই

```js
// First call
fetch('/api/chat', {
  messages: [{ role: 'user', content: 'আমার নাম রহিম' }]
})
// Model: "হ্যালো রহিম!"

// Second call
fetch('/api/chat', {
  messages: [{ role: 'user', content: 'আমার নাম কী?' }]
})
// Model: "আমি জানি না 😶"
```

Wait — ChatGPT তো আমার আগের কথা মনে রাখে!

সত্যি কথা হচ্ছে: **ChatGPT-ও মনে রাখে না**। প্রতিবার পুরো history resend করা হয়। UI-তে দেখো শুধু তোমার নতুন message গেছে, কিন্তু behind the scenes পুরো transcript পাঠানো হচ্ছে।

সঠিক way:

```js
messages: [
  { role: 'system',    content: 'তুমি একজন helpful assistant' },
  { role: 'user',      content: 'আমার নাম রহিম' },
  { role: 'assistant', content: 'হ্যালো রহিম!' },
  { role: 'user',      content: 'আমার নাম কী?' }  // now model knows
]
```

> Chat একটা string না। এটা একটা **role-labeled transcript** — system, user, assistant। তুমি যা resend করবে, মডেল শুধু ওইটুকুই জানবে।

এই একটা realization আমার পুরো mental model change করে দিয়েছে।

### ধাক্কা #২: Streaming আসলে parsing, শুধু "text flow" না

Ollama যখন response stream করে, NDJSON chunks আসে:

```
{"message":{"content":"হ্যা"},"done":false}
{"message":{"content":"লো"},"done":false}
{"message":{"content":" রহিম!"},"done":true}
```

তুমি চাইলে অনেক কিছু ভাবতে পারো — কিন্তু realistically এটা একটা **parser + incremental state machine**:

- Buffer-এ data জমাও
- Line boundary খুঁজো
- প্রতিটা line JSON.parse করো
- `done: true` না আসা পর্যন্ত accumulate করো

এটা "text arriving" না। এটা **events, যেগুলো তুমি UI state-এ fold করো**।

### Part 1-এর biggest lesson

আমি system prompt নিয়ে experiment করলাম। একটা strict "interview coach" prompt দিলাম — "hard limits, no filler, answer শুরু হবে definition দিয়ে"। একই questions, different system prompt = **completely different model behavior**।

> System prompt হচ্ছে **policy**, personality না।

Bounded use case + tight system prompt > যেকোনো temperature/top_p tweak।

আর আমি নিজেকে একটা rule দিলাম:

> প্রতিটা `fetch()` call-এর আগে আমি ঠিক বলতে পারবো `messages[]`-এ কী আছে। না পারলে, আমি blind-এ debug করছি।

---

## Part 2: Browser-এ নিয়ে আসলাম — সব হঠাৎ harder হয়ে গেল

CLI কাজ করছে। ভাবলাম — "browser-এ বসাতে কতক্ষণ লাগবে? Just add a textarea, right?"

**না।** Browser অনেক কিছু hide করে দেয় যেগুলো CLI-তে obvious ছিল।

### সমস্যা #১: UI তোমাকে মিথ্যা বলবে

Browser chat-এ একটা long scrollable history আছে। দেখতে মনে হয় মডেল পুরো conversation "দেখছে"।

**আসলে না।** মডেল শুধু ওইটুকুই দেখে যা তুমি `messages[]`-এ pack করে পাঠিয়েছ। UI দেখাচ্ছে ৫০টা message, তুমি পাঠাচ্ছ শেষ ১০টা। এই **transcript vs. context** separation না বুঝলে তুমি weird bugs-এ হারাবে।

### সমস্যা #২: Stop button — it's not trivial

User একটা long answer generate করাচ্ছে, মাঝপথে stop করতে চাইলো। CLI-তে Ctrl+C; browser-এ?

```js
const controller = new AbortController()

fetch(url, { signal: controller.signal })

// user clicks stop
controller.abort()
```

কিন্তু এখানে partial text handling আছে, error state আছে ("stopped by user" vs. "network error"), UI cleanup আছে। "আধা-generated" message কি history-তে থাকবে? থাকলে কিভাবে mark করবো?

Simple মনে হয়েছিল। আসলে না।

### সমস্যা #৩: Metrics are part of the contract

CLI-তে নিজের চোখে দেখা যেত কতক্ষণ লাগছে। Browser-এ honest metrics track করতে হবে:

- **Time-to-first-token** (TTFT) — প্রথম chunk কতক্ষণে আসলো
- **Total stream duration** — পুরো response
- **Prompt tokens / response tokens**
- **`lastSentPayload` snapshot** — ঠিক কী ship হলো

এগুলো nice-to-have না। এগুলো **debugging oxygen**।

### Send pipeline — আমার core mental model

Browser-এ কাজ করতে গিয়ে বুঝলাম "one user message" মানে "append and fetch" না। পুরো একটা pipeline:

```
Guards → UI prep → Snapshot → Pack → Stream → Metrics → Error handling
```

প্রতিটা step একটা deliberate decision — **মডেল actually কী দেখবে**।

- **Guards**: empty input? message too long? route selected? — zero network call, fail fast
- **UI prep**: loading state, disable input
- **Snapshot**: internal history capture করো (before new message appended)
- **Pack**: token budget respect করে `messages[]` build করো (এই step-টা next section-এ deep dive)
- **Stream**: `AbortController`, chunk parsing, UI update
- **Metrics**: trace log
- **Error handling**: network, abort, API errors alada

CLI আমাকে শিখিয়েছে `messages[]` name করতে, কারণ আর কিছু ছিল না।
Browser আমাকে শিখিয়েছে name করতে, **কারণ UI চেষ্টা না করেই difference hide করে ফেলবে**।

---

## Part 3: Context Pipeline — যে জিনিস প্রায় সব tutorial skip করে

Chat app কিছুদিন use করার পর দেখলাম — weird behavior। পুরনো reference মডেল miss করছে। কখনো response slow। কখনো API error।

Cause? **Context window overflow।**

প্রতিটা LLM-এর একটা token budget — say, 4096 tokens or 8192 tokens। History বড় হয়ে গেলে তুমি budget ছাড়িয়ে যাবে।

Solution? Trim করো। **কিন্তু কিভাবে trim করবে সেটাই আসল engineering।**

### Pack step — concrete example

```
Token budget: 1024 tokens

─────────────────────────────
Scenario A:
History = 950 tokens
→ fits → no eviction → pack as-is ✅

─────────────────────────────
Scenario B:
History = 4100 tokens
→ over budget
→ Score-based eviction (recency, length, pinned status)
→ Drop oldest unpinned turns
→ Still over? → Summarize evicted portion via second LLM call
→ Re-pack → 463 tokens ✅
```

### Key concepts

**→ Token estimation:** `chars ÷ 4` rough estimate. Perfect না, কিন্তু pack decision-এর জন্য যথেষ্ট।

**→ Turn-level eviction:** Random individual messages drop কোরো না। পুরো **turn** (user + corresponding assistant response) একসাথে drop করো। না হলে context weird broken feel হবে।

**→ Pinned turns:** User কিছু message "pin" করতে পারে (important context)। এগুলো কখনো evict হবে না।

**→ Scored eviction:** Score = weighted(recency, length, pinned) — lowest score first to evict।

**→ Summarization fallback:** Eviction-এর পরেও fit না করলে, একটা second LLM call summary বানায়, সেই summary pack-এ যায়।

Debug panel-এ "Turns kept: 5/7" দেখা গেলে সেটা magic না। **Deterministic, scored eviction**, working exactly as designed।

> মডেল তোমার full transcript কখনো দেখে না। সে শুধু ওইটুকুই দেখে **যা তোমার pipeline decide করেছে সে afford করতে পারবে**।

---

## Part 4: দুইটা Provider, একটা Client — Abstraction-এর real meaning

Web chat ready। এখন একটা real-world question — production apps কিভাবে multiple LLM providers handle করে without code duplication?

Curiosity থেকে Groq add করলাম Ollama-র পাশে।

### Providers stream differently

- **Ollama** → NDJSON lines: `{"message":{"content":"..."},"done":false}\n`
- **Groq** → SSE frames: `data: {"choices":[{"delta":{"content":"..."}}]}\n\n`

যদি এই difference UI-তে leak করে, disaster। তাই একটা **streaming façade** বানালাম।

### One interface, two transports

```js
// UI calls this — doesn't know or care which provider
await streamCompletion({
  route: 'groq:llama-3.3-70b',     // or 'localllm:llama3.1:8b'
  messages,
  onChunk: (text) => updateUI(text),
  signal: controller.signal,
})
```

Underneath:

- **Route registry**: `'groq:llama-3.3-70b'` → `{ baseURL, auth, parser: 'sse', model }`
- **Same `messages[]` shape** — system/user/assistant never changes per provider
- **`AbortController` provider-agnostic** — cancels HTTP read, not "Ollama loop" or "Groq loop"
- **API keys stay server-side** — Vite dev proxy proxies Groq calls with Authorization header, browser কখনো key দেখে না (no `VITE_*` key leakage)

### Sharp caveat — abstraction-এর truth

> Abstraction **erase complexity** করে না। **Localize** করে।

Token accounting, rate limits, JSON mode, tool calling — এই provider differences কখনো disappear হবে না। তুমি pretend করলেও leak করবে। Abstraction-এর আসল win হচ্ছে — **ওই leaks গুলো এক জায়গায় patch করা যায়**।

### Benchmark আমি নিজেকে দিয়েছিলাম

Switch route → inspect `lastSentPayload` → **same packed `messages[]`, different wire**।

যদি অন্য কিছু change হয় (UI flicker, extra field, different error shape reaching UI), abstraction leaked। Go fix it।

---

## Phase 1 summary — ৬টা lesson যা সব chat app-এ apply হয়

1. **`messages[]` হচ্ছে the contract** — framework/wrapper যাই use করো, end of the day এটাই মডেলে পৌঁছায়। না বুঝলে blind
2. **System prompt = policy, temperature ≠ personality** — heavy lifting system prompt করে
3. **Streaming = state machine, not "text arriving"** — events, parsed, folded into UI state
4. **UI ≠ context** — browser-এ যা দেখ সেটা আর মডেল যা দেখে সেটা দুইটা আলাদা জিনিস, সবসময়
5. **Pack pipeline is everywhere** — ChatGPT, Claude, সব chat app এটা করে। তুমি না দেখলেও behind the scenes চলছে
6. **Abstraction localizes complexity, doesn't erase it** — ভালো abstraction মানে complexity কোথায় থাকবে সেটা control করা

---

## `lastSentPayload` — আমার debugging oxygen

পুরো Phase 1-এ একটা rule ছিল:

> `lastSentPayload` **must be inspectable**, always।

মানে প্রতিটা send-এর পর আমি debug panel-এ দেখতে পারি — ঠিক কী `messages[]` শেষ request-এ গেছে। Full content, roles, order, সব।

এটা না থাকলে তুমি guess করছ। Guess করে LLM app debug করা impossible। Eviction unexpectedly কিছু drop করলো? Pin ঠিকমত কাজ করছে? Summary আসলেই inject হলো?

**`lastSentPayload` দেখলে তুমি জানবে। না দেখলে তুমি পাগল হবে।**

---

## Phase 2 coming — Embeddings, Vector DB, RAG

এতদিন মডেল শুধু ওইটুকুই জানে যা `messages[]`-এ আছে। কিন্তু actual production use case-এ তুমি চাও:

- তোমার PDFs থেকে answer আসুক
- তোমার company docs থেকে quote আসুক
- Dynamic knowledge base-এ search হয়ে relevant context inject হোক

Welcome to **RAG (Retrieval-Augmented Generation)**।

Phase 2-এ আমরা pgvector নিয়ে কাজ করবো — embeddings কী, vector similarity কিভাবে কাজ করে, retrieval pipeline, আর সেটাকে এই chat app-এ plug করা।

---

### Final note

যদি তুমি AI learning journey-তে আছ এবং framework-dependency থেকে বের হয়ে actually কী হচ্ছে বুঝতে চাও — এই series follow কোরো। প্রতিটা phase concrete code + honest pain points সহ।

পরের পর্বে দেখা হচ্ছে। 🧠

---

*#LLM #Ollama #Groq #RAG #AI #LearningInPublic #Bangla #DevJourney*
