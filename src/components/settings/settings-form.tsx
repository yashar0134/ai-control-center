"use client";

import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";
import {
  updateSettingsAction,
  type SettingsActionState,
} from "@/server/actions/settings-actions";
import type { AppSettings } from "@/server/services/settings-service";

const FIELD_CLASS =
  "w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-foreground";
const LABEL_CLASS = "mb-1 block text-sm font-medium";
const HELP_CLASS = "mt-1 text-xs text-faint-foreground";

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const [state, formAction, isPending] = useActionState<SettingsActionState | null, FormData>(
    updateSettingsAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="displayCurrency" className={LABEL_CLASS}>
            Display currency
          </label>
          <select
            id="displayCurrency"
            name="displayCurrency"
            defaultValue={settings.displayCurrency}
            className={FIELD_CLASS}
          >
            {["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "TRY"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <p className={HELP_CLASS}>
            Used for all amounts. No live currency conversion is performed.
          </p>
        </div>

        <div>
          <label htmlFor="weekStart" className={LABEL_CLASS}>
            Week starts on
          </label>
          <select
            id="weekStart"
            name="weekStart"
            defaultValue={settings.weekStart}
            className={FIELD_CLASS}
          >
            <option value="monday">Monday</option>
            <option value="sunday">Sunday</option>
          </select>
        </div>

        <div>
          <label htmlFor="retentionDays" className={LABEL_CLASS}>
            Data retention (days)
          </label>
          <input
            id="retentionDays"
            name="retentionDays"
            type="number"
            inputMode="numeric"
            min={7}
            max={730}
            defaultValue={settings.retentionDays}
            className={FIELD_CLASS}
          />
          <p className={HELP_CLASS}>
            How long collected metadata is kept locally (7–730 days).
          </p>
        </div>

        <div>
          <label htmlFor="theme" className={LABEL_CLASS}>
            Theme
          </label>
          <select id="theme" name="theme" defaultValue={settings.theme} className={FIELD_CLASS}>
            <option value="dark">Dark (default)</option>
            <option value="light">Light</option>
          </select>
        </div>
      </div>

      <fieldset className="space-y-3 rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium">Local data collection</legend>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="collectionEnabled"
            defaultChecked={settings.collectionEnabled}
            className="mt-0.5 size-4 accent-(--accent)"
          />
          <span>
            Enable local collectors
            <span className="block text-xs text-faint-foreground">
              When off, no collector (including the demo collector) can write data.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="anonymizedMetadata"
            defaultChecked={settings.anonymizedMetadata}
            className="mt-0.5 size-4 accent-(--accent)"
          />
          <span>
            Prefer anonymized metadata
            <span className="block text-xs text-faint-foreground">
              Future collectors will store aggregate counts instead of per-item details
              where possible.
            </span>
          </span>
        </label>
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity duration-150 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : (
            <Save size={15} aria-hidden="true" />
          )}
          {isPending ? "Saving…" : "Save settings"}
        </button>
        <div role="status" aria-live="polite">
          {state && (
            <p className={`text-sm ${state.ok ? "text-success" : "text-danger"}`}>
              {state.message}
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
