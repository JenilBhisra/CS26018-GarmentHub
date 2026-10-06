"use client";

import { useState, useTransition } from "react";
import { setProductFeatured } from "@/actions/products";
import { SmartImage } from "@/components/site/smart-image";
import { toast } from "sonner";

type Product = { id: string; name: string; image: string | null; isFeatured: boolean };

export function TrendingClient({ products }: { products: Product[] }) {
  const [items, setItems] = useState(products);
  const [, startTransition] = useTransition();

  function toggle(id: string, next: boolean) {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, isFeatured: next } : p)));
    startTransition(async () => {
      const result = await setProductFeatured(id, next);
      if (!result.success) {
        toast.error(result.error);
        setItems((prev) => prev.map((p) => (p.id === id ? { ...p, isFeatured: !next } : p)));
      }
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No active products yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      {items.map((p) => (
        <label key={p.id} className="block cursor-pointer rounded-md border border-border bg-card p-2">
          {p.image ? (
            <SmartImage src={p.image} className="aspect-[4/5] w-full rounded object-cover" alt="" />
          ) : (
            <div className="aspect-[4/5] w-full rounded bg-muted" />
          )}
          <div className="mt-1 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              className="accent-accent"
              checked={p.isFeatured}
              onChange={(e) => toggle(p.id, e.target.checked)}
            />
            <span className="truncate">{p.name}</span>
          </div>
        </label>
      ))}
    </div>
  );
}
