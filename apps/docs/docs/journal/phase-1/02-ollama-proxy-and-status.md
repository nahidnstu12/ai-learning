---
sidebar_position: 2
title: Ollama proxy ও status
---

# Ollama proxy ও status

Browser থেকে `http://127.0.0.1:11434` সরাসরি call করলে **CORS** block করতে পারে। Dev-এ সমাধান: browser → same origin (`/ollama`) → Vite proxy → Ollama। এই পেজে `vite.config.js`, `VITE_OLLAMA_URL`, `OllamaStatus`, `checkOllamaHealth`।

## ১. CLI vs browser

| পরিবেশ | URL | CORS |
|--------|-----|------|
| Node / `chat-cli` | `http://127.0.0.1:11434` | প্রযোজ্য নয় |
| Browser + Vite dev | `VITE_OLLAMA_URL=/ollama` | Proxy same-origin |

`.env.example`:

```env
VITE_OLLAMA_URL=/ollama
```

`ollamaClient.js` এ `baseURL` = env value; request যায় `/ollama/api/chat` → Vite rewrite করে Ollama-র `/api/chat`।

## ২. Vite proxy (সংক্ষিপ্ত)

```js
// vite.config.js
'/ollama': {
  target: 'http://127.0.0.1:11434',
  changeOrigin: true,
  rewrite: (path) => path.replace(/^\/ollama/, ''),
},
```

Groq-র জন্য আলাদা `/groq` proxy আছে — API key **Vite server** পড়ে, bundle-এ যায় না (`GROQ_API_KEY` in `.env`, not `VITE_*` for secrets)।

Production-এ সাধারণত নিজের backend proxy লাগে; dev pattern একই মানসিক মডেল।

## ৩. Health check

`OllamaStatus` mount-এ `checkOllamaHealth({ signal })` call করে:

- `GET /api/tags` → installed model names
- `modelConfig.js` এর configured ids (`VITE_MODEL_CHAT`, `VITE_MODEL_CHAT_OPTIONS`) এর সাথে match
- Missing হলে UI: `ollama pull <model>`

| UI state | মানে |
|----------|------|
| `Ollama: checking…` | request চলছে |
| `Ollama: OK — N model(s)` | reach + list |
| `Ollama: unreachable` | network / wrong `VITE_OLLAMA_URL` / Ollama down |

Unmount-এ `AbortController` cancel — duplicate setState এড়ায়।

## ৪. Dev logging

`import.meta.env.DEV` এ axios interceptor request/response console-এ log করে (`[ollama] GET …`)। Production build-এ বন্ধ।

> [!NOTE]
> Status bar **chat send** validate করে না — শুধু startup sanity। Send fail হলে stream error আলাদা path (*Streaming and stop*)।

**Boundary:** NDJSON parse, `messages[]` pack, context eviction — এখানে নেই।
