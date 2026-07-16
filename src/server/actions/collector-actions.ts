"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { runCollector, type RunCollectorSummary } from "@/server/services/collector-service";

export type CollectorActionState = RunCollectorSummary | null;

/**
 * Server action: run a collector by id. Input is validated; unknown ids are
 * rejected inside the service. Only ever triggered by an explicit user click.
 */
export async function runCollectorAction(
  _prevState: CollectorActionState,
  formData: FormData,
): Promise<CollectorActionState> {
  const parsed = z.string().min(1).max(100).safeParse(formData.get("collectorId"));
  if (!parsed.success) {
    return {
      ok: false,
      collectorId: "",
      written: 0,
      skipped: 0,
      message: "Invalid collector id.",
    };
  }
  const summary = await runCollector(parsed.data, "user");
  if (summary.ok) {
    revalidatePath("/", "layout");
  }
  return summary;
}
