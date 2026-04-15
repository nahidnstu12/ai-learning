import 'dotenv/config'
import { embed } from './embed.js'
import {
  deleteDocument,
  insertDocumentWithChunks,
  listDocuments,
  searchSimilar
} from './crud.js'
import { pool } from './db.js'

const samples = [
  {
    title: 'JS on the server',
    chunks: [
      'Node.js allows JavaScript to run on the server side.',
      'npm is the default package manager for Node.js.'
    ]
  },
  {
    title: 'Python ML',
    chunks: [
      'Python is widely used for data science and machine learning.',
      'Libraries like NumPy and PyTorch are common in ML workflows.'
    ]
  }
]

async function main() {
  const ids = []
  for (let d = 0; d < samples.length; d++) {
    const doc = samples[d]
    const chunks = []
    for (let i = 0; i < doc.chunks.length; i++) {
      const content = doc.chunks[i]
      const embedding = await embed(content)
      chunks.push({ index: i, content, embedding })
    }
    const id = await insertDocumentWithChunks({
      title: doc.title,
      sourceUri: `demo://${d}`,
      metadata: { demo: true },
      chunks
    })
    ids.push(id)
    console.log('Inserted document', id, doc.title)
  }

  const query = 'which language is good for machine learning?'
  const qEmb = await embed(query)
  console.log('\nQuery:', query)
  const hits = await searchSimilar(qEmb, 4)
  for (const h of hits) {
    console.log(
      `  dist=${Number(h.distance).toFixed(4)} doc=${h.document_id} #${h.chunk_index} ${h.content.slice(0, 72)}…`
    )
  }

  console.log('\nDocuments:')
  const docs = await listDocuments(10)
  for (const row of docs) {
    console.log(`  ${row.id} chunks=${row.chunk_count} ${row.title}`)
  }

  // if (ids[0]) {
  //   await deleteDocument(ids[0])
  //   console.log('\nDeleted first demo document', ids[0])
  // }

  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
