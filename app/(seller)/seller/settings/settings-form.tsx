"use client";

import { useState, useTransition } from "react";
import {
  updateSellerStoreName,
  updateNotificationPrefs,
  type NotificationPrefs,
} from "@/actions/preferences";
import { toast } from "sonner";

const NOTIFICATION_LABELS: { key: keyof NotificationPrefs; label: string }[] = [
  { key: "orderUpdates", label: "Order updates" },
  { key: "newMessages", label: "New messages" },
  { key: "payouts", label: "Payouts" },
  { key: "marketingTips", label: "Marketing tips" },
];

export function SettingsForm({
  initialStoreName,
  initialNotificationPrefs,
}: {
  initialStoreName: string;
  initialNotificationPrefs: NotificationPrefs;
}) {
  const [storeName, setStoreName] = useState(initialStoreName);
  const [prefs, setPrefs] = useState(initialNotificationPrefs);
  const [isStorePending, startStoreTransition] = useTransition();
  const [isPrefsPending, startPrefsTransition] = useTransition();

  function handleSaveStore(e: React.FormEvent) {
    e.preventDefault();
    startStoreTransition(async () => {
      const result = await updateSellerStoreName(storeName);
      if (result.success) {
        toast.success("Store name updated.");
      } else {
        toast.error(result.error);
      }
    });
  }

  function togglePref(key: keyof NotificationPrefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    startPrefsTransition(async () => {
      const result = await updateNotificationPrefs(next);
      if (!result.success) {
        toast.error(result.error);
        setPrefs(prefs);
      }
    });
  }

  return (
    <>
      <form onSubmit={handleSaveStore} className="space-y-4 rounded-md border border-border bg-card p-5">
        <h2 className="font-medium">Store profile</h2>
        <label className="grid gap-1.5 text-sm">
          <span className="text-muted-foreground">Store name</span>
          <input
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3"
            required
            maxLength={100}
          />
        </label>
        <button
          type="submit"
          disabled={isStorePending}
          className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
        >
          {isStorePending ? "Saving…" : "Save store name"}
        </button>
      </form>

      <section className="space-y-3 rounded-md border border-border bg-card p-5">
        <h2 className="font-medium">Notifications</h2>
        {NOTIFICATION_LABELS.map(({ key, label }) => (
          <label key={key} className="flex items-center justify-between text-sm">
            {label}
            <input
              type="checkbox"
              checked={prefs[key]}
              disabled={isPrefsPending}
              onChange={(e) => togglePref(key, e.target.checked)}
              className="accent-accent"
            />
          </label>
        ))}
      </section>
    </>
  );
}
