export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-48 rounded bg-surface" />
        <div className="h-4 w-32 rounded bg-surface" />
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 h-80 rounded-lg border border-border bg-surface/40" />
        <div className="lg:col-span-4 h-80 rounded-lg border border-border bg-surface/40" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-48 rounded-lg border border-border bg-surface/40"
          />
        ))}
      </div>
    </div>
  );
}
