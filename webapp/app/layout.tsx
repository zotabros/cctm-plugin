import type { Metadata } from "next";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { GrainOverlay } from "@/components/layout/GrainOverlay";
import { fontVars } from "@/styles/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "CCTokenManager",
  description: "Claude Code token usage analytics, self-hosted.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={fontVars}>
      <body className="bg-bg text-fg font-sans antialiased">
        <ThemeProvider>
          <GrainOverlay />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
