"use client";

import { useState, useTransition } from "react";
import { completeSellerProfile } from "@/actions/auth";

export function RegisterForm({
  initialStoreName,
  initialPickupAddress,
}: {
  initialStoreName: string;
  initialPickupAddress: string;
}) {
  const [storeName, setStoreName] = useState(initialStoreName);
  const [pickupAddress, setPickupAddress] = useState(initialPickupAddress);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await completeSellerProfile({ storeName, pickupAddress });
      if (result && !result.success) {
        setError(result.error);
      }
      // On success the server action redirects, so no further handling needed here.
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6">
      <section className="rounded-md border border-border bg-card p-5">
        <h3 className="mb-4 font-medium">Business details</h3>
        <div className="space-y-4">
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Business / store name</span>
            <input
              className="input"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              required
              maxLength={100}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-muted-foreground">Pickup address</span>
            <textarea
              rows={3}
              className="input"
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              required
              maxLength={500}
            />
          </label>
        </div>
      </section>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-foreground px-5 py-2.5 text-sm text-background disabled:opacity-50"
        >
          {isPending ? "Submitting…" : "Submit for approval"}
        </button>
      </div>

      <style>{`.input{border-radius:.375rem;border:1px solid var(--input);background:var(--background);padding:.5rem .75rem;font-size:.875rem;width:100%;outline:none}.input:focus{border-color:var(--foreground)}`}</style>
    </form>
  );
}
