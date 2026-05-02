import { cn } from "@/lib/utils";

interface ModelBadgeProps {
  model: string | null | undefined;
  className?: string;
}

function tier(model: string): "opus" | "sonnet" | "haiku" | "other" {
  const m = model.toLowerCase();
  if (m.includes("opus")) return "opus";
  if (m.includes("sonnet")) return "sonnet";
  if (m.includes("haiku")) return "haiku";
  return "other";
}

function shortLabel(model: string): string {
  const m = model.toLowerCase();
  const match = m.match(/(opus|sonnet|haiku)[-\s]?(\d+[-.]?\d*)/);
  if (match) return `${match[1].toUpperCase()} ${match[2].replace("-", ".")}`;
  return model.toUpperCase();
}

export function ModelBadge({ model, className }: ModelBadgeProps) {
  if (!model) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-fg-subtle",
          className
        )}
      >
        UNKNOWN
      </span>
    );
  }
  const t = tier(model);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        t === "opus" && "bg-accent text-bg",
        t === "sonnet" && "bg-accent-soft text-accent",
        t === "haiku" && "border border-accent text-accent",
        t === "other" && "border border-border text-fg-muted",
        className
      )}
    >
      {shortLabel(model)}
    </span>
  );
}
