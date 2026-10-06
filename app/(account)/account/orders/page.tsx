import { SmartImage } from "@/components/site/smart-image";
import { getCustomerOrders } from "@/actions/orders";
import { requireAuth } from "@/lib/auth-helpers";
import Link from "next/link";
import { ShoppingBag, ArrowRight } from "lucide-react";
import type { Order, OrderItem, SellerProfile, Shipment, PaymentTransaction, Review, ProductVariant } from "@prisma/client";
import ReturnDialog from "./return-dialog";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "My Orders — GarmentHub",
};

interface ProductSnapshot {
  name: string;
  brand?: string;
  images?: string[];
  description?: string;
}

interface VariantSnapshot {
  size?: string;
  color?: string;
  sku?: string;
}

type OrderWithRelations = Order & {
  items: (OrderItem & {
    review?: Review | null;
    variant?: ProductVariant | null;
  })[];
  seller: SellerProfile;
  shipment: Shipment | null;
  paymentTransactions: PaymentTransaction[];
};

export default async function Page() {
  // Ensure authenticated
  await requireAuth("/account/orders");
  const res = await getCustomerOrders();

  const orders = res.success && res.orders ? (res.orders as unknown as OrderWithRelations[]) : [];

  const activeRules = await prisma.returnReasonRule.findMany({
    where: { isActive: true },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  const reasonsList = activeRules.map((r) => r.name);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-foreground">Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage and track your recent orders and returns.
        </p>
      </div>

      <div className="space-y-6">
        {orders.map((o: OrderWithRelations) => (
          <div key={o.id} className="rounded-lg border border-border bg-card overflow-hidden">
            {/* Header info */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-muted/40 px-4 py-3 text-xs text-muted-foreground border-b border-border">
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <div>
                  <span className="font-medium text-foreground">Order ID: </span>
                  <span className="font-mono text-foreground">{o.orderNumber}</span>
                </div>
                <div>
                  <span className="font-medium text-foreground">Placed On: </span>
                  <span>{new Date(o.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
                </div>
                <div>
                  <span className="font-medium text-foreground">Seller: </span>
                  <span className="text-foreground font-medium">{o.seller?.storeName || "Unknown Seller"}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="font-medium text-foreground">Total: </span>
                <span className="text-sm font-semibold text-foreground">₹{Number(o.totalAmount).toLocaleString("en-IN")}</span>
              </div>
            </div>

            {/* Order Items */}
            <div className="divide-y divide-border px-4 py-1">
              {o.items.map((it) => {
                const prod = it.productSnapshot as unknown as ProductSnapshot;
                const variant = it.variantSnapshot as unknown as VariantSnapshot;
                const images = prod.images || [];
                const img = images[0] || "";

                return (
                  <div key={it.id} className="flex gap-4 py-4.5 text-sm">
                    <div className="h-20 w-16 shrink-0 overflow-hidden rounded border border-border bg-muted">
                      <SmartImage src={img} alt={prod.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium text-foreground truncate">{prod.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">Brand: {prod.brand || "Atelier 21"}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
                        {variant.size && <span>Size: {variant.size}</span>}
                        {variant.color && (
                          <span className="inline-flex items-center gap-1">
                            Color: <span className="inline-block h-3 w-3 rounded-full border border-border" style={{ backgroundColor: variant.color }} />
                          </span>
                        )}
                        <span>Qty: {it.quantity}</span>
                      </div>

                      {/* Review Actions */}
                      {(o.status === "SHIPPED" || o.status === "DELIVERED") && (
                        <div className="mt-3">
                          {it.review ? (
                            <Link
                              href={`/product/${it.variant?.productId || ""}?orderItemId=${it.id}&writeReview=true`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-900 border border-stone-200 rounded px-2.5 py-1 transition"
                            >
                              Edit Review
                            </Link>
                          ) : (
                            <Link
                              href={`/product/${it.variant?.productId || ""}?orderItemId=${it.id}&writeReview=true`}
                              className="inline-flex items-center gap-1 text-xs font-semibold bg-stone-900 text-white rounded px-2.5 py-1 hover:opacity-90 transition"
                            >
                              Write a Review
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-medium text-foreground">₹{(Number(it.price) * it.quantity).toLocaleString("en-IN")}</div>
                      <div className="text-xs text-muted-foreground mt-1">₹{Number(it.price).toLocaleString("en-IN")} each</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Shipment Tracking Timeline */}
            {o.shipment && (
              <div className="border-t border-border px-4 py-4 bg-muted/10 text-xs">
                <div className="font-semibold text-foreground mb-3 flex items-center justify-between">
                  <span>Shipment Fulfillment Status</span>
                  {o.shipment.courierName && (
                    <span className="text-[11px] font-normal text-muted-foreground">
                      {o.shipment.courierName} ({o.shipment.trackingNumber})
                      {o.shipment.trackingUrl && (
                        <a
                          href={o.shipment.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-primary hover:underline font-semibold"
                        >
                          Track Package ↗
                        </a>
                      )}
                    </span>
                  )}
                </div>

                {/* Progress Timeline dots */}
                <div className="relative flex items-center justify-between mt-6 mb-3 px-6">
                  {/* Connection lines */}
                  <div className="absolute left-10 right-10 top-3 h-0.5 bg-border -z-10" />
                  <div
                    className="absolute left-10 top-3 h-0.5 bg-primary -z-10 transition-all duration-500"
                    style={{
                      width:
                        o.shipment.shippingStatus === "DELIVERED"
                          ? "100%"
                          : o.shipment.shippingStatus === "SHIPPED"
                          ? "66%"
                          : o.shipment.shippingStatus === "PACKED"
                          ? "33%"
                          : "0%",
                    }}
                  />

                  {/* Steps */}
                  {[
                    { label: "Ordered", key: "PENDING" },
                    { label: "Packed", key: "PACKED" },
                    { label: "Shipped", key: "SHIPPED" },
                    { label: "Delivered", key: "DELIVERED" },
                  ].map((step, idx) => {
                    const statuses = ["PENDING", "PACKED", "SHIPPED", "DELIVERED"];
                    const currentIdx = statuses.indexOf(o.shipment!.shippingStatus);
                    const isCompleted = currentIdx >= idx;
                    const isCurrent = currentIdx === idx;

                    return (
                      <div key={step.key} className="flex flex-col items-center gap-1.5">
                        <div
                          className={`h-6.5 w-6.5 rounded-full flex items-center justify-center font-bold text-[10px] border transition-colors ${
                            isCompleted
                              ? "bg-primary border-primary text-primary-foreground"
                              : "bg-background border-border text-muted-foreground"
                          } ${isCurrent ? "ring-2 ring-primary/30" : ""}`}
                        >
                          {idx + 1}
                        </div>
                        <span className={`text-[10px] ${isCompleted ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Tracking Date info */}
                <div className="flex flex-wrap items-center justify-between gap-2 mt-4 px-1 text-muted-foreground text-[11px] border-t border-border/60 pt-2.5">
                  {o.shipment.estimatedDeliveryDate && (
                    <div>
                      Estimated Delivery: <span className="font-semibold text-foreground">{new Date(o.shipment.estimatedDeliveryDate).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
                    </div>
                  )}
                  {o.shipment.shippedAt && (
                    <div>
                      Shipped On: <span className="font-semibold text-foreground">{new Date(o.shipment.shippedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
                    </div>
                  )}
                  {o.shipment.deliveredAt && (
                    <div>
                      Delivered On: <span className="font-semibold text-foreground">{new Date(o.shipment.deliveredAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Status and Actions footer */}
            <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-muted/20 text-xs">
              <div className="flex gap-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium ${getStatusClasses(o.status)}`}>
                  Order: {o.status}
                </span>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-medium ${getPaymentStatusClasses(o.paymentStatus)}`}>
                  Payment: {o.paymentStatus}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {(o.status === "DELIVERED" || o.status === "RETURN_REQUESTED" || o.status === "RETURNED" || o.status === "REFUNDED") && (
                  <ReturnDialog
                    orderId={o.id}
                    orderNumber={o.orderNumber}
                    deliveryDate={o.shipment?.deliveredAt || o.updatedAt}
                    alreadyRequested={o.status === "RETURN_REQUESTED" || o.status === "RETURNED" || o.status === "REFUNDED"}
                    reasons={reasonsList}
                  />
                )}
                <Link
                  href={`/account/messages?orderId=${o.id}&sellerId=${o.sellerId}`}
                  className="inline-flex items-center justify-center rounded border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition cursor-pointer"
                >
                  Order Support Chat
                </Link>
                <div className="text-muted-foreground">
                  Method: <span className="font-semibold text-foreground font-mono">{o.paymentMethod}</span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {orders.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center text-muted-foreground bg-card">
            <ShoppingBag className="h-10 w-10 text-muted-foreground/60 mb-3" />
            <p className="text-sm font-medium">You haven&apos;t placed any orders yet.</p>
            <Link href="/" className="mt-4 text-xs font-semibold text-accent hover:underline inline-flex items-center gap-1">
              Start shopping <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function getStatusClasses(status: string) {
  switch (status) {
    case "DELIVERED":
      return "bg-success/10 text-success border border-success/20";
    case "CANCELLED":
      return "bg-destructive/10 text-destructive border border-destructive/20";
    case "PENDING":
      return "bg-amber-100 text-amber-800 border border-amber-200";
    case "CONFIRMED":
      return "bg-blue-100 text-blue-800 border border-blue-200";
    case "PROCESSING":
      return "bg-indigo-100 text-indigo-800 border border-indigo-200";
    case "SHIPPED":
      return "bg-purple-100 text-purple-800 border border-purple-200";
    default:
      return "bg-stone-100 text-stone-800 border border-stone-200";
  }
}

function getPaymentStatusClasses(status: string) {
  switch (status) {
    case "PAID":
      return "bg-success/10 text-success border border-success/20";
    case "FAILED":
      return "bg-destructive/10 text-destructive border border-destructive/20";
    case "REFUNDED":
      return "bg-amber-100 text-amber-800 border border-amber-200";
    case "PENDING":
    default:
      return "bg-stone-100 text-stone-800 border border-stone-200";
  }
}
