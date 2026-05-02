"use client";

import { User, Bot } from "lucide-react";
import { formatTime } from "@/lib/format-time";
import { formatTokens, formatUsd } from "@/lib/format";
import { TurnCompositionBar } from "@/components/charts/TurnCompositionBar";
import { cn } from "@/lib/utils";
import type { TurnRow as TurnData } from "@/lib/efficiency-queries";

interface TurnRowProps {
  turn: TurnData;
  index: number;
  expanded: boolean;
  maxTotal: number;
  onToggle: () => void;
}

export function TurnRow({ turn, index, expanded, maxTotal, onToggle }: TurnRowProps) {
  const Icon = turn.role === "user" ? User : Bot;

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-4 px-3 py-3 text-left transition-colors hover:bg-surface-2",
          expanded && "bg-surface-2"
        )}
      >
        <div className="flex w-20 shrink-0 items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-fg-muted" aria-hidden />
          <div className="flex flex-col">
            <span className="font-mono text-[11px] font-tabular text-fg">
              {formatTime(turn.ts)}
            </span>
            <span className="font-mono text-[10px] text-fg-subtle">
              #{index + 1}
            </span>
          </div>
        </div>
        <div className="flex-1">
          <TurnCompositionBar
            input={turn.input}
            cacheRead={turn.cacheRead}
            cacheCreation={turn.cacheCreation}
            output={turn.output}
            total={turn.totalTokens}
            maxTotal={maxTotal}
          />
        </div>
        <div className="w-28 shrink-0 text-right">
          <div className="font-mono text-[12px] font-tabular text-fg">
            {formatTokens(turn.totalTokens)}
          </div>
          <div className="font-mono text-[10px] font-tabular text-fg-muted">
            {formatUsd(turn.costUsd)}
          </div>
        </div>
      </button>
      {expanded ? (
        <div className="border-t border-border bg-surface-2/40 px-3 py-3">
          {turn.toolCalls.length === 0 ? (
            <div className="font-mono text-[11px] text-fg-subtle">No tool calls.</div>
          ) : (
            <ul className="space-y-1">
              {turn.toolCalls.map((tc, i) => (
                <li
                  key={`${tc.name}-${i}`}
                  className="flex items-center justify-between gap-2 font-mono text-[11px]"
                >
                  <span className="text-fg">{tc.name}</span>
                  <span className="font-tabular text-fg-muted">
                    {tc.tokensApprox != null
                      ? `${formatTokens(tc.tokensApprox)} tok`
                      : tc.inputBytes != null
                        ? `${tc.inputBytes} bytes`
                        : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
