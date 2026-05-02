"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent,
} from "react";
import { cn } from "@/lib/utils";

interface PopoverCtx {
  open: boolean;
  setOpen: (v: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

const Ctx = createContext<PopoverCtx | null>(null);

interface PopoverProps {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}

export function Popover({ children, open: ctrlOpen, onOpenChange }: PopoverProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = ctrlOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setInternalOpen(v);
  };
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: Event) => {
      const t = e.target as Node;
      if (
        triggerRef.current?.contains(t) ||
        contentRef.current?.contains(t)
      ) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Ctx.Provider value={{ open, setOpen, triggerRef, contentRef }}>
      <div className="relative inline-block">{children}</div>
    </Ctx.Provider>
  );
}

interface TriggerProps {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function PopoverTrigger({ children, className, disabled }: TriggerProps) {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("PopoverTrigger outside Popover");
  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    ctx.setOpen(!ctx.open);
  };
  return (
    <button
      ref={ctx.triggerRef}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {children}
    </button>
  );
}

interface ContentProps {
  children: ReactNode;
  className?: string;
  align?: "start" | "end";
}

export function PopoverContent({ children, className, align = "start" }: ContentProps) {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("PopoverContent outside Popover");
  if (!ctx.open) return null;
  return (
    <div
      ref={ctx.contentRef}
      className={cn(
        "absolute z-40 mt-1 rounded-md border border-border bg-surface text-fg",
        align === "end" ? "right-0" : "left-0",
        className
      )}
    >
      {children}
    </div>
  );
}
