"use client";

import { useActionState } from "react";
import { Loader2, PlayCircle } from "lucide-react";
import {
  runCollectorAction,
  type CollectorActionState,
} from "@/server/actions/collector-actions";

/**
 * Clearly-labeled trigger for the demo collector. The generated data is
 * synthetic and marked with provenance "demo" everywhere it appears.
 */
export function RunCollectorButton({ collectorId }: { collectorId: string }) {
  const [state, formAction, isPending] = useActionState<CollectorActionState, FormData>(
    runCollectorAction,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="collectorId" value={collectorId} />
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 size={15} className="animate-spin" aria-hidden="true" />
        ) : (
          <PlayCircle size={15} aria-hidden="true" />
        )}
        {isPending ? "Generating demo data…" : "Run demo collector"}
      </button>
      <div role="status" aria-live="polite">
        {state && (
          <p
            className={`text-xs ${state.ok ? "text-muted-foreground" : "text-danger"}`}
          >
            {state.ok ? "✓" : "✕"} {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
