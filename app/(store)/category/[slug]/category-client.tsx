"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { CustomerLayout } from "@/components/site/layout";
import { ProductCard } from "@/components/site/product-card";
import { CATEGORIES } from "@/lib/mock-data";
import type { Product } from "@/lib/mock-data";

const SORTS = ["Recommended", "New arrivals", "Price: Low to High", "Price: High to Low", "Top rated"];

export default function CategoryClient({
  category,
  initialProducts,
}: {
  category: { slug: string; label: string };
  initialProducts: Product[];
}) {
  const [sort, setSort] = useState("Recommended");
  const [maxPrice, setMaxPrice] = useState(5000);
  const [drawer, setDrawer] = useState(false);

  const products = useMemo(() => {
    const list = initialProducts.filter((p) => p.price <= maxPrice);
    if (sort === "Price: Low to High") return [...list].sort((a, b) => a.price - b.price);
    if (sort === "Price: High to Low") return [...list].sort((a, b) => b.price - a.price);
    if (sort === "Top rated") return [...list].sort((a, b) => b.rating - a.rating);
    return list;
  }, [initialProducts, maxPrice, sort]);

  return (
    <CustomerLayout>
      <div className="container-page pt-6">
        <nav className="text-xs text-muted-foreground">Home / <span className="text-foreground">{category.label}</span></nav>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl">{category.label}</h1>
            <p className="text-sm text-muted-foreground">{products.length} products</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setDrawer(true)} className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm lg:hidden">
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </button>
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
              {SORTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="container-page mt-6 grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <Filters maxPrice={maxPrice} setMaxPrice={setMaxPrice} />
        </aside>

        <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 bg-foreground/40 lg:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute inset-y-0 right-0 w-[85%] max-w-sm bg-background p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div className="font-medium">Filters</div>
              <button onClick={() => setDrawer(false)}><X className="h-5 w-5" /></button>
            </div>
            <Filters maxPrice={maxPrice} setMaxPrice={setMaxPrice} />
          </div>
        </div>
      )}
    </CustomerLayout>
  );
}

function Filters({ maxPrice, setMaxPrice }: { maxPrice: number; setMaxPrice: (v: number) => void }) {
  return (
    <div className="space-y-6 text-sm">
      <FilterGroup title="Category">
        {CATEGORIES.slice(0, 6).map((c) => (
          <label key={c.slug} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <input type="checkbox" className="accent-accent" /> {c.label}
          </label>
        ))}
      </FilterGroup>
      <FilterGroup title="Price">
        <div className="px-1">
          <input type="range" min={199} max={10000} step={100} value={maxPrice} onChange={(e) => setMaxPrice(+e.target.value)} className="w-full accent-accent" />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>₹199</span><span>Up to ₹{maxPrice}</span></div>
        </div>
      </FilterGroup>
      <FilterGroup title="Brand">
        {["Aanya", "Loom", "Noir", "Khadi Co.", "Indigo"].map((b) => (
          <label key={b} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <input type="checkbox" className="accent-accent" /> {b}
          </label>
        ))}
      </FilterGroup>
      <FilterGroup title="Color">
        <div className="flex flex-wrap gap-2">
          {["#1a1a1a", "#c9a27a", "#2d4a3e", "#a83232", "#3b5998", "#e8d5c4"].map((c) => (
            <button key={c} aria-label="color" className="h-7 w-7 rounded-full border border-border" style={{ background: c }} />
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title="Size">
        <div className="flex flex-wrap gap-2">
          {["XS", "S", "M", "L", "XL", "XXL"].map((s) => (
            <button key={s} className="h-8 min-w-9 rounded-md border border-input px-2 text-xs hover:border-foreground">{s}</button>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title="Seller Location">
        {["Mumbai", "Delhi", "Bengaluru", "Jaipur", "Ahmedabad"].map((l) => (
          <label key={l} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <input type="checkbox" className="accent-accent" /> {l}
          </label>
        ))}
      </FilterGroup>
      <FilterGroup title="Discount">
        {["10% and above", "30% and above", "50% and above"].map((d) => (
          <label key={d} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <input type="radio" name="disc" className="accent-accent" /> {d}
          </label>
        ))}
      </FilterGroup>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wider">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
