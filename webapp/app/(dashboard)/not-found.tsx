import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h2 className="font-serif text-4xl font-light text-fg">404</h2>
      <p className="mt-2 font-mono text-sm text-fg-muted">
        This page does not exist.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-md border border-border px-4 py-2 text-sm font-medium text-fg hover:bg-surface"
      >
        Back to overview
      </Link>
    </div>
  );
}
