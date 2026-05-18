---
sidebar_position: 1
title: App shell ও কেন web
---

# App shell ও কেন web chat

এই পেজে `apps/chat-web` এর **layout shell** — React entry, `App.jsx`, আর chat UI-র component tree। ধরে নিচ্ছি Node/Bun আছে, repo root থেকে `apps/chat-web` এ `bun install` ও `bun run dev` চালু।

## ১. Entry থেকে shell

`index.html` → `src/main.jsx` → `App.jsx`। `App.jsx` দুইটা top-level block রাখে:

| অংশ | ফাইল | কাজ |
|------|------|-----|
| Health strip | `OllamaStatus.jsx` | Ollama reachable কিনা, configured model আছে কিনা |
| Chat UI | `components/chat/Chat.jsx` | Transcript, composer, toolbar, context modal |

```jsx
// src/App.jsx (সংক্ষিপ্ত)
<div className="app-shell">
  <OllamaStatus />
  <Chat />
</div>
```

CLI (`chat-cli`) একই API ধারণা test করে; browser UI **transcript vs API payload** আলাদা রাখতে সাহায্য করে — সেটা পরের পেজগুলোতে।

## ২. Chat shell — presentational vs logic

`Chat.jsx` নিজে fetch করে না। `useChatSession()` hook থেকে state আর handlers নিয়ে child-গুলোতে pass করে:

- `ChatToolbar` — route select, context stats, “View context”
- `ChatTranscript` — user/assistant bubbles, pin toggle
- `ChatComposer` — textarea, Send / Stop
- `ChatContextModal` — শেষ request-এ যা গেছে (`lastSentPayload`)

একটা **send** মানে শুধু textarea append নয় — guard → pack → stream → metrics; pipeline বিস্তারিত আলাদা পেজে (*Pipeline debug and metrics*)।

## ৩. কেন web (CLI-র পর)

| CLI | Browser |
|-----|---------|
| সরাসরি `http://127.0.0.1:11434` — CORS নেই | Same-origin চাই; dev-এ Vite **proxy** |
| Scrollback = terminal history | UI দীর্ঘ transcript দেখায় — মডেল সব দেখে না |
| Ctrl+C = abort | `AbortController` + partial assistant row |

Web layer মূলত **observability + UX**: pin, context modal, route switcher — logic `src/lib/` ও `useChatSession.js` এ।

## ৪. Dev চালানো

```bash
cd apps/chat-web
cp .env.example .env   # VITE_OLLAMA_URL=/ollama
bun run dev
```

Browser: Vite default port (সাধারণত `5173`)। Ollama আলাদা process (`ollama serve` বা Docker)।

> [!TIP]
> UI-তে যত message দেখো, API-তে যায় তার subset — সবসময় **Last request** modal বা `lastSentPayload` দিয়ে verify করো; অনুমান করো না।

**Boundary:** Vite proxy, Groq route, streaming parser — এই পেজে নেই (*Ollama proxy and status*, *Streaming and stop*)।
