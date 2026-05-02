import { NextResponse } from "next/server";
import { refreshUsageDaily } from "@/lib/refresh-usage-daily";

export const dynamic = "force-dynamic";

// POST with `Authorization: Bearer $CRON_SECRET` to trigger a refresh.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const t0 = Date.now();
    await refreshUsageDaily();
    return NextResponse.json({ ok: true, ms: Date.now() - t0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
