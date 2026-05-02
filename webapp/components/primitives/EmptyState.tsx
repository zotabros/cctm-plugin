import { cn } from "@/lib/utils";

interface EmptyStateProps {
  message: string;
  className?: string;
}

// ASCII-bordered empty state — Terminal Cartography theme.
export function EmptyState({ message, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-10 font-mono text-[12px] text-fg-subtle",
        className
      )}
    >
      <pre className="select-none leading-tight" aria-hidden>
        {`┌────────────────────────┐\n│                        │\n│       no data yet      │\n│                        │\n└────────────────────────┘`}
      </pre>
      <div className="mt-3 text-fg-muted">{message}</div>
    </div>
  );
}
