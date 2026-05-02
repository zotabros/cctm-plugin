"use client";

import { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/Popover";
import { DayPicker, type DateRange as DPRange } from "react-day-picker";
import { Calendar } from "lucide-react";
import { useUrlState } from "./url-sync";
import { cn } from "@/lib/utils";
import "react-day-picker/dist/style.css";

const PRESETS = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "mtd", label: "MTD" },
] as const;

interface DateRangePickerProps {
  className?: string;
}

export function DateRangePicker({ className }: DateRangePickerProps) {
  const { params, setParams } = useUrlState();
  const current = params.get("range") ?? "7d";
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<DPRange | undefined>();

  const onPreset = (key: string) => {
    setParams({ range: key, from: undefined, to: undefined });
    setOpen(false);
  };

  const onCustom = () => {
    if (pending?.from && pending?.to) {
      setParams({
        range: "custom",
        from: pending.from.toISOString(),
        to: pending.to.toISOString(),
      });
      setOpen(false);
    }
  };

  const label =
    current === "custom"
      ? `${(params.get("from") ?? "").slice(0, 10)} → ${(params.get("to") ?? "").slice(0, 10)}`
      : (PRESETS.find((p) => p.key === current)?.label ?? "Range");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "inline-flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-3 font-mono text-[12px] text-fg transition-colors hover:border-border-strong",
          className
        )}
      >
        <Calendar className="h-3.5 w-3.5 text-fg-muted" />
        {label}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[420px] p-3">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => onPreset(p.key)}
              className={cn(
                "rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
                current === p.key
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-fg-muted hover:border-border-strong"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-3 border-t border-border pt-3 [&_.rdp]:font-mono [&_.rdp]:text-[12px]">
          <DayPicker
            mode="range"
            numberOfMonths={2}
            selected={pending}
            onSelect={setPending}
          />
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-border px-2 py-1 font-mono text-[11px] text-fg-muted hover:border-border-strong"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onCustom}
            disabled={!pending?.from || !pending?.to}
            className="rounded-md border border-accent bg-accent px-2 py-1 font-mono text-[11px] text-bg disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
