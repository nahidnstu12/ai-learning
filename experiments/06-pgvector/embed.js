const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const MODEL = process.env.OLLAMA_EMBED_MODEL ?? 'nomic-embed-text'

export async function embed(text) {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt: text })
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Ollama embeddings failed: ${res.status} ${body}`)
  }
  const data = await res.json()
  return data.embedding
}
