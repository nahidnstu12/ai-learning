// semantic-search/naive.js
import { embed } from './generate-embed.js'

// dot(a,b) / (||a|| ||b||); in [-1, 1] for arbitrary vectors
function cosineSimilarity(a, b) {
  if (a.length !== b.length) {
    throw new Error(`cosineSimilarity: length ${a.length} vs ${b.length}`)
  }
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    dot += x * y
    normA += x * x
    normB += y * y
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

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
  
  const results = await search('which is for machine learning language?')
//   const results = await search('how do I run code on the server?')
  results.forEach(r => console.log(`[${r.score.toFixed(3)}] ${r.text}`))
  // [0.891] Node.js allows JavaScript to run on the server side
  // [0.743] JavaScript is a dynamic programming language for the web