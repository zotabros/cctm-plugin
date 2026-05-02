// Date range presets and parsing. All times are UTC-anchored Date objects.

export type RangePreset = "24h" | "7d" | "30d" | "90d" | "mtd" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
  preset: RangePreset;
}

export function getDateRange(
  preset: RangePreset,
  start?: Date | string,
  end?: Date | string
): DateRange {
  const now = new Date();
  if (preset === "custom" && start && end) {
    return {
      from: new Date(start),
      to: new Date(end),
      preset: "custom",
    };
  }

  const to = now;
  let from: Date;
  switch (preset) {
    case "24h":
      from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "7d":
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "mtd": {
      const m = new Date(now.getFullYear(), now.getMonth(), 1);
      from = m;
      break;
    }
    default:
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  return { from, to, preset };
}

/** Previous period of equal length for delta comparisons. */
export function previousRange(range: DateRange): DateRange {
  const span = range.to.getTime() - range.from.getTime();
  return {
    from: new Date(range.from.getTime() - span),
    to: new Date(range.from.getTime()),
    preset: range.preset,
  };
}

export function rangeLabel(range: DateRange): string {
  switch (range.preset) {
    case "24h":
      return "Last 24 hours";
    case "7d":
      return "Last 7 days";
    case "30d":
      return "Last 30 days";
    case "90d":
      return "Last 90 days";
    case "mtd":
      return "Month to date";
    default:
      return `${range.from.toISOString().slice(0, 10)} → ${range.to.toISOString().slice(0, 10)}`;
  }
}

export function parseRangeParams(params: {
  range?: string;
  from?: string;
  to?: string;
}): DateRange {
  const preset = (params.range ?? "7d") as RangePreset;
  if (preset === "custom" && params.from && params.to) {
    return getDateRange("custom", params.from, params.to);
  }
  const valid: RangePreset[] = ["24h", "7d", "30d", "90d", "mtd"];
  if (!valid.includes(preset)) return getDateRange("7d");
  return getDateRange(preset);
}
