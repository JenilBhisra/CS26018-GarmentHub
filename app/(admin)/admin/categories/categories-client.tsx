"use client";

import { useState, useTransition } from "react";
import { createCategory, updateCategory, deleteCategory } from "@/actions/products";
import { SmartImage } from "@/components/site/smart-image";
import { toast } from "sonner";

type Category = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  productCount: number;
};

export function CategoriesClient({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleCreate(name: string, image: string) {
    startTransition(async () => {
      const result = await createCategory({ name, image });
      if (result.success) {
        toast.success("Category created.");
        setIsAdding(false);
        window.location.reload();
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleUpdate(id: string, name: string, image: string) {
    startTransition(async () => {
      const result = await updateCategory(id, { name, image });
      if (result.success) {
        toast.success("Category updated.");
        setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name, image: image || null } : c)));
        setEditingId(null);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this category? This cannot be undone.")) return;
    startTransition(async () => {
      const result = await deleteCategory(id);
      if (result.success) {
        toast.success("Category deleted.");
        setCategories((prev) => prev.filter((c) => c.id !== id));
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{categories.length} categories</p>
        <button
          onClick={() => setIsAdding((v) => !v)}
          className="rounded-md bg-foreground px-4 py-2 text-sm text-background"
        >
          {isAdding ? "Cancel" : "+ New category"}
        </button>
      </div>

      {isAdding && (
        <CategoryForm
          onSubmit={handleCreate}
          onCancel={() => setIsAdding(false)}
          isPending={isPending}
          submitLabel="Create category"
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((c) =>
          editingId === c.id ? (
            <div key={c.id} className="rounded-md border border-border bg-card p-3">
              <CategoryForm
                initialName={c.name}
                initialImage={c.image ?? ""}
                onSubmit={(name, image) => handleUpdate(c.id, name, image)}
                onCancel={() => setEditingId(null)}
                isPending={isPending}
                submitLabel="Save"
              />
            </div>
          ) : (
            <div key={c.id} className="overflow-hidden rounded-md border border-border bg-card">
              {c.image ? (
                <SmartImage src={c.image} className="aspect-[4/3] w-full object-cover" alt="" />
              ) : (
                <div className="aspect-[4/3] w-full bg-muted" />
              )}
              <div className="flex items-center justify-between p-3 text-sm">
                <div>
                  <span>{c.name}</span>
                  <p className="text-xs text-muted-foreground">{c.productCount} products</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingId(c.id)} className="text-xs text-accent">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="text-xs text-red-600">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function CategoryForm({
  initialName = "",
  initialImage = "",
  onSubmit,
  onCancel,
  isPending,
  submitLabel,
}: {
  initialName?: string;
  initialImage?: string;
  onSubmit: (name: string, image: string) => void;
  onCancel: () => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const [name, setName] = useState(initialName);
  const [image, setImage] = useState(initialImage);

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-4">
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3"
          maxLength={60}
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Image URL (optional)</span>
        <input
          value={image}
          onChange={(e) => setImage(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3"
          placeholder="https://…"
        />
      </label>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-md border border-border px-3 py-1.5 text-xs">
          Cancel
        </button>
        <button
          onClick={() => onSubmit(name, image)}
          disabled={isPending || !name.trim()}
          className="rounded-md bg-foreground px-3 py-1.5 text-xs text-background disabled:opacity-50"
        >
          {isPending ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
