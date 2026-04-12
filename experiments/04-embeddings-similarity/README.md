
### Chunking strategy — step by step

**0. Why chunk at all**  
Models and embedding APIs have **context limits** and **cost** scales with tokens. You also retrieve **specific** passages, not whole books. So you **split raw docs into smaller units (“chunks”)**, embed each chunk, and at query time **retrieve the best chunks** to feed the LLM.

**1. Ingest**  
Load files from e.g. `data/raw/` (PDF, MD, HTML, etc.). Normalize to **plain text** (strip boilerplate, fix encoding). You’re chunking **text**, not files.

**2. Pick a unit of meaning (strategy)**  
Common approaches:

| Strategy | Idea | Pros / cons |
|----------|------|-------------|
| **Fixed character / token size** | Every N chars or ~N tokens, hard cut | Simple; can **split mid-sentence** → ugly chunks |
| **Fixed size + overlap** | Window of N tokens, slide by N−k so neighbor chunks **share k tokens** | Reduces “answer split across boundary” problem; more storage/embed cost |
| **Structure-aware** | Split on **paragraphs**, headings, Markdown sections, HTML blocks | Chunks match how humans wrote the doc |
| **Sentence / clause** | NLP or rules to keep sentences intact | Cleaner; short docs may need merging |
| **Semantic** | Embed sentences/paragraphs, **merge until** embedding drift exceeds threshold (or max size) | Adapts to content; heavier to implement |

**3. Apply constraints**  
Usually you add **min/max chunk size** (too small = noisy vectors; too big = vague retrieval). Optional: **respect sentence boundaries** before cutting.

**4. Metadata per chunk**  
Store **source file, chunk index, maybe heading path, page number**. You need this to **cite** and debug (“which chunk was used?” — your README goal).

**5. Embed each chunk**  
Same pipeline as your `embed(text)` — one vector per chunk. Store in memory, DB, or vector index.

**6. Retrieve at query time**  
Embed the question, **similarity search** (cosine / dot on normalized vectors), take **top‑k**. Those chunks are the **evidence** for the answer.

**7. Tune the strategy**  
**Chunk size and overlap** change **what** gets retrieved (your “done when”: change size → retrieval quality changes). Too small: misses broader context. Too large: dilutes relevance. Overlap: **recall** at boundaries; **cost** ↑.

---

### One-sentence summary  
**Chunking decides the “atoms” of your knowledge base; retrieval quality is often more sensitive to chunk boundaries and size than to the exact embedding model.**

---

**Sources:** standard RAG practice; your project framing in `experiments/03-rag-chunking/README.md`.