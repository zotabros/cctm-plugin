import { cn } from "@/lib/utils";
import {
  formatSignedPct,
  formatSignedUsd,
  formatSignedCount,
  formatSignedPp,
} from "@/lib/format";

interface DiffPillProps {
  value: number;
  format: "pct" | "pp" | "usd" | "count";
  positiveIsGood?: boolean;
  className?: string;
}

export function DiffPill({
  value,
  format,
  positiveIsGood = true,
  className,
}: DiffPillProps) {
  const arrow = value > 0 ? "▲" : value < 0 ? "▼" : "·";
  const formatted =
    format === "pct"
      ? formatSignedPct(value)
      : format === "pp"
        ? formatSignedPp(value)
        : format === "usd"
          ? formatSignedUsd(value)
          : formatSignedCount(value);

  const good = (value > 0 && positiveIsGood) || (value < 0 && !positiveIsGood);
  const bad = (value < 0 && positiveIsGood) || (value > 0 && !positiveIsGood);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[11px] tracking-tight",
        good && "text-positive",
        bad && "text-accent",
        !good && !bad && "text-fg-subtle",
        className
      )}
    >
      <span aria-hidden>{arrow}</span>
      <span className="font-tabular">{formatted}</span>
    </span>
  );
}
