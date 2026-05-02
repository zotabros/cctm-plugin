import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex h-24 items-end justify-between border-b border-border pb-4">
      <div>
        <h1 className="text-[28px] font-medium tracking-tight text-fg">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-1 text-[13px] text-fg-muted">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
