// Local-only build: there are no users to switch. Component retained as a
// no-op badge to preserve Topbar layout.
import { User } from "lucide-react";

export function UserMenu() {
  return (
    <div className="inline-flex h-8 items-center gap-2 rounded-md border border-border px-2 text-[13px] text-fg-muted">
      <User className="h-4 w-4" />
      <span className="font-mono">local</span>
    </div>
  );
}
