"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { updateSettings } from "@/server/services/settings-service";

export interface SettingsActionState {
  ok: boolean;
  message: string;
}

/** Server action: validate and persist application settings. */
export async function updateSettingsAction(
  _prevState: SettingsActionState | null,
  formData: FormData,
): Promise<SettingsActionState> {
  const input = {
    displayCurrency: formData.get("displayCurrency"),
    weekStart: formData.get("weekStart"),
    collectionEnabled: formData.get("collectionEnabled") === "on",
    claudeCodeImportEnabled: formData.get("claudeCodeImportEnabled") === "on",
    retentionDays: Number(formData.get("retentionDays")),
    anonymizedMetadata: formData.get("anonymizedMetadata") === "on",
    theme: formData.get("theme"),
  };

  const result = await updateSettings(input);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  // Persist theme in a cookie so the server can render the right theme with no flash.
  const cookieStore = await cookies();
  cookieStore.set("acc-theme", result.settings.theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}
