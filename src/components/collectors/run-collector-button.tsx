"use client";

import { useActionState } from "react";
import { Loader2, PlayCircle } from "lucide-react";
import {
  runCollectorAction,
  type CollectorActionState,
} from "@/server/actions/collector-actions";

/**
 * Trigger for a collector run via the validated server action. Labels default
 * to the demo collector's wording; real collectors pass their own labels.
 * The pending state disables the button, preventing double-click duplicates
 * (the server-side run gate is the authoritative guard).
 */
export function RunCollectorButton({
  collectorId,
  label = "Run demo collector",
  pendingLabel = "Generating demo data…",
}: {
  collectorId: string;
  label?: string;
  pendingLabel?: string;
}) {
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
        {isPending ? pendingLabel : label}
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
