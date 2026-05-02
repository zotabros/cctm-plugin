// Number / date formatters for tabular UI. Use Geist Mono with tabular-nums.

export function formatTokens(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString("en-US");
}

export function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  if (abs >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

export function formatPct(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "0%";
  return `${n.toFixed(digits)}%`;
}

export function formatPp(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "0pp";
  return `${n.toFixed(digits)}pp`;
}

export function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Math.round(n).toLocaleString("en-US");
}

export function formatSignedPct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${formatPct(n)}`;
}

export function formatSignedUsd(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return `${sign}${formatUsd(Math.abs(n))}`;
}

export function formatSignedCount(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${formatCount(n)}`;
}

export function formatSignedPp(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${formatPp(n)}`;
}
