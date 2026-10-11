// MNT amounts are integers (docs/l1-1-api.md §0). Display only: the app never
// adds prices up; the final total comes from the server quote.
export function formatMnt(amount: number): string {
  if (!Number.isFinite(amount)) return '-'
  const rounded = Math.round(amount)
  const sign = rounded < 0 ? '-' : ''
  const grouped = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}${grouped}₮`
}
