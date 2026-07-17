import { z } from "zod";
import { db } from "@/server/db/client";

/**
 * Database-backed application settings with Zod validation and safe defaults.
 * Stored as key/value rows in AppSetting.
 */

export const appSettingsSchema = z.object({
  displayCurrency: z.enum(["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "TRY"]),
  weekStart: z.enum(["monday", "sunday"]),
  collectionEnabled: z.boolean(),
  claudeCodeImportEnabled: z.boolean(),
  retentionDays: z.number().int().min(7).max(730),
  anonymizedMetadata: z.boolean(),
  theme: z.enum(["dark", "light"]),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const DEFAULT_SETTINGS: AppSettings = {
  displayCurrency: "USD",
  weekStart: "monday",
  collectionEnabled: true,
  claudeCodeImportEnabled: true,
  retentionDays: 90,
  anonymizedMetadata: true,
  theme: "dark",
};

/** Parse raw string rows into validated settings, falling back to defaults per key. */
export function parseSettingsRows(
  rows: { key: string; value: string }[],
): AppSettings {
  const raw: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      raw[row.key] = JSON.parse(row.value);
    } catch {
      // Ignore malformed rows; the default will be used.
    }
  }
  const merged = { ...DEFAULT_SETTINGS, ...raw };
  const result = appSettingsSchema.safeParse(merged);
  return result.success ? result.data : DEFAULT_SETTINGS;
}

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.appSetting.findMany();
  return parseSettingsRows(rows);
}

export async function updateSettings(
  input: unknown,
): Promise<{ ok: true; settings: AppSettings } | { ok: false; message: string }> {
  const parsed = appSettingsSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      ok: false,
      message: `Invalid setting "${first?.path.join(".")}": ${first?.message ?? "invalid value"}`,
    };
  }
  const entries = Object.entries(parsed.data);
  await db.$transaction([
    ...entries.map(([key, value]) =>
      db.appSetting.upsert({
        where: { key },
        update: { value: JSON.stringify(value) },
        create: { key, value: JSON.stringify(value) },
      }),
    ),
    db.auditEvent.create({
      data: {
        actor: "user",
        action: "settings.update",
        subject: entries.map(([k]) => k).join(","),
      },
    }),
  ]);
  return { ok: true, settings: parsed.data };
}
