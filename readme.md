# ai-learning

Local-first playground for learning LLM apps: Ollama, prompting, tools, RAG, embeddings.

## Layout

```
ai-learning/
├── docker-compose.yml     # Ollama → ./models
├── .env.example           # copy to .env
├── models/                # Ollama data (volume)
├── apps/
│   ├── chat-cli/          # thin Node client — start here
│   └── api-server/        # add later for HTTP/UI
├── experiments/           # numbered steps (01 → 05)
├── notebooks/             # optional Jupyter
├── data/raw|processed/    # datasets (heavy stuff gitignored)
├── prompts/               # versioned system / few-shot text
└── docs/notes.md          # what worked, params, models
```

## Learning path (order)

| Step | Folder | Focus |
|------|--------|--------|
| 1 | `experiments/01-prompting` | Ollama chat, params, logging |
| 2 | `02-tools-function-calling` | tool schemas, parse, round-trip |
| 3 | `03-rag-chunking` | chunk, embed, retrieve, cite |
| 4 | `04-embeddings-similarity` | similarity, failure modes |
| 5 | `05-fine-tuning-or-lora` | optional, only if needed |

Implement scripts in each `experiments/NN-*` folder; reuse patterns from `apps/chat-cli` when it makes sense.

## Quick start

```bash
cp .env.example .env
docker compose up -d
ollama pull llama3.2   # or pull inside container: docker exec -it <ollama> ollama pull llama3.2
cd apps/chat-cli && node index.js
```

If Ollama runs on the host instead of Docker, point `OLLAMA_HOST` in `.env` accordingly.
