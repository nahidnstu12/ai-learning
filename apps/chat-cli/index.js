/**
 * Step 1: wire Ollama chat from Node (see experiments/01-prompting).
 * Uses OLLAMA_HOST and MODEL_CHAT from env; defaults match .env.example.
 */
const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
const MODEL = process.env.MODEL_CHAT ?? "llama3.2";

async function chat(messages) {
  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: false,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.message?.content ?? "";
}

// Minimal demo — replace with REPL in 01-prompting
const messages = [
  { role: "system", content: "You are a concise assistant." },
  { role: "user", content: "Say hello in one short sentence." },
];

chat(messages)
  .then((out) => {
    console.log(out);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
