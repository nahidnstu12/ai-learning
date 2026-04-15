import pg from 'pg'
import 'dotenv/config'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('Missing DATABASE_URL (copy .env.example to .env)')
}

export const pool = new pg.Pool({ connectionString })

/** pgvector accepts a string like '[1,2,3]' */
export function toVectorParam(vec) {
  if (!Array.isArray(vec) || vec.length !== 768) {
    throw new Error(`Expected embedding length 768, got ${vec?.length}`)
  }
  return JSON.stringify(vec)
}
