# chat-cli

Minimal Node client for Ollama. Use for steps 01+; keep this app thin and put one-off tries under `experiments/`.

```bash
cp ../../.env.example ../../.env
# docker compose up -d   # from repo root, if using compose
# ollama pull llama3.2
npm install   # no deps yet; safe to run for future packages
node index.js
```
