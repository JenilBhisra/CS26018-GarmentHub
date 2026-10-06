"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, ArrowLeft } from "lucide-react";
import { CustomerLayout } from "@/components/site/layout";
import { useCart } from "@/providers/cart-provider";
import type { CartItemWithRelations } from "@/providers/cart-provider";
import { SmartImage } from "@/components/site/smart-image";
import { createOrders } from "@/actions/orders";
import { toast } from "sonner";

const PAYMENTS = [
  { id: "COD", label: "Cash on Delivery (COD)" },
  { id: "MANUAL", label: "Manual Payment / Bank Transfer" },
];

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir", "Ladakh",
  "Chandigarh", "Puducherry", "Andaman and Nicobar Islands", "Dadra and Nagar Haveli and Daman and Diu",
  "Lakshadweep",
];

export default function CheckoutPage() {
  const { cart, loading: cartLoading, refreshCart, promotionPrices, couponInfo } = useCart();
  const [isPending, startTransition] = useTransition();

  const [addressLine, setAddressLine] = useState("204, Indigo Apts, Koramangala");
  const [city, setCity] = useState("Bengaluru");
  const [state, setState] = useState("Karnataka");
  const [pincode, setPincode] = useState("560034");
  const address = `${addressLine}, ${city}, ${state} - ${pincode}`;
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [orderResults, setOrderResults] = useState<{ success: boolean; orderIds?: string[]; error?: string } | null>(null);

  const items = cart?.items || [];

  // Use promotion-adjusted prices
  const getEffectivePrice = (it: CartItemWithRelations) =>
    promotionPrices?.[it.variantId] ?? it.variant.sellingPrice;

  // Group items by seller for display
  const groupedItems: Record<string, { sellerName: string; items: CartItemWithRelations[] }> = {};
  items.forEach((it: CartItemWithRelations) => {
    const sellerId = it.variant.product.sellerId;
    const sellerName = it.variant.product.seller?.storeName || "Unknown Seller";
    if (!groupedItems[sellerId]) {
      groupedItems[sellerId] = { sellerName, items: [] };
    }
    groupedItems[sellerId].items.push(it);
  });

  // Calculate pricing with promotion-adjusted prices
  const subtotal = items.reduce((s: number, it: CartItemWithRelations) => s + getEffectivePrice(it) * it.quantity, 0);
  
  // Calculate delivery & platform fee per seller split order
  let totalDelivery = 0;
  let totalPlatform = 0;
  Object.values(groupedItems).forEach((group: { sellerName: string; items: CartItemWithRelations[] }) => {
    const orderSubtotal = group.items.reduce((s, it) => s + getEffectivePrice(it) * it.quantity, 0);
    totalDelivery += orderSubtotal > 999 ? 0 : 49;
    totalPlatform += 15; // Rs 15 platform fee per order split
  });

  const couponDiscount = couponInfo?.valid ? couponInfo.totalDiscount : 0;
  const grandTotal = Math.max(0, subtotal + totalDelivery + totalPlatform - couponDiscount);

  const handlePlaceOrder = () => {
    if (!addressLine.trim() || !city.trim() || !state.trim() || !pincode.trim()) {
      toast.error("Please complete all address fields (address, city, state, and pincode).");
      return;
    }

    startTransition(async () => {
      // Pass applied coupon code from cart state
      const appliedCoupon = couponInfo?.valid ? couponInfo.code : undefined;
      const res = await createOrders({ addressLine, city, state, pincode }, paymentMethod, appliedCoupon);
      if (res.success) {
        toast.success("Order placed successfully!");
        setOrderResults(res);
        await refreshCart();
      } else {
        toast.error(res.error || "Failed to place order.");
        setOrderResults({ success: false, error: res.error });
      }
    });
  };


  if (orderResults?.success) {

    return (
      <CustomerLayout>
        <div className="container-page py-16 flex flex-col items-center justify-center text-center">
          <div className="rounded-full bg-success/10 p-5 text-success">
            <CheckCircle2 className="h-16 w-16" />
          </div>
          <h1 className="font-display text-4xl mt-6">Order Placed!</h1>
          <p className="mt-2 text-muted-foreground max-w-md">
            Thank you for shopping with us! Your order has been placed and split by seller to facilitate shipping.
          </p>

          <div className="mt-8 border border-border rounded-lg p-5 w-full max-w-md bg-card text-left space-y-2">
            <h3 className="font-medium text-foreground">Order Reference Details:</h3>
            <div className="text-sm space-y-1 text-muted-foreground">
              <div><span className="font-medium text-foreground">Status:</span> PENDING</div>
              <div><span className="font-medium text-foreground">Payment Method:</span> {paymentMethod}</div>
              <div><span className="font-medium text-foreground">Shipping To:</span> {address}</div>
            </div>
          </div>

          <div className="mt-8 flex gap-4">
            <Link 
              href="/account/orders" 
              className="rounded-md bg-foreground px-6 py-2.5 text-sm font-medium text-background hover:opacity-90"
            >
              View Order History
            </Link>
            <Link 
              href="/" 
              className="rounded-md border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="container-page py-8">
        <div className="mb-6">
          <Link href="/cart" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to bag
          </Link>
        </div>

        <h1 className="font-display text-3xl mb-6">Checkout</h1>

        {items.length === 0 && !cartLoading ? (
          <div className="rounded-md border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            Your bag is empty. <Link href="/" className="text-foreground underline">Continue shopping</Link> to checkout.
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
            <div className="space-y-6">
              {/* Delivery Address */}
              <section className="rounded-md border border-border p-5 bg-card">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-medium text-foreground">Delivery Address</h2>
                  <button 
                    onClick={() => setIsEditingAddress(!isEditingAddress)} 
                    className="text-sm text-accent font-medium hover:underline cursor-pointer"
                  >
                    {isEditingAddress ? "Cancel" : "Change"}
                  </button>
                </div>
                {isEditingAddress ? (
                  <div className="space-y-3">
                    <textarea
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      className="w-full min-h-[60px] rounded border border-input p-2.5 text-sm bg-background text-foreground focus:border-accent outline-none"
                      placeholder="House/flat no., street, landmark"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="City"
                        className="rounded border border-input p-2.5 text-sm bg-background text-foreground focus:border-accent outline-none"
                      />
                      <select
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className="rounded border border-input p-2.5 text-sm bg-background text-foreground focus:border-accent outline-none"
                      >
                        {INDIAN_STATES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <input
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value)}
                        placeholder="Pincode"
                        inputMode="numeric"
                        className="rounded border border-input p-2.5 text-sm bg-background text-foreground focus:border-accent outline-none"
                      />
                    </div>
                    <button
                      onClick={() => setIsEditingAddress(false)}
                      className="rounded bg-foreground px-4 py-2 text-xs font-medium text-background hover:opacity-90"
                    >
                      Save Address
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {address || <span className="text-destructive">No shipping address added. Please add one.</span>}
                  </p>
                )}
              </section>

              {/* Payment Method */}
              <section className="rounded-md border border-border p-5 bg-card">
                <h2 className="mb-3 font-medium text-foreground">Payment Method</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {PAYMENTS.map((p) => (
                    <label 
                      key={p.id} 
                      className={`flex cursor-pointer items-center gap-3 rounded-md border p-3.5 text-sm transition-all ${
                        paymentMethod === p.id 
                          ? "border-foreground bg-foreground/5 font-medium" 
                          : "border-border hover:border-foreground/50 bg-background"
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="payment"
                        checked={paymentMethod === p.id} 
                        onChange={() => setPaymentMethod(p.id)} 
                        className="accent-accent" 
                      />
                      <span className="text-foreground">{p.label}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-3.5 text-xs text-muted-foreground leading-normal">
                  * Dynamic payment gateway (Razorpay) integration is disabled for this test phase. 
                  COD/Manual payment status will be marked as PENDING.
                </p>
              </section>

              {/* Grouped Items Review */}
              <section className="space-y-4">
                <h2 className="font-medium text-foreground">Review Items (Split by Atelier)</h2>
                {Object.entries(groupedItems).map(([sellerId, group]) => (
                  <div key={sellerId} className="rounded-md border border-border bg-card p-4">
                    <div className="mb-3 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Seller: {group.sellerName}
                    </div>
                    <div className="space-y-3">
                      {group.items.map((it: CartItemWithRelations) => {
                        const isStockError = it.variant.stock < it.quantity;
                        return (
                          <div key={it.id} className="flex gap-3 text-sm">
                            <SmartImage 
                              src={it.variant.images?.[0] || it.variant.product.images?.[0]} 
                              alt={it.variant.product.name} 
                              className="h-16 w-12 rounded object-cover shrink-0" 
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-foreground truncate">{it.variant.product.name}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {it.variant.size && `Size ${it.variant.size}`}
                                {it.variant.size && it.variant.color && " | "}
                                {it.variant.color && `Color ${it.variant.color}`}
                              </div>
                              <div className="text-xs text-foreground mt-1">
                                Qty: {it.quantity} × ₹{Number(it.variant.sellingPrice).toLocaleString("en-IN")}
                              </div>
                            </div>
                            <div className="text-right font-medium text-foreground shrink-0">
                              ₹{(Number(it.variant.sellingPrice) * it.quantity).toLocaleString("en-IN")}
                              {isStockError && (
                                <div className="text-[10px] text-destructive mt-1 font-semibold">
                                  Insufficient stock ({it.variant.stock} left)
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>
            </div>

            {/* Order Summary */}
            <aside className="h-fit space-y-4 rounded-md border border-border p-5 bg-card">
              <h2 className="font-medium text-foreground">Order Summary</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-foreground">
                  <span className="text-muted-foreground">Bag Subtotal</span>
                  <span>₹{subtotal.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-foreground">
                  <span className="text-muted-foreground">Estimated Delivery</span>
                  <span>{totalDelivery === 0 ? "Free" : `₹${totalDelivery.toLocaleString("en-IN")}`}</span>
                </div>
                <div className="flex justify-between text-foreground">
                  <span className="text-muted-foreground">Platform fees</span>
                  <span>₹{totalPlatform.toLocaleString("en-IN")}</span>
                </div>
                {couponInfo?.valid && couponInfo.totalDiscount > 0 && (
                  <div className="flex justify-between text-success font-medium">
                    <span>Coupon ({couponInfo.code})</span>
                    <span>− ₹{couponInfo.totalDiscount.toLocaleString("en-IN")}</span>
                  </div>
                )}
                <div className="my-2 border-t border-border" />
                <div className="flex justify-between text-base font-semibold text-foreground">
                  <span>Grand Total</span>
                  <span>₹{grandTotal.toLocaleString("en-IN")}</span>
                </div>
              </div>


              {/* Stock limit checks */}
              {items.some((it: CartItemWithRelations) => it.variant.stock < it.quantity) ? (
                <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive font-medium">
                  One or more items in your bag exceed current seller stock. 
                  Please return to the bag page and reduce quantities before continuing.
                </div>
              ) : (
                <button 
                  onClick={handlePlaceOrder}
                  disabled={isPending || cartLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-accent py-3 text-center text-sm font-medium text-accent-foreground hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Placing Order...
                    </>
                  ) : (
                    "Place Order (COD / Manual)"
                  )}
                </button>
              )}
            </aside>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
