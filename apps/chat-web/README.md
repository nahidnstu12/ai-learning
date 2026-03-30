Suppose the final streamed JSON line looks like this (illustrative):

{
  "model": "phi3",
  "message": { "role": "assistant", "content": "" },
  "done": true,
  "prompt_eval_count": 256,
  "eval_count": 64,
  "total_duration": 4200000000,
  "load_duration": 50000000,
  "prompt_eval_duration": 1200000000,
  "eval_duration": 2800000000
}
Then your metrics ends up roughly:

promptEvalCount → 256 (prompt tokens this run)
evalCount → 64 (generated tokens)
totalDurationNs → 4.2e9 → 4.2 s server total
loadDurationNs → 50 ms
promptEvalDurationNs → 1.2 s prompt phase
evalDurationNs → 2.8 s generation phase
Note: those phases don’t have to add up exactly to total_duration; there is other overhead (scheduling, bookkeeping, etc.).

Meanwhile wallMs might be 4500 if the browser waited longer (network, TLS, queuing) than the server’s total_duration.

Handy rates (approximate):

Output tok/s ≈ eval_count / (eval_duration / 1e9)
Prompt tok/s ≈ prompt_eval_count / (prompt_eval_duration / 1e9) when duration > 0


