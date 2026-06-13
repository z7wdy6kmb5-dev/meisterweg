// 数値表示ヘルパー。桁が大きい金額はカンマ区切りで見やすくする（指示書7章）。

export function formatNumber(n: number | null | undefined): string {
  return n == null ? '—' : n.toLocaleString('ja-JP');
}

export function formatMoney(n: number | null | undefined): string {
  if (n == null) return '—';
  return '€' + n.toLocaleString('ja-JP');
}

/** OVR増減を符号付きで表示（+3 / -1 / ±0）。 */
export function formatDelta(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n === 0) return '±0';
  return (n > 0 ? '+' : '') + n;
}
