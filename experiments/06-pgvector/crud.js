import { pool, toVectorParam } from './db.js'

/**
 * @param {{ title?: string, sourceUri?: string, metadata?: object, chunks: { index: number, content: string, embedding: number[], metadata?: object }[] }} input
 */
export async function insertDocumentWithChunks(input) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: [doc] } = await client.query(
      `INSERT INTO documents (title, source_uri, metadata)
       VALUES ($1, $2, $3::jsonb)
       RETURNING id`,
      [
        input.title ?? null,
        input.sourceUri ?? null,
        JSON.stringify(input.metadata ?? {})
      ]
    )
    for (const ch of input.chunks) {
      await client.query(
        `INSERT INTO document_chunks (document_id, chunk_index, content, embedding, metadata)
         VALUES ($1, $2, $3, $4::vector, $5::jsonb)`,
        [
          doc.id,
          ch.index,
          ch.content,
          toVectorParam(ch.embedding),
          JSON.stringify(ch.metadata ?? {})
        ]
      )
    }
    await client.query('COMMIT')
    return doc.id
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

/** Cosine distance `<=>` — lower is more similar */
export async function searchSimilar(embedding, k = 5) {
  const { rows } = await pool.query(
    `SELECT c.id AS chunk_id,
            c.document_id,
            c.chunk_index,
            c.content,
            (c.embedding <=> $1::vector) AS distance
     FROM document_chunks c
     ORDER BY c.embedding <=> $1::vector
     LIMIT $2`,
    [toVectorParam(embedding), k]
  )
  return rows
}

export async function searchSimilarForDocument(documentId, embedding, k = 5) {
  const { rows } = await pool.query(
    `SELECT c.id AS chunk_id,
            c.document_id,
            c.chunk_index,
            c.content,
            (c.embedding <=> $1::vector) AS distance
     FROM document_chunks c
     WHERE c.document_id = $2
     ORDER BY c.embedding <=> $1::vector
     LIMIT $3`,
    [toVectorParam(embedding), documentId, k]
  )
  return rows
}

export async function listDocuments(limit = 50) {
  const { rows } = await pool.query(
    `SELECT d.id, d.title, d.source_uri, d.created_at,
            COUNT(c.id)::int AS chunk_count
     FROM documents d
     LEFT JOIN document_chunks c ON c.document_id = d.id
     GROUP BY d.id
     ORDER BY d.created_at DESC
     LIMIT $1`,
    [limit]
  )
  return rows
}

export async function deleteDocument(documentId) {
  const { rowCount } = await pool.query(`DELETE FROM documents WHERE id = $1`, [
    documentId
  ])
  return rowCount
}

export async function deleteChunk(chunkId) {
  const { rowCount } = await pool.query(
    `DELETE FROM document_chunks WHERE id = $1`,
    [chunkId]
  )
  return rowCount
}
