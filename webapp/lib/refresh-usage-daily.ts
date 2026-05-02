// Local sqlite has no materialized view; this is a no-op kept for the cron route.
export async function refreshUsageDaily(): Promise<void> {
  // intentionally empty
}
