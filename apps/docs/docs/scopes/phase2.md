# Phase 2 — Embeddings, pgvector & RAG: scopes & checkpoints

**Goal:** Understand how **meaning** is represented as vectors, store and search them in **PostgreSQL + pgvector**, and wire **retrieval-augmented generation** so answers come from *your* documents—with citations, thresholds, and honest “not in context” behavior.

**Duration:** ~3 weeks (suggested pacing)

**Stack:** Docker · Ollama · PostgreSQL + pgvector · Node.js · (optional) LangChain.js

---

## Phase map

| Week | Focus | Intended outcome |
| ---- | ----- | ---------------- |
| 1 | Embeddings & similarity | Text → vectors via Ollama; cosine similarity in JS; naive in-memory top-K; chunking and batch embed |
| 2 | pgvector in Postgres | Schema, `vector` type, HNSW index, semantic SQL (`<=>`), filters + bulk ingest from Node |
| 3 | RAG end-to-end | Retrieve → prompt → stream; similarity threshold; optional hybrid search; PDF Q&A capstone with sources |

---

## Learning scopes (what Phase 2 is *about*)

These are the **themes** you should tie to concrete behavior (SQL, prompts, and UX).

### A. Embeddings & geometry

- **Vectors from text** — same Ollama host as Phase 1, different endpoint (`/api/embeddings`); model choice fixes dimensionality (e.g. 768 for `nomic-embed-text`).
- **Similarity** — cosine as angle vs magnitude; mapping to pgvector operators (`<=>`, `<->`, `<#>`) and why cosine is the default for text.
- **Naive retrieval** — embed query, score all candidates in memory before you trust the database index.

**Checkpoint:** You can explain why “semantic” search can match *meaning* without shared keywords, and how that differs from `LIKE` or raw FTS.

### B. Chunking & ingestion

- **Why chunk** — context limits, precision, and retrieval noise when a document is one blob vs many passages.
- **Strategies** — fixed windows, sentence/paragraph-aware splits, overlap across boundaries.
- **Ingestion path** — normalize → chunk → embed with bounded concurrency → upsert rows; re-ingest deletes or versioning.

**Checkpoint:** You can name one failure mode from chunks that are too large vs too small, and one mitigation (size, overlap, or section-aware split).

### C. pgvector storage & indexes

- **Schema** — documents vs chunks; FK + `ON DELETE CASCADE`; denormalized `source` for fast filters.
- **ANN indexes** — HNSW vs IVFFlat; build after bulk load when possible; `ef_search` recall vs latency.
- **SQL discipline** — `ORDER BY` raw distance; use similarity derived columns for display and `WHERE` thresholds.

**Checkpoint:** You can read an `EXPLAIN (ANALYZE)` and tell whether the HNSW index is used and whether dimensions match the embedding model.

### D. RAG assembly & guardrails

- **Retrieve → pack → generate** — system instructions that forbid fabrication; context blocks with source labels.
- **Thresholds** — empty or weak retrieval must not become “guess from priors”; streaming UX matches Phase 1 lifecycle ideas.
- **Citations** — surface which chunks drove the answer; keep chunk metadata (page, section) when available.

**Checkpoint:** You can trace one question from embed-query through SQL top-K to the final streamed assistant message, including the “no chunks” path.

### E. Hybrid search & production tradeoffs

- **Hybrid retrieval** — combine vector similarity with keyword/FTS for SKUs, codes, and exact phrases.
- **Failure modes** — wrong chunks, prompt leakage, index not used, slow ingest; **pgvector vs dedicated vector DB** when your data is already relational.
- **Optional tooling** — LangChain.js **after** you understand raw SQL, not instead of it.

**Checkpoint:** You can give one example where hybrid beats pure semantic search, and one RAG failure mode with its fix.

---

## Checkpoints (ordered path)

Use this as a **progress ladder**, not a day-by-day script.

| # | Checkpoint | Shows you’ve learned |
| --- | --- | --- |
| 1 | Embedding model pulled; first `/api/embeddings` call | Environment + JSON shape of a vector |
| 2 | Cosine similarity in JS + in-memory top-K | Same math you will later push into SQL |
| 3 | Two chunking strategies + batch embed with concurrency | Ingestion is an engineering problem, not a single API call |
| 4 | Postgres + `pgvector`; schema + HNSW | Vectors as a column type; index-backed ANN |
| 5 | Insert + `ORDER BY embedding <=> $vec` + metadata `WHERE` | One query joins relational filters with semantic sort |
| 6 | Bulk document ingest (upsert doc, replace chunks) | Scale path for many chunks per file |
| 7 | RAG path: retrieve → `buildRAGPrompt` → streaming `/api/chat` | End-to-end wiring to Phase 1 chat semantics |
| 8 | `minSimilarity` / empty retrieval → honest refusal | Guards against context-free hallucination |
| 9 | Optional **hybrid** (semantic + FTS) query | When keywords matter as much as paraphrases |
| 10 | **PDF Q&A** (or equivalent): upload, ingest, chat UI, cited answers | Ships a minimal product-shaped loop |

---

## Baseline Phase 2 deliverable vs extras

### Baseline (core scope)

- **Embeddings lab** — Ollama embeddings, cosine in JS, naive semantic search, chunking, batching.
- **pgvector** — Dockerized Postgres, init schema, HNSW, Node client (`postgres` package), semantic retrieval with thresholds.
- **RAG** — prompt template with context + rules, streaming answers, explicit sources, refusal when retrieval is empty/weak.
- **Capstone** — document ingestion + Q&A (PDF path in the supplementary material is the reference shape).

### Extras (stretch / roadmap-aligned)

| Extra | Learning intent |
| ----- | ---------------- |
| **Hybrid search** | Blend semantic ANN with Postgres FTS for codes, names, and exact tokens. |
| **HNSW tuning** | `ef_search`, build params, recall vs latency tradeoffs, `EXPLAIN` hygiene. |
| **SQL analytics** | Aggregations over chunks, storage sizing, ingest hygiene—things awkward in pure vector stores. |
| **LangChain.js + PGVectorStore** | Faster scaffolding once raw SQL is legible; compare transparency vs velocity. |
| **Exercise grid** | Operator comparison, chunking A/B, hallucination probes—see supplementary section. |

**Note:** Treat **manual SQL + explicit retrieval** as the source of truth for this phase; frameworks are optional accelerators, not substitutes for understanding.

---

## Completion checklist (outcomes)

### Environment

- Ollama serves an embedding model; Postgres runs with `vector` enabled and reachable from your app
- One repeatable ingest path (file or API) produces rows in `documents` / `document_chunks`

### Core skills

- Embeddings requested and parsed; cosine (or equivalent) computed in JS *and* expressed in SQL
- Chunking is intentional; ingest uses bounded concurrency
- Retrieval uses index-friendly `ORDER BY`; optional `WHERE` thresholds filter junk similarity
- RAG prompts forbid invention when context is missing; streaming path mirrors Phase 1 ideas

### Concepts (explain without looking at notes)

- Why chunk size and overlap affect answer quality
- Cosine distance vs L2 vs inner product—when pgvector’s `<=>` is the right default
- Why “wrong answer with good docs” is often a prompt or `topK` problem, not only retrieval

### Shipped artifacts (pick what matches your path)

- Runnable ingest + query **or** full **PDF Q&A** mini-app with upload, list, delete, and cited chat

---

## Toward Phase 3

Phase 2 stops at **retrieval + generation over a static corpus**. Phase 3 typically layers **agents, tools, and live data** (e.g. bookings and user state) on top of the same Postgres world—vectors and relational rows in one place.

---

## Supplementary material (labs, code, exercises)

The sections below walk **week-by-week** implementation detail, copy-paste samples, and experiments. They support the scopes and checkpoints above; they are **not** a separate phase.

---

### The big idea (read this first)

In Phase 1, you talked to a model using text. The model's "knowledge" was baked in at training time — it can't know about your documents, your company data, or anything that happened after its training cutoff.

**RAG solves this.** Instead of hoping the model knows the answer, you:

1. **Pre-process** your documents → chunk → embed → store in PostgreSQL with pgvector
2. At query time → embed the user's question → SQL query finds the most similar chunks
3. **Inject** those chunks into the LLM prompt → accurate answer with real sources

```
Without RAG:  "What is our refund policy?" → ❌ Model guesses or hallucinates
With RAG:     "What is our refund policy?" → vector search → inject context → ✅ Accurate + cited
```

**Why pgvector over a dedicated vector DB (ChromaDB, Pinecone, Qdrant)?**

Because your data doesn't live in a vacuum. Your booking agent (Phase 3) will have a `bookings` table, a `users` table, and document embeddings — all in one database. With pgvector you can write queries like:

```sql
-- Find relevant policy chunks, but only for policies updated this year
SELECT content, source, 1 - (embedding <=> $1) AS similarity
FROM document_chunks
WHERE updated_at > NOW() - INTERVAL '1 year'
ORDER BY embedding <=> $1
LIMIT 5;
```

That's a semantic search *combined with a time filter* — impossible in a pure vector DB without extra plumbing. This is the production-grade pattern.

---

### Week 1 — Embeddings deep dive

#### Day 1–2: What Are Embeddings?

##### The Core Concept

An **embedding** is a list of numbers (a vector) that represents the *meaning* of a piece of text. Similar meanings → similar numbers. That's the whole idea.

```
"I love dogs"         → [0.21, -0.54, 0.83, 0.12, ...]  (768 numbers)
"I adore puppies"     → [0.22, -0.51, 0.81, 0.14, ...]  (very similar!)
"The stock market"    → [-0.43, 0.91, -0.22, 0.67, ...]  (very different)
```

The numbers themselves mean nothing to humans. What matters is the **distance** between vectors — close = similar meaning, far = different meaning.

##### Why 768 Dimensions?

Each dimension represents some abstract "feature" of meaning that the model learned during training. Nobody designed these features — the model discovered them. Think of dimensions like:

- Dimension 47 might capture "animal-ness"
- Dimension 203 might capture "positive sentiment"
- Dimension 891 might capture "technical jargon level"

But in reality they're entangled and non-interpretable. The key insight: **the model learned to encode meaning as geometry.**

> 💡 `nomic-embed-text` (our local model) produces 768-dimensional vectors. OpenAI's `text-embedding-3-small` produces 1536. More dimensions ≠ always better — it means more storage and slower queries. 768 is excellent for local use.

---

##### Step 1: Pull the Embedding Model

```bash
# nomic-embed-text — best local embedding model, fast on CPU
docker exec -it ollama ollama pull nomic-embed-text

# Alternative: mxbai-embed-large (higher quality, slower, 1024 dims)
docker exec -it ollama ollama pull mxbai-embed-large
```

> 💡 **Why a separate model?** Embedding models are trained differently from chat models. They're optimized to produce vectors where distance = semantic similarity. Chat models produce good text; embedding models produce good vectors. Don't mix them up.

---

##### Step 2: Generate Your First Embedding

```javascript
// embeddings/basics.js
const OLLAMA_URL = 'http://localhost:11434'

async function embed(text) {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'nomic-embed-text',
      prompt: text
    })
  })
  const data = await res.json()
  return data.embedding  // Array of 768 floats
}

const vec = await embed('JavaScript is a programming language')
console.log(`Vector dimensions: ${vec.length}`)    // 768
console.log(`First 5 values: ${vec.slice(0, 5)}`)  // [ 0.021, -0.543, ... ]
```

---

#### Day 3: Cosine Similarity — The Math Behind Semantic Search

This is the most important concept in this entire phase. Understand this and everything else clicks.

##### What is Cosine Similarity?

It measures the **angle** between two vectors, not the distance. If vectors point in the same direction → angle is 0° → similarity is 1.0. If they point opposite ways → angle is 180° → similarity is -1.0.

```
cosine_similarity = (A · B) / (|A| × |B|)
```

Where `A · B` is the dot product and `|A|` is the magnitude (length) of vector A.

```javascript
// math/cosine.js
function dotProduct(a, b) {
  return a.reduce((sum, val, i) => sum + val * b[i], 0)
}

function magnitude(vec) {
  return Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0))
}

function cosineSimilarity(a, b) {
  if (a.length !== b.length) throw new Error('Vectors must be same length')
  return dotProduct(a, b) / (magnitude(a) * magnitude(b))
}

// Test it
const vec1 = await embed('I love dogs')
const vec2 = await embed('I adore puppies')
const vec3 = await embed('The Federal Reserve raised interest rates')

console.log(cosineSimilarity(vec1, vec2).toFixed(3))  // ~0.92 — very similar
console.log(cosineSimilarity(vec1, vec3).toFixed(3))  // ~0.31 — very different
```

##### pgvector Distance Operators vs JS Similarity

When you move to pgvector, the same math is expressed differently in SQL. Know the mapping:

| pgvector Operator | Name | Formula | Returns | JS Equivalent |
|---|---|---|---|---|
| `<=>` | Cosine distance | `1 - cosine_similarity` | 0.0 (identical) → 2.0 (opposite) | `1 - cosineSimilarity(a, b)` |
| `<->` | L2 / Euclidean distance | `sqrt(sum((a-b)²))` | 0.0 → ∞ | `Math.sqrt(sum of squared diffs)` |
| `<#>` | Negative inner product | `-(a · b)` | Most negative = most similar | `-dotProduct(a, b)` |

**Use `<=>` (cosine) for text.** It handles vectors of different magnitudes gracefully, which matters since embedding magnitudes vary by text length.

```sql
-- cosine DISTANCE (lower = more similar)
SELECT 1 - (embedding <=> '[0.21, -0.54, ...]'::vector) AS similarity
FROM document_chunks
ORDER BY embedding <=> '[0.21, -0.54, ...]'::vector
LIMIT 5;
```

##### Similarity Score Interpretation

| Score | Meaning |
|-------|---------|
| 0.95 – 1.0 | Near-identical meaning (paraphrases) |
| 0.85 – 0.95 | Very similar topic |
| 0.70 – 0.85 | Related topic |
| 0.50 – 0.70 | Loosely related |
| < 0.50 | Essentially unrelated |

---

##### Step 3: Build a Simple Semantic Search (No DB Yet)

```javascript
// semantic-search/naive.js
const documents = [
  "JavaScript is a dynamic programming language for the web",
  "Python is great for data science and machine learning",
  "Docker containers help isolate application environments",
  "React is a JavaScript library for building user interfaces",
  "PostgreSQL is a powerful open-source relational database",
  "Machine learning models learn patterns from training data",
  "CSS is used to style HTML elements on web pages",
  "Node.js allows JavaScript to run on the server side",
]

console.log('Embedding documents...')
const docEmbeddings = await Promise.all(
  documents.map(async (doc, i) => ({
    id: i,
    text: doc,
    embedding: await embed(doc)
  }))
)

async function search(query, topK = 3) {
  const queryEmbedding = await embed(query)

  const scored = docEmbeddings.map(doc => ({
    ...doc,
    score: cosineSimilarity(queryEmbedding, doc.embedding)
  }))

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

const results = await search('how do I run code on the server?')
results.forEach(r => console.log(`[${r.score.toFixed(3)}] ${r.text}`))
// [0.891] Node.js allows JavaScript to run on the server side
// [0.743] JavaScript is a dynamic programming language for the web
```

> 🔑 **Key insight:** The query "how do I run code on the server?" shares no words with "Node.js allows JavaScript to run on the server side" — but embeddings find it because the *meaning* is the same. This is semantic search. Postgres will do this same operation with `<=>` at scale.

---

#### Day 4: Chunking — The Hidden Critical Skill

Chunking is how you split large documents into pieces small enough to embed but large enough to be meaningful. Get this wrong and your RAG system will give bad answers even with good embeddings and a perfect DB.

##### Why Not Just Embed the Whole Document?

```
Problem 1: Token limits — nomic-embed-text max is 8192 tokens (~6000 words)
Problem 2: Precision loss — a 50-page doc embedded as one vector loses specific detail
Problem 3: Retrieval noise — you retrieve too much irrelevant content at once
```

##### The 3 Chunking Strategies

**Strategy 1: Fixed Size (Naive)**
```javascript
function chunkFixed(text, chunkSize = 500, overlap = 50) {
  const chunks = []
  let start = 0
  while (start < text.length) {
    chunks.push(text.slice(start, start + chunkSize))
    start += chunkSize - overlap
  }
  return chunks
}
```

**Strategy 2: By Sentence (Better)**
```javascript
function chunkBySentence(text, maxChunkSize = 500) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  const chunks = []
  let current = ''

  for (const sentence of sentences) {
    if ((current + sentence).length > maxChunkSize && current) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current += ' ' + sentence
    }
  }
  if (current.trim()) chunks.push(current.trim())
  return chunks
}
```

**Strategy 3: Smart Paragraph-Aware (Best for production)**
```javascript
function smartChunk(text, targetSize = 400, overlap = 80) {
  text = text.replace(/\s+/g, ' ').trim()
  const paragraphs = text.split(/\n{2,}/)
  const chunks = []
  let buffer = ''

  for (const para of paragraphs) {
    const candidate = buffer ? buffer + '\n\n' + para : para

    if (candidate.length <= targetSize) {
      buffer = candidate
    } else {
      if (buffer) {
        chunks.push(buffer.trim())
        buffer = buffer.slice(-overlap) + '\n\n' + para
      } else {
        // Single paragraph too large — split by sentences
        const sentences = para.match(/[^.!?]+[.!?]+/g) || [para]
        for (const s of sentences) {
          if ((buffer + s).length > targetSize && buffer) {
            chunks.push(buffer.trim())
            buffer = buffer.slice(-overlap) + ' ' + s
          } else {
            buffer += (buffer ? ' ' : '') + s
          }
        }
      }
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim())
  return chunks.filter(c => c.length > 50)
}
```

##### Overlap — Why It Matters

```
Document:  "...The refund policy allows 30 days. Returns must include..."
                                              ^ chunk boundary here

Without overlap:
  Chunk 1: "...The refund policy allows 30 days."
  Chunk 2: "Returns must include the original receipt..."
  → User asks "what do I need for a return?" → Chunk 2 retrieved but missing context

With overlap (80 chars):
  Chunk 2 starts: "...allows 30 days. Returns must include the original receipt..."
  → Full context preserved → complete answer
```

---

#### Day 5: Embedding Best Practices

##### Batching Embeddings (Performance)

```javascript
// BAD — sequential
for (const text of texts) {
  const embedding = await embed(text)
}

// GOOD — controlled concurrency (don't overwhelm Ollama)
async function embedBatch(texts, concurrency = 5) {
  const results = []
  for (let i = 0; i < texts.length; i += concurrency) {
    const batch = texts.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(t => embed(t)))
    results.push(...batchResults)
    process.stdout.write(`\rEmbedded ${Math.min(i + concurrency, texts.length)}/${texts.length}`)
  }
  console.log()
  return results
}
```

##### Prepare Text Before Embedding

```javascript
// Include metadata in the text for richer embeddings
function prepareForEmbedding(chunk, metadata) {
  return `Source: ${metadata.source}\nSection: ${metadata.section}\n\n${chunk}`
}

// Normalize vectors for faster dot-product search
function normalize(vec) {
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0))
  return vec.map(v => v / mag)
}
// After normalizing: cosine_similarity(a, b) = dotProduct(a, b)
// pgvector: use <#> (inner product) on normalized vectors for maximum speed
```

---

### Week 2 — pgvector in PostgreSQL

#### Day 6: Setup — PostgreSQL + pgvector in Docker

##### Step 4: Update docker-compose.yml

```yaml
# docker-compose.yml
services:
  ollama:
    image: ollama/ollama
    container_name: ollama
    ports: ["11434:11434"]
    volumes: [ollama_data:/root/.ollama]

  postgres:
    image: pgvector/pgvector:pg16     # Postgres 16 with pgvector pre-installed
    container_name: postgres
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: ai_user
      POSTGRES_PASSWORD: ai_pass
      POSTGRES_DB: ai_learning
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./db/init.sql:/docker-entrypoint-initdb.d/init.sql  # runs on first start

  app:
    build: .
    ports: ["3000:3000"]
    environment:
      OLLAMA_URL: http://ollama:11434
      DATABASE_URL: postgresql://ai_user:ai_pass@postgres:5432/ai_learning
    depends_on: [ollama, postgres]

volumes:
  ollama_data:
  pg_data:
```

```bash
docker compose up -d

# Verify pgvector is installed
docker exec -it postgres psql -U ai_user -d ai_learning -c "SELECT * FROM pg_available_extensions WHERE name = 'vector';"
```

---

##### Step 5: Database Schema Design

This is where pgvector shines — you design a real relational schema, not just a key-value store.

```sql
-- db/init.sql  (runs automatically on first docker compose up)

-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table — tracks source files
CREATE TABLE documents (
  id          SERIAL PRIMARY KEY,
  filename    TEXT NOT NULL UNIQUE,
  file_type   TEXT NOT NULL DEFAULT 'pdf',
  total_chunks INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Document chunks — the actual text pieces with their embeddings
CREATE TABLE document_chunks (
  id           SERIAL PRIMARY KEY,
  document_id  INT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index  INT NOT NULL,
  content      TEXT NOT NULL,
  char_count   INT NOT NULL,
  embedding    vector(768),               -- nomic-embed-text = 768 dims
  source       TEXT NOT NULL,            -- denormalized for fast queries
  section      TEXT,                     -- optional: heading/section name
  page_number  INT,                      -- optional: for PDFs
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_chunk UNIQUE (document_id, chunk_index)
);

-- HNSW index for fast approximate nearest-neighbor search
-- Build AFTER bulk insert for best performance
CREATE INDEX ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Regular index for metadata filtering
CREATE INDEX ON document_chunks (document_id);
CREATE INDEX ON document_chunks (source);

-- Helper: auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

> 🔑 **Schema insight:** `document_chunks` references `documents` via foreign key. When you delete a document (`DELETE FROM documents WHERE filename = 'old.pdf'`), all its chunks are automatically deleted via `ON DELETE CASCADE`. Clean data management with zero extra code.

---

#### Day 7: pgvector SQL Queries — Full Reference

##### Step 6: Node.js Connection Setup

```bash
npm install postgres   # 'postgres' is the modern Postgres client for Node.js
```

```javascript
// db/client.js
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL || 'postgresql://ai_user:ai_pass@localhost:5432/ai_learning')

export default sql
```

```javascript
// Test connection
import sql from './db/client.js'
const result = await sql`SELECT version(), (SELECT extversion FROM pg_extension WHERE extname = 'vector') AS pgvector_version`
console.log(result[0])
// { version: 'PostgreSQL 16...', pgvector_version: '0.7.0' }
```

---

##### Step 7: Core SQL Patterns

**Insert a chunk with its embedding:**
```javascript
import sql from './db/client.js'

async function insertChunk({ documentId, chunkIndex, content, embedding, source, pageNumber }) {
  // postgres.js needs the vector as a formatted string
  const vectorStr = `[${embedding.join(',')}]`

  await sql`
    INSERT INTO document_chunks
      (document_id, chunk_index, content, char_count, embedding, source, page_number)
    VALUES
      (${documentId}, ${chunkIndex}, ${content}, ${content.length},
       ${vectorStr}::vector, ${source}, ${pageNumber || null})
    ON CONFLICT (document_id, chunk_index) DO UPDATE
      SET content = EXCLUDED.content,
          embedding = EXCLUDED.embedding,
          char_count = EXCLUDED.char_count
  `
}
```

**Semantic search — find top K similar chunks:**
```javascript
async function semanticSearch(queryEmbedding, topK = 5, minSimilarity = 0.65) {
  const vectorStr = `[${queryEmbedding.join(',')}]`

  const results = await sql`
    SELECT
      dc.id,
      dc.content,
      dc.source,
      dc.chunk_index,
      dc.page_number,
      d.filename,
      1 - (dc.embedding <=> ${vectorStr}::vector) AS similarity
    FROM document_chunks dc
    JOIN documents d ON d.id = dc.document_id
    WHERE 1 - (dc.embedding <=> ${vectorStr}::vector) >= ${minSimilarity}
    ORDER BY dc.embedding <=> ${vectorStr}::vector   -- ORDER BY distance (ascending)
    LIMIT ${topK}
  `
  return results
}
```

> 🔑 **Important distinction:**
> - `ORDER BY embedding <=> $1` → ascending distance (closest first) ✅
> - `1 - (embedding <=> $1)` → convert distance to similarity score for display
> - Always ORDER BY the raw distance operator, not the converted similarity — the index uses the operator directly

**Filter by source + semantic search (the pgvector superpower):**
```javascript
async function searchInSource(queryEmbedding, sourceName, topK = 4) {
  const vectorStr = `[${queryEmbedding.join(',')}]`

  return await sql`
    SELECT
      content,
      source,
      chunk_index,
      1 - (embedding <=> ${vectorStr}::vector) AS similarity
    FROM document_chunks
    WHERE source = ${sourceName}
      AND 1 - (embedding <=> ${vectorStr}::vector) >= 0.60
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${topK}
  `
}
```

**Delete all chunks for a document:**
```javascript
async function deleteDocument(filename) {
  // CASCADE handles chunks automatically via foreign key
  const result = await sql`
    DELETE FROM documents WHERE filename = ${filename}
    RETURNING id, filename, total_chunks
  `
  return result[0]
}
```

**List all ingested documents:**
```javascript
async function listDocuments() {
  return await sql`
    SELECT
      d.id,
      d.filename,
      d.total_chunks,
      d.created_at,
      COUNT(dc.id) AS actual_chunks
    FROM documents d
    LEFT JOIN document_chunks dc ON dc.document_id = d.id
    GROUP BY d.id
    ORDER BY d.created_at DESC
  `
}
```

---

#### Day 8: HNSW Index — Understanding & Tuning

##### How HNSW Works (Conceptually)

pgvector supports two index types: **HNSW** (Hierarchical Navigable Small World) and **IVFFlat**. Use HNSW — it's faster at query time and doesn't require tuning `nlist`.

```
HNSW builds a multi-layer graph:

Layer 2 (sparse — long-range shortcuts):
  [DocA] ————————————————————— [DocZ]

Layer 1 (medium density):
  [DocA] ———— [DocM] ———— [DocT] ———— [DocZ]

Layer 0 (all vectors — fine-grained):
  [DocA] - [DocB] - [DocC] ... [DocZ]

Search: Start at top → navigate towards target → drop layers → refine
Result: Near-exact nearest neighbor in milliseconds, not linear scan
```

##### HNSW Parameters

```sql
-- Tuning HNSW — run this BEFORE inserting data for best build performance
-- (or DROP and RECREATE after bulk insert)

CREATE INDEX ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (
    m = 16,              -- Max connections per node (default: 16)
                         -- Higher m = better recall, more RAM, slower build
                         -- Range: 2–100, sweet spot: 16–32

    ef_construction = 64 -- Search width during index build (default: 64)
                         -- Higher = better index quality, slower build
                         -- Range: 4–1000, sweet spot: 64–200
  );

-- At query time, tune search quality:
SET hnsw.ef_search = 100;  -- Default: 40. Higher = better recall, slower query
                             -- Set per-session or per-query
```

##### HNSW vs IVFFlat Comparison

| | HNSW | IVFFlat |
|---|---|---|
| Query speed | ⚡ Fast | ⚡ Fast |
| Build speed | Slower | Faster |
| Memory | Higher | Lower |
| Recall accuracy | Higher | Lower |
| Needs training data | No | Yes (needs rows first) |
| Best for | Most use cases | Very large datasets (10M+) |

**For this roadmap: always use HNSW.**

##### Check Index Usage

```sql
-- Verify your query is using the HNSW index
EXPLAIN (ANALYZE, BUFFERS)
SELECT content, 1 - (embedding <=> '[0.1,0.2,...]'::vector) AS sim
FROM document_chunks
ORDER BY embedding <=> '[0.1,0.2,...]'::vector
LIMIT 5;

-- Look for "Index Scan using document_chunks_embedding_idx" in the output
-- If you see "Seq Scan" → index not being used (check dimensions match)
```

---

#### Day 9: Bulk Ingestion Patterns

##### Step 8: Efficient Bulk Insert

For documents with many chunks, inserting one at a time is slow. Use batch inserts:

```javascript
// db/ingest.js
import sql from './db/client.js'

async function bulkInsertChunks(documentId, chunks, embeddings, source) {
  // Build rows array
  const rows = chunks.map((content, i) => ({
    document_id: documentId,
    chunk_index: i,
    content,
    char_count: content.length,
    embedding: `[${embeddings[i].join(',')}]`,
    source
  }))

  // postgres.js supports bulk insert natively
  await sql`
    INSERT INTO document_chunks
      ${sql(rows, 'document_id', 'chunk_index', 'content', 'char_count', 'embedding', 'source')}
    ON CONFLICT (document_id, chunk_index) DO UPDATE
      SET content = EXCLUDED.content,
          embedding = EXCLUDED.embedding
  `

  // Update document's chunk count
  await sql`
    UPDATE documents
    SET total_chunks = ${chunks.length}
    WHERE id = ${documentId}
  `
}

// Full document ingestion
export async function ingestDocument(text, filename) {
  // 1. Create/upsert document record
  const [doc] = await sql`
    INSERT INTO documents (filename, file_type)
    VALUES (${filename}, 'txt')
    ON CONFLICT (filename) DO UPDATE SET updated_at = NOW()
    RETURNING id
  `

  // 2. Chunk the text
  const chunks = smartChunk(text)
  console.log(`📄 ${filename}: ${chunks.length} chunks`)

  // 3. Embed all chunks
  const embeddings = await embedBatch(chunks, 5)

  // 4. Bulk insert into Postgres
  await bulkInsertChunks(doc.id, chunks, embeddings, filename)

  console.log(`✅ Ingested ${chunks.length} chunks → PostgreSQL`)
  return { documentId: doc.id, chunks: chunks.length }
}
```

---

### Week 3 — Full RAG pipeline

#### Day 10–11: RAG Architecture with pgvector

```
┌─────────────────── INGESTION (one-time) ──────────────────────┐
│                                                                 │
│  Raw Docs                                                       │
│     ↓ smartChunk()                                              │
│  Chunks [ ]                                                     │
│     ↓ embedBatch()  (Ollama: nomic-embed-text)                  │
│  Vectors [ ]                                                    │
│     ↓ bulkInsertChunks()                                        │
│  PostgreSQL: documents + document_chunks tables                 │
│     ↓                                                           │
│  HNSW index auto-updated on insert                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────── QUERY (every request) ─────────────────────┐
│                                                                 │
│  User: "What is the refund policy?"                             │
│     ↓ embed()  (Ollama: nomic-embed-text)                       │
│  Query vector [0.21, -0.54, ...]                                │
│     ↓ SQL: ORDER BY embedding <=> $1 LIMIT 5                    │
│  Top 5 chunks + similarity scores + source info                 │
│     ↓ buildRAGPrompt()                                          │
│  [System] + [Context chunks] + [User question]                  │
│     ↓ Ollama: llama3 (stream: true)                             │
│  Streamed answer + source citations                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

##### The RAG Prompt Template

```javascript
function buildRAGPrompt(question, retrievedChunks) {
  const context = retrievedChunks
    .map((chunk, i) =>
      `[Source ${i + 1}: ${chunk.source}, chunk ${chunk.chunk_index}]\n${chunk.content}`
    )
    .join('\n\n---\n\n')

  return {
    system: `You are a helpful assistant that answers questions based ONLY on the provided context.
If the answer is not in the context, say "I don't have information about that in the provided documents."
Do NOT make up information. Always cite which source (Source 1, 2, etc.) your answer comes from.`,

    user: `Context:
${context}

---

Question: ${question}

Answer based only on the context above. Cite your sources.`
  }
}
```

---

##### Step 9: Full RAG Pipeline with pgvector

```javascript
// rag/pipeline.js
import sql from '../db/client.js'

const OLLAMA_URL = 'http://localhost:11434'

async function embed(text) {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', prompt: text })
  })
  const { embedding } = await res.json()
  return embedding
}

async function retrieve(question, topK = 5, minSimilarity = 0.65) {
  const queryEmbedding = await embed(question)
  const vectorStr = `[${queryEmbedding.join(',')}]`

  // Pure SQL — no client library needed
  const chunks = await sql`
    SELECT
      dc.content,
      dc.source,
      dc.chunk_index,
      dc.page_number,
      1 - (dc.embedding <=> ${vectorStr}::vector) AS similarity
    FROM document_chunks dc
    WHERE 1 - (dc.embedding <=> ${vectorStr}::vector) >= ${minSimilarity}
    ORDER BY dc.embedding <=> ${vectorStr}::vector
    LIMIT ${topK}
  `

  return chunks
}

export async function* ragQuery(question) {
  // 1. Retrieve
  const chunks = await retrieve(question)

  if (chunks.length === 0) {
    yield "I don't have information about that in the provided documents."
    return
  }

  console.log(`\n🔍 Retrieved ${chunks.length} chunks:`)
  chunks.forEach(c =>
    console.log(`  [${Number(c.similarity).toFixed(3)}] ${c.source} chunk ${c.chunk_index}`)
  )

  // 2. Build prompt
  const { system, user } = buildRAGPrompt(question, chunks)

  // 3. Stream from Ollama
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      stream: true
    })
  })

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = decoder.decode(value).split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const chunk = JSON.parse(line)
        if (chunk.message?.content) yield chunk.message.content
      } catch {}
    }
  }

  // 4. Yield sources
  yield '\n\n---\n📚 Sources:\n'
  chunks.forEach((c, i) => {
    const sim = (Number(c.similarity) * 100).toFixed(1)
    yield `${i + 1}. ${c.source} — chunk ${c.chunk_index} (relevance: ${sim}%)\n`
  })
}
```

---

#### Day 12: Hybrid Search — pgvector's Killer Feature

pgvector lets you combine semantic search with full-text search in a single SQL query. This handles cases where keyword exact-match is better than semantic similarity (e.g., product codes, names, error codes).

```javascript
// rag/hybrid-search.js

async function hybridSearch(question, topK = 5) {
  const queryEmbedding = await embed(question)
  const vectorStr = `[${queryEmbedding.join(',')}]`

  // Postgres full-text search query
  const tsQuery = question
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2)
    .join(' & ')

  const results = await sql`
    WITH
      semantic AS (
        SELECT
          id,
          content,
          source,
          chunk_index,
          1 - (embedding <=> ${vectorStr}::vector) AS semantic_score,
          0 AS keyword_score
        FROM document_chunks
        ORDER BY embedding <=> ${vectorStr}::vector
        LIMIT 20
      ),
      keyword AS (
        SELECT
          id,
          content,
          source,
          chunk_index,
          0 AS semantic_score,
          ts_rank(to_tsvector('english', content), to_tsquery('english', ${tsQuery})) AS keyword_score
        FROM document_chunks
        WHERE to_tsvector('english', content) @@ to_tsquery('english', ${tsQuery})
        LIMIT 20
      ),
      combined AS (
        SELECT id, content, source, chunk_index,
               MAX(semantic_score) AS semantic_score,
               MAX(keyword_score)  AS keyword_score
        FROM (SELECT * FROM semantic UNION ALL SELECT * FROM keyword) all_results
        GROUP BY id, content, source, chunk_index
      )
    SELECT
      *,
      -- Weighted combination: 70% semantic + 30% keyword
      (0.7 * semantic_score + 0.3 * LEAST(keyword_score * 10, 1)) AS combined_score
    FROM combined
    ORDER BY combined_score DESC
    LIMIT ${topK}
  `

  return results
}
```

> 🔑 **When hybrid search matters:**
> - User asks "What is the ERR_CONNECTION_RESET error?" → exact code match via keyword
> - User asks "What does that network error mean?" → semantic handles it
> - Hybrid handles both cases correctly

---

#### Day 13–21: Phase Project — PDF Q&A Web App

##### Project Structure

```
apps/pdf-qa/
├── docker-compose.yml
├── package.json
├── db/
│   ├── init.sql          ← Schema + pgvector setup
│   └── client.js         ← postgres.js connection
├── server/
│   ├── index.js          ← Express + SSE
│   ├── ingest.js         ← PDF → chunks → embeddings → Postgres
│   └── rag.js            ← Retrieve + LLM query
└── client/
    └── index.html        ← Upload + streaming chat UI
```

##### server/ingest.js — PDF Parsing + pgvector Storage

```javascript
import { execSync } from 'node:child_process'
import sql from '../db/client.js'

function extractPDFText(pdfPath) {
  // Requires: apt-get install poppler-utils
  // Or: brew install poppler  (macOS)
  return execSync(`pdftotext "${pdfPath}" -`, { encoding: 'utf-8' })
}

async function embed(text) {
  const res = await fetch(`${process.env.OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', prompt: text })
  })
  return (await res.json()).embedding
}

async function embedBatch(texts, concurrency = 5) {
  const results = []
  for (let i = 0; i < texts.length; i += concurrency) {
    const batch = texts.slice(i, i + concurrency)
    results.push(...await Promise.all(batch.map(embed)))
    process.stdout.write(`\rEmbedding: ${Math.min(i + concurrency, texts.length)}/${texts.length}`)
  }
  console.log()
  return results
}

export async function ingestPDF(pdfPath) {
  const filename = pdfPath.split('/').pop()

  // 1. Extract text
  const text = extractPDFText(pdfPath)

  // 2. Chunk
  const chunks = smartChunk(text, 400, 80)
  console.log(`📄 ${filename}: ${chunks.length} chunks`)

  // 3. Embed
  const embeddings = await embedBatch(chunks)

  // 4. Upsert document record
  const [doc] = await sql`
    INSERT INTO documents (filename, file_type, total_chunks)
    VALUES (${filename}, 'pdf', ${chunks.length})
    ON CONFLICT (filename) DO UPDATE
      SET total_chunks = EXCLUDED.total_chunks, updated_at = NOW()
    RETURNING id
  `

  // 5. Delete old chunks (re-ingesting)
  await sql`DELETE FROM document_chunks WHERE document_id = ${doc.id}`

  // 6. Bulk insert new chunks
  const rows = chunks.map((content, i) => ({
    document_id: doc.id,
    chunk_index: i,
    content,
    char_count: content.length,
    embedding: `[${embeddings[i].join(',')}]`,
    source: filename
  }))

  await sql`
    INSERT INTO document_chunks
      ${sql(rows, 'document_id', 'chunk_index', 'content', 'char_count', 'embedding', 'source')}
  `

  console.log(`✅ Stored ${chunks.length} chunks in PostgreSQL`)
  return { chunks: chunks.length, source: filename }
}
```

##### server/index.js — Express with SSE Streaming

```javascript
import express from 'express'
import multer from 'multer'
import sql from '../db/client.js'
import { ingestPDF } from './ingest.js'
import { ragQuery } from './rag.js'

const app = express()
const upload = multer({ dest: '/tmp/uploads/' })
app.use(express.json())
app.use(express.static('client'))

// Upload + ingest
app.post('/api/upload', upload.single('pdf'), async (req, res) => {
  try {
    const result = await ingestPDF(req.file.path)
    res.json({ success: true, ...result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// List documents (Postgres query)
app.get('/api/documents', async (req, res) => {
  const docs = await sql`
    SELECT filename, total_chunks, created_at
    FROM documents
    ORDER BY created_at DESC
  `
  res.json(docs)
})

// Delete document (CASCADE removes chunks)
app.delete('/api/documents/:filename', async (req, res) => {
  const result = await sql`
    DELETE FROM documents WHERE filename = ${req.params.filename}
    RETURNING filename, total_chunks
  `
  res.json(result[0] || { error: 'Not found' })
})

// RAG chat with SSE streaming
app.post('/api/chat', async (req, res) => {
  const { question, sourceFilter } = req.body

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    for await (const token of ragQuery(question, sourceFilter)) {
      res.write(`data: ${JSON.stringify({ token })}\n\n`)
    }
    res.write('data: [DONE]\n\n')
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
  } finally {
    res.end()
  }
})

app.listen(3000, () => console.log('🚀 PDF Q&A at http://localhost:3000'))
```

---

### Exercises & experiments

#### Exercise 1 — Visualize Embedding Space

```javascript
const sentences = [
  "I love programming", "I enjoy coding", "I hate bugs",
  "The cat sat on the mat", "A feline rested on the rug",
  "Stock prices fell today", "The market crashed",
  "Pizza is delicious", "I love Italian food",
  "Machine learning is powerful", "AI can solve hard problems"
]

const embeddings = await embedBatch(sentences)

console.log('\nHigh-similarity pairs (> 0.80):')
for (let i = 0; i < sentences.length; i++) {
  for (let j = i + 1; j < sentences.length; j++) {
    const sim = cosineSimilarity(embeddings[i], embeddings[j])
    if (sim > 0.80) {
      console.log(`[${sim.toFixed(3)}] "${sentences[i]}" ↔ "${sentences[j]}"`)
    }
  }
}
```

**Goal:** Find surprising semantic connections. "cat" and "feline" will score high. What else surprises you?

---

#### Exercise 2 — pgvector Operator Comparison

```javascript
// Same query, three different distance operators — compare results

const question = 'How do I handle async errors in JavaScript?'
const queryVec = await embed(question)
const vectorStr = `[${queryVec.join(',')}]`

// Cosine distance
const cosine = await sql`
  SELECT content, 1 - (embedding <=> ${vectorStr}::vector) AS score
  FROM document_chunks ORDER BY embedding <=> ${vectorStr}::vector LIMIT 3
`

// L2 distance (Euclidean)
const l2 = await sql`
  SELECT content, embedding <-> ${vectorStr}::vector AS score
  FROM document_chunks ORDER BY embedding <-> ${vectorStr}::vector LIMIT 3
`

// Inner product (fast on normalized vectors)
const ip = await sql`
  SELECT content, (embedding <#> ${vectorStr}::vector) * -1 AS score
  FROM document_chunks ORDER BY embedding <#> ${vectorStr}::vector LIMIT 3
`

console.log('Cosine results:', cosine.map(r => r.content.slice(0, 60)))
console.log('L2 results:    ', l2.map(r => r.content.slice(0, 60)))
console.log('IP results:    ', ip.map(r => r.content.slice(0, 60)))
// Observe: for text search, cosine usually gives the most relevant results
```

---

#### Exercise 3 — Chunking Quality Test

```javascript
const strategies = {
  'fixed-200':      text => chunkFixed(text, 200, 0),
  'fixed-500':      text => chunkFixed(text, 500, 50),
  'smart-para':     text => smartChunk(text, 400, 80),
}

const testQuestions = [
  'What is the refund period?',
  'How do I contact support?',
  'What items are excluded from returns?'
]

for (const [name, chunker] of Object.entries(strategies)) {
  // Ingest with this strategy into a temp collection
  // Run all questions, check if answers are complete
  const chunks = chunker(documentText)
  console.log(`${name}: ${chunks.length} chunks, avg ${Math.round(chunks.reduce((s,c) => s + c.length, 0) / chunks.length)} chars`)
}
```

---

#### Exercise 4 — HNSW Recall vs Speed Tradeoff

```javascript
// Change ef_search and measure quality vs speed

const efValues = [10, 40, 100, 200]
const groundTruth = await exactSearch(queryVec, 10)  // Brute-force = 100% recall

for (const ef of efValues) {
  await sql`SET hnsw.ef_search = ${ef}`
  const start = Date.now()
  const results = await semanticSearch(queryVec, 10)
  const elapsed = Date.now() - start

  // How many of top-10 ground truth results did we find?
  const recall = results.filter(r =>
    groundTruth.some(g => g.id === r.id)
  ).length / 10

  console.log(`ef_search=${ef}: ${elapsed}ms, recall=${(recall * 100).toFixed(0)}%`)
}
// Observe the tradeoff: higher ef = slower but better recall
```

---

#### Exercise 5 — Hallucination Detection

```javascript
const inDomain = [
  'What is the refund policy?',       // Should answer from docs ✅
  'How do I return an item?',         // Should answer from docs ✅
]

const outOfDomain = [
  'What is the weather today?',       // Should say "I don't know" ✅
  'Who is the CEO of Apple?',         // Should say "I don't know" ✅
  'Write me a poem about dogs',       // Should redirect ✅
]

// Test: retrieve chunks for out-of-domain questions
// If minSimilarity = 0.65, these should return 0 chunks
// → ragQuery returns "I don't have information about that"
for (const q of outOfDomain) {
  const chunks = await retrieve(q, 5, 0.65)
  console.log(`"${q}" → ${chunks.length} chunks retrieved`)
  // Should be 0 — if not, lower your minSimilarity threshold
}
```

---

#### Exercise 6 — SQL Analytics on Your Embeddings (Postgres Bonus)

This is something you *can't* do in a pure vector DB:

```sql
-- Which source files have the most chunks?
SELECT source, COUNT(*) as chunks, AVG(char_count) as avg_chunk_size
FROM document_chunks
GROUP BY source
ORDER BY chunks DESC;

-- Find chunks that were never similar to anything (outliers)
-- Useful for detecting bad chunks (very short, garbled text, etc.)
SELECT id, content, char_count
FROM document_chunks
WHERE char_count < 50
ORDER BY char_count;

-- Most recent ingestions
SELECT filename, total_chunks, created_at
FROM documents
ORDER BY created_at DESC
LIMIT 10;

-- Storage used by embeddings
SELECT
  pg_size_pretty(pg_total_relation_size('document_chunks')) AS total_size,
  COUNT(*) AS total_chunks,
  pg_size_pretty(pg_total_relation_size('document_chunks') / NULLIF(COUNT(*), 0)) AS avg_per_chunk
FROM document_chunks;
```

---

### Concept reference

#### pgvector vs ChromaDB — When to Use Which

| Consideration | pgvector | ChromaDB |
|---|---|---|
| Combined SQL + vector queries | ✅ Native | ❌ Extra plumbing |
| Relational foreign keys | ✅ Native | ❌ Not supported |
| Transactions (ACID) | ✅ Full ACID | ❌ Limited |
| Schema flexibility | ❌ Requires migrations | ✅ Schemaless |
| Setup complexity | Medium | Low |
| Operational familiarity (JS devs) | High (Postgres is everywhere) | Medium |
| Multi-tenancy | ✅ Easy with WHERE clauses | Medium |
| Best for | Production apps, relational data | Pure prototype, simple use cases |

---

#### RAG Failure Modes (Know These!)

| Failure | Cause | Fix |
|---------|-------|-----|
| Correct docs retrieved but wrong answer | Bad prompt template | Strengthen "only use context" instruction |
| Wrong docs retrieved | Poor chunking | Try different chunk sizes or overlap |
| Partial answer | topK too low | Increase to 6–8 chunks |
| Confused answer | topK too high | Decrease; add `minSimilarity` threshold |
| "I don't know" for in-context questions | Chunk too small, split mid-sentence | Increase chunk size and overlap |
| Index not used (slow queries) | Dimensions mismatch | Check `vector(768)` matches model output |
| Slow ingestion | Sequential embedding | Use `embedBatch()` with concurrency = 5 |

---

#### The Similarity Threshold Pattern

```javascript
// Don't blindly return topK — filter by minimum relevance
async function retrieveWithThreshold(question, topK = 5, minSimilarity = 0.65) {
  const queryVec = await embed(question)
  const vectorStr = `[${queryVec.join(',')}]`

  const results = await sql`
    SELECT content, source, chunk_index,
           1 - (embedding <=> ${vectorStr}::vector) AS similarity
    FROM document_chunks
    WHERE 1 - (embedding <=> ${vectorStr}::vector) >= ${minSimilarity}
    ORDER BY embedding <=> ${vectorStr}::vector
    LIMIT ${topK}
  `

  return results
  // If empty → tell user "I don't have info about this"
  // Never pass empty context to the LLM — it will hallucinate
}
```

---

#### LangChain.js with pgvector (Optional)

```javascript
import { OllamaEmbeddings } from '@langchain/ollama'
import { PGVectorStore } from '@langchain/community/vectorstores/pgvector'
import { Ollama } from '@langchain/ollama'

const embeddings = new OllamaEmbeddings({ model: 'nomic-embed-text' })

const vectorStore = await PGVectorStore.initialize(embeddings, {
  postgresConnectionOptions: {
    connectionString: process.env.DATABASE_URL
  },
  tableName: 'document_chunks',
  columns: {
    idColumnName: 'id',
    vectorColumnName: 'embedding',
    contentColumnName: 'content',
    metadataColumnName: 'source'
  }
})

// Semantic search
const results = await vectorStore.similaritySearch('refund policy', 4)

// RAG chain
const retriever = vectorStore.asRetriever({ k: 4 })
```

> **Recommendation:** Build manually first. LangChain abstracts the SQL, which hides the pgvector operators you just learned. Master the raw version first, then use LangChain to speed up future projects.

---

### Detailed checklist (optional)

Granular items while building—mirror of **Completion checklist (outcomes)** above.

- **Embeddings:** Ollama `nomic-embed-text` (or equivalent); cosine in JS; naive top-K; chunking rationale; fixed + paragraph-aware (or better) chunkers; batch embed with concurrency.
- **pgvector:** `pgvector/pgvector:pg16` (or newer); extension; `documents` + `document_chunks`; HNSW on `embedding`; Node `postgres` client; insert with `::vector`; `<=>` + `1 - distance` for display; metadata filters; `EXPLAIN (ANALYZE)`; `hnsw.ef_search` tradeoffs.
- **RAG:** Ingest PDF/text → chunks → embed → Postgres; retrieval + `minSimilarity`; prompt template; SSE/stream chat; citations; hybrid optional; OOD / low-similarity → refusal not hallucination.
- **Shipped mini-app:** Upload + ingest; list/delete docs; chat; multi-PDF smoke test.

---

*Phase 2 scope doc — learning checkpoints and supplementary labs, not a single canonical repo layout.*