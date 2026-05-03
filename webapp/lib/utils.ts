import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function csv(s: string | undefined): string[] | undefined {
  if (!s) return undefined;
  const arr = s.split(",").filter(Boolean);
  return arr.length ? arr : undefined;
}
