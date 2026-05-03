"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h2 className="font-serif text-2xl font-light text-fg">
        Something went wrong
      </h2>
      <p className="mt-2 max-w-md font-mono text-sm text-fg-muted">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-md border border-border px-4 py-2 text-sm font-medium text-fg hover:bg-surface"
      >
        Try again
      </button>
    </div>
  );
}
