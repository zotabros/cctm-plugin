"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings/accounts", label: "Accounts" },
] as const;

export function SettingsTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 border-b border-border">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "relative px-4 py-3 text-[13px] transition-colors",
              active
                ? "text-fg after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-[2px] after:bg-accent"
                : "text-fg-muted hover:text-fg"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
