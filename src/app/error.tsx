"use client";

import { AlertOctagon } from "lucide-react";

/**
 * Route-level error boundary. Shows a friendly message only — no stack
 * traces or internal details reach the browser.
 */
export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <AlertOctagon size={32} className="text-danger" aria-hidden="true" />
      <h1 className="mt-4 text-lg font-semibold">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        The page failed to load. Your local data is safe. If this keeps
        happening, check that the database exists (run the setup command from
        the README).
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 cursor-pointer rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
