export function uid() {
  return crypto.randomUUID()
}

export function formatNs(ns) {
  if (ns == null || Number.isNaN(ns)) return '—'
  return `${(ns / 1e6).toFixed(0)} ms`
}
