"use client";

import { usePathname } from "next/navigation";

const LABELS: Record<string, string> = {
  "/": "overview",
  "/usage": "usage",
  "/efficiency": "efficiency",
  "/sessions": "sessions",
  "/settings": "settings",
  "/settings/accounts": "settings/accounts",
  "/settings/machines": "settings/machines",
};

export function TopbarBreadcrumb() {
  const pathname = usePathname();
  const label = LABELS[pathname] ?? pathname.replace(/^\//, "");
  return (
    <div className="font-mono text-[12px] text-fg-muted">~/cctm/{label}</div>
  );
}
