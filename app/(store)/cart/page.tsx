"use client";

import { SmartImage } from "@/components/site/smart-image";
import Link from "next/link";
import { Minus, Plus, X, Tag, Loader2, CheckCircle, XCircle } from "lucide-react";
import { CustomerLayout } from "@/components/site/layout";
import { useCart } from "@/providers/cart-provider";
import type { CartItemWithRelations } from "@/providers/cart-provider";
import { useState } from "react";
import { toast } from "sonner";
import { applyCouponToCart, removeCouponFromCart } from "@/actions/promotions";

export default function CartPage() {
  const { cart, loading, updateQuantity, removeFromCart, refreshCart, promotionPrices, couponInfo } = useCart();
  const [couponInput, setCouponInput] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  const items = cart?.items || [];

  // Use promotion-adjusted prices for display
  const getEffectivePrice = (item: CartItemWithRelations) =>
    promotionPrices?.[item.variantId] ?? item.variant.sellingPrice;

  const subtotal = items.reduce((s: number, it: CartItemWithRelations) => s + Number(getEffectivePrice(it)) * it.quantity, 0);
  const mrp = items.reduce((s: number, it: CartItemWithRelations) => s + Number(it.variant.mrp) * it.quantity, 0);
  const variantDiscount = mrp - items.reduce((s, it) => s + Number(it.variant.sellingPrice) * it.quantity, 0);
  const promotionDiscount = items.reduce((s, it) => s + (Number(it.variant.sellingPrice) - Number(getEffectivePrice(it))) * it.quantity, 0);
  const couponDiscount = couponInfo?.valid ? couponInfo.totalDiscount : 0;
  const delivery = (subtotal > 999 || items.length === 0) ? 0 : 49;
  const total = subtotal + delivery - couponDiscount;

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    try {
      const res = await applyCouponToCart(couponInput);
      if (res.success) {
        toast.success(`Coupon "${res.couponCode}" applied!`);
        setCouponInput("");
        await refreshCart();
      } else {
        toast.error(res.error || "Invalid coupon.");
      }
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = async () => {
    setCouponLoading(true);
    try {
      await removeCouponFromCart();
      await refreshCart();
      toast.success("Coupon removed.");
    } finally {
      setCouponLoading(false);
    }
  };

  return (
    <CustomerLayout>
      <div className="container-page py-8">
        <h1 className="font-display text-3xl">Your bag</h1>
        
        {loading && items.length === 0 ? (
          <div className="flex h-96 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Loading your bag...</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              {items.map((it: CartItemWithRelations) => {
                const prod = it.variant.product;
                const images = prod.images || [];
                const itemImg = it.variant.images?.[0] || images[0] || "";
                const effectivePrice = getEffectivePrice(it);
                const hasPromoDiscount = Number(effectivePrice) < Number(it.variant.sellingPrice);
                return (
                  <div key={it.id} className="flex gap-4 rounded-md border border-border p-3 bg-card">
                    <div className="h-32 w-24 shrink-0 overflow-hidden rounded bg-muted">
                      <SmartImage src={itemImg} alt={prod.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex flex-1 flex-col">
                      <div className="flex justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground">{prod.seller?.storeName || "Unknown Seller"}</div>
                          <div className="truncate text-sm font-medium text-foreground">{prod.name}</div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {it.variant.size && <span>Size: {it.variant.size}</span>}
                            {it.variant.size && it.variant.color && <span>|</span>}
                            {it.variant.color && (
                              <span className="inline-flex items-center gap-1">
                                Color: <span className="inline-block h-3.5 w-3.5 rounded-full border border-border" style={{ backgroundColor: it.variant.color }} />
                              </span>
                            )}
                          </div>
                          {hasPromoDiscount && (
                            <span className="mt-1 inline-block rounded bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                              Promo applied
                            </span>
                          )}
                        </div>
                        <button 
                          onClick={() => removeFromCart(it.id)} 
                          className="text-muted-foreground hover:text-foreground cursor-pointer"
                          aria-label="Remove item"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-auto flex items-center justify-between">
                        <div className="inline-flex items-center rounded-md border border-input bg-background">
                          <button 
                            onClick={() => updateQuantity(it.id, it.quantity - 1)} 
                            className="grid h-8 w-8 place-items-center hover:bg-muted text-foreground cursor-pointer"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center text-sm font-medium text-foreground">{it.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(it.id, it.quantity + 1)} 
                            className="grid h-8 w-8 place-items-center hover:bg-muted text-foreground cursor-pointer"
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-foreground">
                            ₹{(effectivePrice * it.quantity).toLocaleString("en-IN")}
                          </div>
                          {hasPromoDiscount && (
                            <div className="text-xs text-muted-foreground line-through">
                              ₹{(Number(it.variant.sellingPrice) * it.quantity).toLocaleString("en-IN")}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && (
                <div className="rounded-md border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
                  Your bag is empty. <Link href="/" className="text-foreground underline">Continue shopping</Link>
                </div>
              )}
            </div>

            {items.length > 0 && (
              <aside className="h-fit space-y-4 rounded-md border border-border p-5 bg-card">
                {/* Coupon Input */}
                {!couponInfo ? (
                  <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3 text-sm">
                    <Tag className="h-4 w-4 text-accent shrink-0" />
                    <input
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === "Enter" && handleApplyCoupon()}
                      placeholder="Enter coupon code"
                      className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground text-foreground uppercase tracking-wider"
                    />
                    <button
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponInput.trim()}
                      className="text-sm font-medium text-accent hover:text-accent/80 disabled:opacity-50 transition"
                    >
                      {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                    </button>
                  </div>
                ) : (
                  <div className={`flex items-center justify-between rounded-md p-3 text-sm ${couponInfo.valid ? "bg-success/10 border border-success/20" : "bg-destructive/10 border border-destructive/20"}`}>
                    <div className="flex items-center gap-2">
                      {couponInfo.valid
                        ? <CheckCircle className="h-4 w-4 text-success shrink-0" />
                        : <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      }
                      <div>
                        <div className={`font-semibold font-mono text-xs ${couponInfo.valid ? "text-success" : "text-destructive"}`}>
                          {couponInfo.code}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {couponInfo.valid
                            ? `Saves ₹${couponInfo.totalDiscount.toLocaleString("en-IN")}`
                            : couponInfo.error
                          }
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleRemoveCoupon}
                      className="text-muted-foreground hover:text-foreground"
                      disabled={couponLoading}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Price Breakdown */}
                <div className="space-y-1.5 text-sm">
                  <Row label={`MRP (${items.length} items)`} value={`₹${mrp.toLocaleString("en-IN")}`} />
                  {variantDiscount > 0 && (
                    <Row label="Product Discount" value={`− ₹${variantDiscount.toLocaleString("en-IN")}`} accent />
                  )}
                  {promotionDiscount > 0 && (
                    <Row label="Promotion Discount" value={`− ₹${Math.round(promotionDiscount).toLocaleString("en-IN")}`} accent />
                  )}
                  {couponDiscount > 0 && (
                    <Row label={`Coupon (${couponInfo?.code})`} value={`− ₹${couponDiscount.toLocaleString("en-IN")}`} accent />
                  )}
                  <Row label="Delivery" value={delivery === 0 ? "Free" : `₹${delivery}`} />
                  <div className="my-2 border-t border-border" />
                  <Row label="Total" value={`₹${Math.max(0, total).toLocaleString("en-IN")}`} bold />
                  {(promotionDiscount > 0 || couponDiscount > 0) && (
                    <div className="rounded bg-success/10 px-3 py-1.5 text-xs text-success font-medium text-center">
                      You save ₹{Math.round(variantDiscount + promotionDiscount + couponDiscount).toLocaleString("en-IN")} on this order!
                    </div>
                  )}
                </div>
                <Link 
                  href="/checkout" 
                  className="block w-full rounded-md bg-foreground py-3 text-center text-sm font-medium text-background hover:opacity-90 transition-opacity"
                >
                  Checkout
                </Link>
              </aside>
            )}
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}

function Row({ label, value, accent, bold }: { label: string; value: string; accent?: boolean; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-medium text-foreground" : "text-foreground"}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className={accent ? "text-success font-medium" : ""}>{value}</span>
    </div>
  );
}
