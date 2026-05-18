# ai-learning-docs (Docusaurus)

Published site content lives **inside this app** (`apps/docs/docs/`, `apps/docs/ai-notes/`).

Repo-root [`docs/`](../../docs) is **internal only** (runbooks, pipeline, notes) — not mapped into Docusaurus.

| Section | Path | Purpose |
|--------|------|---------|
| Roadmap | `docs/scopes/` | Phase summaries & checkpoints |
| Journal | `docs/journal/` | Standalone phase write-ups (no cross-links) |
| AI Notes | `ai-notes/` | Books, courses, external learning (blog) |

```bash
npm install
npm start          # http://localhost:3004
npm run build      # static site → build/
```
