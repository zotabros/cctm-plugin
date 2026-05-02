// 12-color palette. Pure ESM port of cctm-agent shared/colors.ts.
export const ACCOUNT_COLORS = Object.freeze([
  '#B4490B', '#C2410C', '#A16207', '#854D0E',
  '#65A30D', '#0F766E', '#0E7490', '#475569',
  '#5B5750', '#92400E', '#7C2D12', '#3F3F46',
]);

export function pickRandomColor(seed) {
  if (!seed) return ACCOUNT_COLORS[Math.floor(Math.random() * ACCOUNT_COLORS.length)];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return ACCOUNT_COLORS[Math.abs(h) % ACCOUNT_COLORS.length];
}
