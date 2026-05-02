import { cn } from "@/lib/utils";

interface AccountChipProps {
  color: string;
  label: string;
  className?: string;
}

export function AccountChip({ color, label, className }: AccountChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[12px] text-fg",
        className
      )}
    >
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
