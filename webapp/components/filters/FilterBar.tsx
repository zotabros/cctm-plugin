"use client";

import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/Popover";
import { ChevronDown, Check } from "lucide-react";
import { useUrlState } from "./url-sync";
import { cn } from "@/lib/utils";
import type { FilterOption } from "@/lib/queries";

interface FilterBarProps {
  accounts: FilterOption[];
  machines: FilterOption[];
  models: FilterOption[];
  projects: FilterOption[];
}

export function FilterBar(props: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <MultiSelect paramKey="accounts" label="Account" options={props.accounts} />
      <MultiSelect paramKey="machines" label="Machine" options={props.machines} />
      <MultiSelect paramKey="models" label="Model" options={props.models} />
      <MultiSelect paramKey="projects" label="Project" options={props.projects} />
    </div>
  );
}

interface MultiSelectProps {
  paramKey: string;
  label: string;
  options: FilterOption[];
}

function MultiSelect({ paramKey, label, options }: MultiSelectProps) {
  const { params, setParams } = useUrlState();
  const raw = params.get(paramKey) ?? "";
  const selected = new Set(raw ? raw.split(",") : []);

  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    setParams({ [paramKey]: next.size === 0 ? undefined : Array.from(next).join(",") });
  };

  const summary = selected.size === 0 ? "All" : `${selected.size} selected`;

  return (
    <Popover>
      <PopoverTrigger className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-3 font-mono text-[11px] text-fg-muted transition-colors hover:border-border-strong">
        <span className="uppercase tracking-wider">{label}</span>
        <span className="text-fg">{summary}</span>
        <ChevronDown className="h-3 w-3" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[260px] p-1">
        {options.length === 0 ? (
          <div className="px-3 py-2 font-mono text-[11px] text-fg-subtle">No options</div>
        ) : (
          options.map((o) => {
            const on = selected.has(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left font-mono text-[12px] transition-colors",
                  on ? "bg-surface-2 text-fg" : "text-fg-muted hover:bg-surface-2"
                )}
              >
                <span className="flex items-center gap-2">
                  {o.color ? (
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: o.color }}
                      aria-hidden
                    />
                  ) : null}
                  {o.label}
                </span>
                {on ? <Check className="h-3.5 w-3.5 text-accent" /> : null}
              </button>
            );
          })
        )}
      </PopoverContent>
    </Popover>
  );
}
