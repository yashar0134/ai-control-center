import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <SearchX size={32} className="text-faint-foreground" aria-hidden="true" />
      <h1 className="mt-4 text-lg font-semibold">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        This page or connection does not exist. It may have been removed, or the
        address may be mistyped.
      </p>
      <Link
        href="/"
        className="mt-5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
      >
        Back to Overview
      </Link>
    </div>
  );
}
