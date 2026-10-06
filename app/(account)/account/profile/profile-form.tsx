"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "@/actions/preferences";
import { toast } from "sonner";

export function ProfileForm({
  initialName,
  email,
  initialPhone,
}: {
  initialName: string;
  email: string;
  initialPhone: string;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateProfile({ name, phone });
      if (result.success) {
        toast.success("Profile updated.");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 grid max-w-xl gap-4">
      <label className="grid gap-1.5 text-sm">
        <span className="text-muted-foreground">Full name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 rounded-md border border-input px-3 outline-none focus:border-foreground"
          required
        />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="text-muted-foreground">Email</span>
        <input
          value={email}
          disabled
          className="h-10 rounded-md border border-input px-3 bg-muted text-muted-foreground"
        />
      </label>
      <label className="grid gap-1.5 text-sm">
        <span className="text-muted-foreground">Phone</span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91"
          className="h-10 rounded-md border border-input px-3 outline-none focus:border-foreground"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="mt-2 w-fit rounded-md bg-foreground px-5 py-2 text-sm text-background disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
