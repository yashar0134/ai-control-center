import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { getSettings } from "@/server/services/settings-service";
import { Card, CardTitle, PageHeader } from "@/components/ui/card";
import { SettingsForm } from "@/components/settings/settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Stored locally in the SQLite database. Nothing here leaves your machine."
      />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitle>Preferences</CardTitle>
          <SettingsForm settings={settings} />
        </Card>

        <Card>
          <CardTitle>Privacy</CardTitle>
          <div className="flex items-start gap-3">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>This application, in its current state:</p>
              <ul className="list-disc space-y-1 pl-4">
                <li>calls no external APIs and sends no telemetry</li>
                <li>stores no API keys, tokens, cookies, or passwords</li>
                <li>never reads prompts, responses, source code, or file contents</li>
                <li>never reads browser data or credential stores</li>
                <li>keeps all data in a local SQLite file you can delete at any time</li>
              </ul>
              <p>
                Future collectors will only ever store safe metadata (timestamps,
                model names, token counts, aggregate costs) — and only when you
                enable them.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
