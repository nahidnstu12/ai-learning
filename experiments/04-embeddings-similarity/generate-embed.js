// embeddings/basics.js
const OLLAMA_URL = 'http://localhost:11434'

export async function embed(text) {
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