import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { Readable } from 'node:stream'

const GROQ_CHAT = 'https://api.groq.com/openai/v1/chat/completions'

const apiKey = process.env.GROQ_API_KEY?.trim()
if (!apiKey) {
  console.error('Set GROQ_API_KEY in the environment.')
  process.exit(1)
}

const maxTokensCap = Math.min(
  Math.max(64, Number.parseInt(process.env.MAX_TOKENS_CAP ?? '512', 10) || 512),
  8192,
)
const windowMs = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10) || 60_000
const maxReq = Number.parseInt(process.env.RATE_LIMIT_MAX ?? '30', 10) || 30
const maxMessages = Math.min(
  Math.max(1, Number.parseInt(process.env.MAX_MESSAGES ?? '200', 10) || 200),
  500,
)

const app = express()
app.set('trust proxy', 1)

const originsRaw = process.env.ALLOWED_ORIGINS?.trim() ?? ''
/** Unset, `*`, or `all` → any origin (reflects request Origin). Else comma-separated allowlist. */
const corsAllowAll =
  !originsRaw || originsRaw === '*' || originsRaw.toLowerCase() === 'all'
const origins = corsAllowAll
  ? []
  : originsRaw.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean)

if (process.env.DEBUG_CORS === '1') {
  console.info(
    '[groq-proxy] CORS:',
    corsAllowAll || origins.length === 0 ? 'allow all origins' : origins,
  )
}

app.use(
  cors({
    origin: 'https://interview-chat.bynarilab.com',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  }),
)

app.use((req, _res, next) => {
  if (process.env.DEBUG_CORS === '1' && (req.method === 'POST' || req.method === 'OPTIONS')) {
    console.info('[groq-proxy]', req.method, req.path, 'Origin:', req.headers.origin ?? '(none)')
  }
  next()
})

app.use(express.json({ limit: 512 * 1024 }))

const limiter = rateLimit({
  windowMs,
  max: maxReq,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests; try again later.' },
})

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/chat/completions', limiter, async (req, res) => {
  const body = req.body
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }

  const rawMax = body.max_tokens
  const capped =
    typeof rawMax === 'number' && Number.isFinite(rawMax)
      ? Math.min(Math.max(64, rawMax), maxTokensCap)
      : Math.min(maxTokensCap, 512)

  const messages = body.messages
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > maxMessages) {
    return res.status(400).json({ error: 'invalid messages' })
  }

  const model = String(body.model ?? '').trim().slice(0, 128)
  if (!model) {
    return res.status(400).json({ error: 'model required' })
  }

  const temperatureRaw = body.temperature
  const temperature =
    typeof temperatureRaw === 'number' && Number.isFinite(temperatureRaw)
      ? Math.min(2, Math.max(0, temperatureRaw))
      : 0.7

  const safeBody = {
    model,
    messages,
    stream: body.stream !== false,
    stream_options: body.stream_options ?? { include_usage: true },
    max_tokens: capped,
    temperature,
  }

  let upstream
  try {
    upstream = await fetch(GROQ_CHAT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(safeBody),
    })
  } catch (e) {
    console.error('[groq-proxy] upstream fetch failed', e)
    return res.status(502).json({ error: 'upstream unavailable' })
  }

  res.status(upstream.status)
  const ct = upstream.headers.get('content-type')
  if (ct) res.setHeader('Content-Type', ct)

  if (!upstream.body) {
    const text = await upstream.text()
    return res.send(text)
  }

  const nodeStream = Readable.fromWeb(upstream.body)
  nodeStream.on('error', (err) => {
    console.error('[groq-proxy] stream error', err)
    if (!res.headersSent) res.status(502).end()
    else res.destroy(err)
  })
  res.on('close', () => nodeStream.destroy())
  nodeStream.pipe(res)
})

const port = Number.parseInt(process.env.PORT ?? '8787', 10) || 8787
app.listen(port, () => {
  console.log(`groq-proxy http://127.0.0.1:${port}  (POST /chat/completions, GET /health)`)
})
