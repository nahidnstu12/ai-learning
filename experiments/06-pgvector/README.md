# 06 — pgvector + Ollama embeddings

Stores `documents` and `document_chunks` with `vector(768)` (Ollama `nomic-embed-text`). Uses cosine distance (`<=>`) and an HNSW index.

## Prereqs

1. **Postgres + pgvector** on port `5433` (see `docker/pg/docker-compose.yml` → `postgresql-vector`).
2. **Ollama** running with `nomic-embed-text` pulled: `ollama pull nomic-embed-text`.

## Setup

```bash
cd experiments/06-pgvector
cp .env.example .env
# edit .env if your password/host/port differ
npm install
npm run schema
npm run demo
```

`npm run demo` inserts two small docs, runs a similarity search, lists rows, then deletes the first doc (chunks cascade).

## Files

| File | Purpose |
|------|---------|
| `schema.sql` | Extension, tables, HNSW index |
| `embed.js` | Ollama `/api/embeddings` |
| `db.js` | `pg` pool + vector literal helper |
| `crud.js` | Insert multi-chunk doc, search, list, delete |
| `scripts/apply-schema.mjs` | Apply `schema.sql` via `DATABASE_URL` |

## Connection URL (typical)

`postgresql://admin:password@localhost:5433/ai_learning`

## Switching embedding models

Change `OLLAMA_EMBED_MODEL` and **alter** `document_chunks.embedding` column dimension in SQL to match the new model (or new table / migration).
