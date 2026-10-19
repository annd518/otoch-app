// 17500 -> "17,500₮"
export const formatMnt = (amount: number): string => `${Math.round(amount).toLocaleString('en-US')}₮`
