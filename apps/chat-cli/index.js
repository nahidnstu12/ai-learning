/**
 * Interactive CLI chat → Ollama (see experiments/01-prompting).
 * Loads repo-root `.env` (ai-learning/.env).
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

config({
  path: join(dirname(fileURLToPath(import.meta.url)), "../../.env"),
});

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
const MODEL = "llama3.1:8b";
const SYSTEM_PROMPT = `You are a sharp interview coach. Answers must fit a small context budget on the wire: every token counts.

Brevity (default):
- Most questions: 3–6 short sentences OR a tight 3–5 bullet list — pick one format, never both unless the question is clearly two-part.
- Lead with one punchy definition or one-liner, then 1–2 supporting lines max.
- Deep / multi-step questions: max one small numbered outline (3–5 items); still no essay mode.

Quality:
- One analogy or mental model only if it replaces more text than it adds.
- Code: at most ~8 lines, only when words would be unclear; modern JS.

Hard bans:
- No preamble, no recap of the question, no "great question", no closing filler ("hope this helps").
- Tradeoffs, pitfalls, follow-ups: one line total, only if the interviewer would expect it for this topic.`

/** Max new tokens per reply. Ollama uses `num_predict`, not OpenAI's `max_tokens`. */
const NUM_PREDICT = Number.parseInt(
  process.env.CHAT_NUM_PREDICT ?? "512",
  10,
);

/**
 * Streams assistant tokens; returns full text for history.
 * @param {(chunk: string) => void} onChunk
 */
async function chatStream(messages, onChunk) {
  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: true,
      keep_alive: process.env.OLLAMA_KEEP_ALIVE ?? "5m",
      options: {
        temperature: Number.parseFloat(process.env.CHAT_TEMPERATURE ?? "0.7"),
        top_p: Number.parseFloat(process.env.CHAT_TOP_P ?? "0.9"),
        top_k: Number.parseInt(process.env.CHAT_TOP_K ?? "40", 10),
        // repeat_penalty: Number.parseFloat(process.env.CHAT_REPEAT_PENALTY ?? "1.1"),
        // num_predict: Number.isFinite(NUM_PREDICT) ? NUM_PREDICT : 512,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama ${res.status}: ${text}`);
  }

  const body = res.body;
  if (!body) throw new Error("No response body");

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;

        const obj = JSON.parse(line);
        const piece = obj.message?.content ?? "";
        if (piece) {
          full += piece;
          onChunk(piece);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const tail = buffer.trim();
  if (tail) {
    const obj = JSON.parse(tail);
    const piece = obj.message?.content ?? "";
    if (piece) {
      full += piece;
      onChunk(piece);
    }
  }

  return full;
}

async function main() {
  const rl = readline.createInterface({ input, output });

  /** @type {{ role: string; content: string }[]} */
  const messages = [{ role: "system", content: SYSTEM_PROMPT }];

  console.log(`Model: ${MODEL}  ·  ${OLLAMA_HOST}`);
  console.log("Commands: /exit  /clear  (Ctrl+C to quit)\n");

  try {
    while (true) {
      const line = await rl.question("You: ");
      if (line == null) break;

      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed === "/exit" || trimmed === "/quit") break;
      if (trimmed === "/clear") {
        messages.length = 0;
        messages.push({ role: "system", content: SYSTEM_PROMPT });
        console.log("(conversation cleared)\n");
        continue;
      }

      messages.push({ role: "user", content: trimmed });

      process.stdout.write("Assistant: ");
      const t0 = performance.now();
      const reply = await chatStream(messages, (chunk) => {
        process.stdout.write(chunk);
      });
      const ms = performance.now() - t0;

      messages.push({ role: "assistant", content: reply });
      console.log(`\n${ms.toFixed(0)} ms\n`);
    }
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
