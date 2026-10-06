"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useWishlist } from "@/providers/wishlist-provider";
import { SmartImage } from "@/components/site/smart-image";
import Link from "next/link";
import { Trash2, ShoppingBag, ArrowRight, Heart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { CustomerLayout } from "@/components/site/layout";

export default function WishlistPage() {
  const { wishlistItems, removeFromWishlist, moveWishlistItemToCart, loading } = useWishlist();
  const [selectedVariantIds, setSelectedVariantIds] = useState<Record<string, string>>({});
  const [activePickerProductId, setActivePickerProductId] = useState<string | null>(null);

  const handleMoveToBag = async (productId: string, variants: any[]) => {
    if (!variants || variants.length === 0) {
      toast.error("This product is currently unavailable.");
      return;
    }

    // If only 1 variant exists, add it immediately
    if (variants.length === 1) {
      const res = await moveWishlistItemToCart(productId, variants[0].id);
      return;
    }

    // Otherwise, check if a variant is selected
    const selectedVariantId = selectedVariantIds[productId];
    if (!selectedVariantId) {
      // Toggle picker visible
      setActivePickerProductId(activePickerProductId === productId ? null : productId);
      toast.info("Please select a size/color variant first");
      return;
    }

    await moveWishlistItemToCart(productId, selectedVariantId);
    // Cleanup state
    const nextSelected = { ...selectedVariantIds };
    delete nextSelected[productId];
    setSelectedVariantIds(nextSelected);
    setActivePickerProductId(null);
  };

  return (
    <CustomerLayout>
      <div className="container-page py-10">
        <h1 className="font-display text-3xl mb-1">My Wishlist</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Keep track of items you love and move them to your bag whenever you are ready.
        </p>

        {loading && wishlistItems.length === 0 ? (
          <div className="flex h-60 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          </div>
        ) : wishlistItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-dashed border-border rounded-xl p-12 text-center bg-muted/10">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-muted/40 mb-4 text-muted-foreground">
              <Heart className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-medium text-foreground">Your wishlist is empty</h3>
            <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-6">
              Browse our catalog of curated garments and add items to your wishlist.
            </p>
            <Link href="/" className="inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-6 py-2.5 text-sm font-medium hover:opacity-90 transition">
              Explore Store <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {wishlistItems.map((item) => {
              const product = item.product;
              if (!product) return null;
              
              const variants = product.variants || [];
              const hasMultipleVariants = variants.length > 1;
              const selectedId = selectedVariantIds[product.id];
              const selectedVariant = variants.find((v: any) => v.id === selectedId);

              // Gather unique sizes and colors
              const colors = Array.from(new Set(variants.map((v: any) => v.color).filter(Boolean)));
              const sizes = Array.from(new Set(variants.map((v: any) => v.size).filter(Boolean)));

              return (
                <div key={item.id} className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-background transition hover:shadow-md">
                  {/* Image */}
                  <div className="aspect-[4/5] overflow-hidden bg-muted relative">
                    <SmartImage
                      src={product.images?.[0] || product.image || ""}
                      alt={product.name}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                    <button
                      onClick={() => removeFromWishlist(product.id)}
                      className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-background/85 text-muted-foreground hover:bg-background hover:text-red-600 shadow transition-colors"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 flex-col p-4">
                    <div className="text-xs text-muted-foreground mb-0.5">{product.brand}</div>
                    <Link href={`/product/${product.id}`} className="font-medium text-sm line-clamp-1 hover:underline text-foreground">
                      {product.name}
                    </Link>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-sm font-semibold">
                        ₹{variants[0]?.sellingPrice?.toLocaleString("en-IN") || "0"}
                      </span>
                      {variants[0]?.mrp > variants[0]?.sellingPrice && (
                        <span className="text-xs text-muted-foreground line-through">
                          ₹{variants[0]?.mrp?.toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>

                    {/* Variant Picker Inline Panel */}
                    {hasMultipleVariants && activePickerProductId === product.id && (
                      <div className="mt-3 border-t border-border pt-3 space-y-2">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Select Options</div>
                        
                        {/* Sizes */}
                        {sizes.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {sizes.map((sz: any) => {
                              const isSelected = selectedVariant?.size === sz;
                              // Pick first variant matching size
                              const match = variants.find((v: any) => v.size === sz);
                              return (
                                <button
                                  key={sz}
                                  onClick={() => setSelectedVariantIds({ ...selectedVariantIds, [product.id]: match.id })}
                                  className={`rounded border px-2 py-0.5 text-xs ${isSelected ? "border-foreground bg-foreground text-background" : "border-input hover:border-foreground"}`}
                                >
                                  {sz}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Button */}
                    <div className="mt-auto pt-4 flex gap-2">
                      {hasMultipleVariants && activePickerProductId !== product.id ? (
                        <button
                          onClick={() => setActivePickerProductId(product.id)}
                          className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-input py-2 text-xs font-medium hover:border-foreground text-foreground"
                        >
                          Choose Options
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMoveToBag(product.id, variants)}
                          className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-foreground py-2 text-xs font-medium text-background hover:opacity-90"
                        >
                          <ShoppingBag className="h-3.5 w-3.5" /> Move to Bag
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
