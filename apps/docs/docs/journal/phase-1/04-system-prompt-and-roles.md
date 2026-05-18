---
sidebar_position: 4
title: System prompt ও roles
---

# System prompt ও roles

Chat API-তে request মূলত **`messages[]`**: `{ role, content }` array। মডেলের “memory” নেই — যা array-তে যায় শুধু সেটাই জানে। এই পেজে `system` / `user` / `assistant`, `systemPrompt.js`, env override।

## ১. Roles

| Role | কাজ |
|------|-----|
| `system` | Policy / persona — সাধারণত একবার, প্রথমে |
| `user` | ব্যবহারকারীর input |
| `assistant` | মডেলের আগের উত্তর |

মাল্টি-টার্ন: প্রতি নতুন user message-এর আগে পুরো relevant history resend। দ্বিতীয় message-এ শুধু নতুন user পাঠালে মডেল আগের কথা “ভুলে” যায় — এটা bug নয়, contract।

## ২. Default system prompt

`src/components/chat/systemPrompt.js` — interview coach, **ছোট context budget**-এর জন্য tight rules (brevity, hard bans on filler)।

`useChatSession` initial state:

```js
{ id: uid(), role: 'system', content: SYSTEM_PROMPT }
```

UI transcript-এ system লুকানো (`visibleMessages` = `role !== 'system'`), কিন্তু API payload-এ system থাকে।

## ৩. Override (এখন কী কাজ করে)

Default শুধু `systemPrompt.js` এর hardcoded string। `.env.example`-এ `VITE_CHAT_SYSTEM_PROMPT` আছে, কিন্তু **app এখনো env পড়ে না** — comment/README অনুযায়ী ignored। বদলাতে হলে `SYSTEM_PROMPT` export edit করো (বা ভবিষ্যতে env wire করো)।

**Policy vs sampling:** একই প্রশ্নে ভিন্ন system prompt = ভিন্ন behavior; `temperature` personality ঠিক করে না — policy system-এ।

## ৪. Internal vs API shape

UI state row:

```js
{ id, role, content, pinned?, streaming?, contextContent?, meta? }
```

API-তে যায়:

```js
{ role, content }  // pin/compress পরে pack layer-এ প্রয়োগ
```

`apiMessages` = committed, non-streaming rows — context stats (`messageCount`, `charCount`) এর জন্য।

> [!TIP]
> প্রতিটি `fetch`/stream-এর আগে বলতে পারো `messages[]`-এ কী আছে — না পারলে UI scroll দেখে debug করছ, যা unreliable।

**Boundary:** Turn eviction, `contextContent` compression — *Context budget*, *Pins compression and summary*।
