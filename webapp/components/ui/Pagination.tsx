import Link from "next/link";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  total: number;
  pageSize: number;
  baseHref: string; // e.g. "/sessions?range=7d"
}

function withPage(baseHref: string, page: number): string {
  const sep = baseHref.includes("?") ? "&" : "?";
  // Strip any existing page=N then re-append.
  const cleaned = baseHref.replace(/([?&])page=\d+&?/g, (_, p) => p).replace(/[?&]$/, "");
  return `${cleaned}${cleaned.includes("?") ? "&" : sep}page=${page}`;
}

export function Pagination({ page, total, pageSize, baseHref }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const prevDisabled = safePage <= 1;
  const nextDisabled = safePage >= totalPages;

  const linkClass =
    "inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 font-mono text-[12px] text-fg transition-colors hover:border-border-strong";
  const disabledClass = "pointer-events-none opacity-50";

  return (
    <div className="flex items-center justify-between border-t border-border pt-3">
      <div className="font-mono text-[11px] text-fg-subtle">
        {total.toLocaleString("en-US")} sessions
      </div>
      <div className="flex items-center gap-3">
        <Link
          href={prevDisabled ? "#" : withPage(baseHref, safePage - 1)}
          aria-disabled={prevDisabled}
          className={cn(linkClass, prevDisabled && disabledClass)}
        >
          ← Prev
        </Link>
        <span className="font-mono text-[12px] font-tabular text-fg-muted">
          page {safePage} of {totalPages}
        </span>
        <Link
          href={nextDisabled ? "#" : withPage(baseHref, safePage + 1)}
          aria-disabled={nextDisabled}
          className={cn(linkClass, nextDisabled && disabledClass)}
        >
          Next →
        </Link>
      </div>
    </div>
  );
}
