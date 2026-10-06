"use client";

import { useState, useTransition } from "react";
import { updatePlatformSettings, type PlatformSettings } from "@/actions/admin";
import { toast } from "sonner";

export function SettingsForm({ initialSettings }: { initialSettings: PlatformSettings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updatePlatformSettings(settings);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <section className="space-y-3 rounded-md border border-border bg-card p-5">
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">Marketplace name</span>
          <input
            value={settings.marketplaceName}
            onChange={(e) => set("marketplaceName", e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3"
            required
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">Support email</span>
          <input
            type="email"
            value={settings.supportEmail}
            onChange={(e) => set("supportEmail", e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3"
            required
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">Default commission (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={settings.defaultCommissionPercent}
            onChange={(e) => set("defaultCommissionPercent", e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3"
            required
          />
        </label>
      </section>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-foreground px-5 py-2.5 text-sm text-background disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}
