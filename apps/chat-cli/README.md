# chat-cli

Minimal Node client for Ollama. Use for steps 01+; keep this app thin and put one-off tries under `experiments/`.

**Env:** put `OLLAMA_HOST`, `MODEL_CHAT`, etc. in **repo root** `ai-learning/.env` (copy from `.env.example`). `index.js` loads that file via `dotenv` — not `apps/chat-cli/.env`.

```bash
cp ../../.env.example ../../.env
# edit ../../.env — e.g. MODEL_CHAT=phi3
# docker compose up -d   # from repo root, if using compose
npm install
npm start
# or: node index.js
```
