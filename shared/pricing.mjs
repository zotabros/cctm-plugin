// USD per 1M tokens. Port of cctm-agent shared/pricing.ts.
export const PRICING = {
  'claude-opus-4-7':   { input: 15,  output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  'claude-opus-4-6':   { input: 15,  output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  'claude-opus-4-5':   { input: 15,  output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  'claude-sonnet-4-6': { input: 3,   output: 15, cacheWrite: 3.75,  cacheRead: 0.3 },
  'claude-sonnet-4-5': { input: 3,   output: 15, cacheWrite: 3.75,  cacheRead: 0.3 },
  'claude-haiku-4-5':  { input: 0.8, output: 4,  cacheWrite: 1.0,   cacheRead: 0.08 },
};
const SAFE_DEFAULT = PRICING['claude-sonnet-4-6'];

export function resolvePrice(model) {
  if (!model) return SAFE_DEFAULT;
  const direct = PRICING[model];
  if (direct) return direct;
  const id = String(model).toLowerCase();
  if (id.includes('opus')) return PRICING['claude-opus-4-7'];
  if (id.includes('haiku')) return PRICING['claude-haiku-4-5'];
  if (id.includes('sonnet')) return PRICING['claude-sonnet-4-6'];
  return SAFE_DEFAULT;
}

export function computeCost({ model, input = 0, output = 0, cacheCreation = 0, cacheRead = 0 }) {
  const p = resolvePrice(model);
  const usd =
    (input * p.input + output * p.output + cacheCreation * p.cacheWrite + cacheRead * p.cacheRead) /
    1_000_000;
  return Math.round(usd * 1_000_000) / 1_000_000;
}
