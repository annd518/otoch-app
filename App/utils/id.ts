// Random v4-style UUID for Idempotency-Key headers. Not a security token, so
// Math.random is acceptable; it only has to be unique per request attempt.
export function createIdempotencyKey(random: () => number = Math.random): string {
  const hex = (n: number) =>
    Array.from({ length: n }, () => Math.floor(random() * 16).toString(16)).join('')
  const variant = (Math.floor(random() * 4) + 8).toString(16)
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`
}
