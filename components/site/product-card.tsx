"use client";

import Link from "next/link";
import { Heart, Star } from "lucide-react";
import type { Product } from "@/lib/mock-data";
import { SmartImage } from "./smart-image";

export function ProductCard({ product }: { product: Product }) {
  const discount = Math.round(((product.mrp - product.price) / product.mrp) * 100);
  return (
    <Link
      href={`/product/${product.id}`}
      className="group flex flex-col"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-muted">
        <SmartImage
          src={product.image}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        <button
          onClick={(e) => { e.preventDefault(); }}
          aria-label="Add to wishlist"
          className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-background/90 text-foreground/70 opacity-0 backdrop-blur transition hover:text-accent group-hover:opacity-100"
        >
          <Heart className="h-4 w-4" />
        </button>
        {product.tags?.includes("new") && (
          <span className="absolute left-2 top-2 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">New</span>
        )}
        {product.tags?.includes("bestseller") && (
          <span className="absolute left-2 top-2 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-background">Bestseller</span>
        )}
        <div className="absolute inset-x-0 bottom-0 translate-y-full bg-foreground py-2.5 text-center text-xs font-medium text-background transition-transform duration-300 group-hover:translate-y-0">
          Quick add
        </div>
      </div>
      <div className="mt-2.5 space-y-1">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="truncate">{product.store}</span>
          <span className="flex items-center gap-0.5"><Star className="h-3 w-3 fill-current" /> {product.rating.toFixed(1)}</span>
        </div>
        <div className="line-clamp-1 text-sm">{product.name}</div>
        <div className="flex items-baseline gap-2 text-sm">
          <span className="font-medium">₹{Number(product.price).toLocaleString("en-IN")}</span>
          {discount > 0 && (
            <>
              <span className="text-xs text-muted-foreground line-through">₹{Number(product.mrp).toLocaleString("en-IN")}</span>
              <span className="text-xs font-medium text-discount">{discount}% off</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
