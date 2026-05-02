"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Gauge,
  ListTree,
  Wrench,
  Bot,
  MessageSquare,
  Settings as SettingsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/usage", label: "Usage", icon: TrendingUp },
  { href: "/efficiency", label: "Efficiency", icon: Gauge },
  { href: "/sessions", label: "Sessions", icon: ListTree },
  { href: "/turns", label: "Turns", icon: MessageSquare },
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/subagents", label: "Subagents", icon: Bot },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-border bg-bg">
      <div className="flex h-14 items-center px-5 border-b border-border">
        <span className="font-serif text-[20px] font-light tracking-tight">
          CCTM
        </span>
      </div>
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors",
                    active
                      ? "bg-surface-2 text-fg"
                      : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
