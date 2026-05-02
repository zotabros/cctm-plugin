"use client";

import { useUrlState } from "./url-sync";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "model", label: "By model" },
  { key: "account", label: "By account" },
  { key: "project", label: "By project" },
] as const;

export function StackByTabs() {
  const { params, setParams } = useUrlState();
  const current = params.get("stackBy") ?? "model";

  return (
    <div className="flex items-center gap-4 border-b border-border">
      {TABS.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => setParams({ stackBy: t.key })}
          className={cn(
            "relative -mb-px border-b-2 px-1 py-2 text-[12px] transition-colors",
            current === t.key
              ? "border-accent text-fg"
              : "border-transparent text-fg-muted hover:text-fg"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
