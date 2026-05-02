import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function HairlineCard({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-surface p-5 transition-colors duration-200 hover:border-border-strong",
        className
      )}
      {...rest}
    />
  );
}
