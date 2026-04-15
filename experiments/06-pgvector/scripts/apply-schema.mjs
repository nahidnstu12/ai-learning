import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.join(__dirname, '..', 'schema.sql')

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('Set DATABASE_URL (see .env.example)')
  process.exit(1)
}

const sql = fs.readFileSync(schemaPath, 'utf8')
const statements = sql
  .replace(/^\s*--.*$/gm, '')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean)

const pool = new pg.Pool({ connectionString })
const client = await pool.connect()
try {
  for (const st of statements) {
    await client.query(`${st};`)
  }
  console.log(`Applied ${statements.length} statements from schema.sql`)
} finally {
  client.release()
  await pool.end()
}
