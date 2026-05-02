// Local-first stub. Returns no insights until a sqlite re-implementation is added.

import type { DateRange } from "@/lib/range";

export type InsightIcon = "warning" | "info" | "positive";

export interface Insight {
  icon: InsightIcon;
  title: string;
  detail: string;
  deltaText?: string;
  severity: 1 | 2 | 3;
}

export async function getInsights(_userId: string, _range: DateRange): Promise<Insight[]> {
  return [];
}
