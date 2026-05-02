import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { TopbarBreadcrumb } from "./TopbarBreadcrumb";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-bg/95 px-8 backdrop-blur">
      <TopbarBreadcrumb />
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
