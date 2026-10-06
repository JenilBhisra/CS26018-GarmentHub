"use client";

import { useState, useTransition } from "react";
import { SmartImage } from "@/components/site/smart-image";
import { updateOrderStatus } from "@/actions/orders";
import { updateShipmentAdmin } from "@/actions/shipping";
import { toast } from "sonner";
import { Loader2, Edit, X } from "lucide-react";
import type { OrderStatus, PaymentStatus, Order, OrderItem, User, SellerProfile, Shipment, ShipmentStatus } from "@prisma/client";

type OrderWithRelations = Order & {
  items: OrderItem[];
  user: User;
  seller: SellerProfile;
  shipment?: Shipment | null;
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

const ORDER_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

const PAYMENT_STATUSES: PaymentStatus[] = [
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
];

const SHIPMENT_STATUSES: ShipmentStatus[] = [
  "PENDING",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "RETURNED",
  "CANCELLED",
];

export default function AdminOrdersClient({ initialOrders }: { initialOrders: OrderWithRelations[] }) {
  const [orders, setOrders] = useState<OrderWithRelations[]>(initialOrders);
  const [, startTransition] = useTransition();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const paginatedOrders = orders.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(orders.length / pageSize);

  // Shipment override modal state
  const [selectedOrder, setSelectedOrder] = useState<OrderWithRelations | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [courierName, setCourierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [estDeliveryDate, setEstDeliveryDate] = useState("");
  const [shippingStatus, setShippingStatus] = useState<ShipmentStatus>("PENDING");

  const openFulfillmentModal = (order: OrderWithRelations) => {
    setSelectedOrder(order);
    setCourierName(order.shipment?.courierName || "");
    setTrackingNumber(order.shipment?.trackingNumber || "");
    setTrackingUrl(order.shipment?.trackingUrl || "");
    setShippingStatus(order.shipment?.shippingStatus || "PENDING");
    if (order.shipment?.estimatedDeliveryDate) {
      const d = new Date(order.shipment.estimatedDeliveryDate);
      setEstDeliveryDate(d.toISOString().substring(0, 10));
    } else {
      setEstDeliveryDate("");
    }
    setIsModalOpen(true);
  };

  const handleFulfillmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setUpdatingId(selectedOrder.id);
    setIsModalOpen(false);

    startTransition(async () => {
      const res = await updateShipmentAdmin(selectedOrder.id, {
        courierName: courierName.trim() || undefined,
        trackingNumber: trackingNumber.trim() || undefined,
        trackingUrl: trackingUrl.trim() || undefined,
        estimatedDeliveryDate: estDeliveryDate || undefined,
        shippingStatus: shippingStatus || undefined,
      });

      if (res.success && res.shipment) {
        toast.success("Shipment and tracking details updated!");
        setOrders((prev) =>
          prev.map((o) => {
            if (o.id === selectedOrder.id) {
              let nextOrderStatus = o.status;
              let nextPaymentStatus = o.paymentStatus;
              
              if (shippingStatus === "DELIVERED") {
                nextOrderStatus = "DELIVERED";
                nextPaymentStatus = "PAID";
              } else if (shippingStatus === "SHIPPED") {
                nextOrderStatus = "SHIPPED";
              } else if (shippingStatus === "PACKED") {
                nextOrderStatus = "PACKED";
              } else if (shippingStatus === "CANCELLED") {
                nextOrderStatus = "CANCELLED";
              }

              return {
                ...o,
                status: nextOrderStatus,
                paymentStatus: nextPaymentStatus,
                shipment: res.shipment,
              };
            }
            return o;
          })
        );
      } else {
        toast.error(res.error || "Failed to update shipment.");
      }
      setSelectedOrder(null);
      setUpdatingId(null);
    });
  };

  const handleStatusChange = async (
    orderId: string,
    newStatus: OrderStatus,
    newPaymentStatus?: PaymentStatus
  ) => {
    setUpdatingId(orderId);
    startTransition(async () => {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      const updatedStatus = newStatus || order.status;
      const updatedPaymentStatus = newPaymentStatus || order.paymentStatus;

      const res = await updateOrderStatus(orderId, updatedStatus, updatedPaymentStatus);
      if (res.success) {
        toast.success("Order updated successfully!");
        setOrders(
          orders.map((o) =>
            o.id === orderId
              ? { ...o, status: updatedStatus, paymentStatus: updatedPaymentStatus }
              : o
          )
        );
      } else {
        toast.error(res.error || "Failed to update order status.");
      }
      setUpdatingId(null);
    });
  };

  return (
    <div className="space-y-6 relative">
      <div>
        <h1 className="font-display text-3xl text-foreground">All Orders Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Administrator command center to view, manage, and moderate all orders placed across GarmentHub.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm text-foreground">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left">Order</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Seller</th>
              <th className="px-4 py-3 text-left">Products</th>
              <th className="px-4 py-3 text-left">Total</th>
              <th className="px-4 py-3 text-left">Fulfillment Tracking</th>
              <th className="px-4 py-3 text-left">Order Status</th>
              <th className="px-4 py-3 text-left">Payment Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginatedOrders.map((o) => (
              <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-mono font-medium text-xs">
                  #{o.orderNumber}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(o.createdAt).toLocaleDateString("en-IN", { dateStyle: "short" })}
                </td>
                <td className="px-4 py-3">
                  <div className="text-xs">
                    <div className="font-semibold text-foreground">{o.user?.name}</div>
                    <div className="text-muted-foreground">{o.user?.email}</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="font-semibold text-foreground">{o.seller?.storeName}</div>
                  <div className="text-muted-foreground truncate max-w-[150px]" title={o.seller?.pickupAddress}>{o.seller?.pickupAddress}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1.5 py-1">
                    {o.items.map((it) => {
                      const prod = it.productSnapshot as unknown as ProductSnapshot;
                      const variant = it.variantSnapshot as unknown as VariantSnapshot;
                      const images = prod.images || [];
                      return (
                        <div key={it.id} className="flex items-center gap-2 text-xs">
                          <SmartImage
                            src={images[0]}
                            className="h-8 w-6 shrink-0 rounded object-cover border border-border"
                            alt=""
                          />
                          <span className="truncate max-w-[100px] font-medium" title={prod.name}>
                            {prod.name}
                          </span>
                          <span className="text-muted-foreground">
                            (Qty: {it.quantity})
                            {variant.size && ` · Sz: ${variant.size}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium">
                  ₹{Number(o.totalAmount).toLocaleString("en-IN")}
                </td>

                <td className="px-4 py-3 text-xs">
                  <div className="flex flex-col gap-1.5 w-fit">
                    {o.shipment ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold border ${
                            o.shipment.shippingStatus === "DELIVERED"
                              ? "bg-green-100 border-green-200 text-green-800"
                              : o.shipment.shippingStatus === "SHIPPED"
                              ? "bg-purple-100 border-purple-200 text-purple-800"
                              : "bg-amber-100 border-amber-200 text-amber-800"
                          }`}>
                            {o.shipment.shippingStatus}
                          </span>
                        </div>
                        {o.shipment.courierName && (
                          <div className="text-[10px] text-muted-foreground mt-1">
                            Courier: <span className="font-semibold text-foreground">{o.shipment.courierName}</span>
                          </div>
                        )}
                        {o.shipment.trackingNumber && (
                          <div className="text-[10px] text-muted-foreground font-mono">
                            ID: {o.shipment.trackingNumber}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No Shipment logged</span>
                    )}
                    <button
                      onClick={() => openFulfillmentModal(o)}
                      disabled={updatingId === o.id}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline mt-1 disabled:opacity-50 cursor-pointer"
                    >
                      <Edit className="h-3 w-3" /> Manage Shipment
                    </button>
                  </div>
                </td>

                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <select
                      value={o.status}
                      disabled={updatingId === o.id}
                      onChange={(e) => handleStatusChange(o.id, e.target.value as OrderStatus)}
                      className="rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:border-accent disabled:opacity-50 text-foreground"
                    >
                      {ORDER_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    {updatingId === o.id && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  </div>
                </td>

                <td className="px-4 py-3">
                  <select
                    value={o.paymentStatus}
                    disabled={updatingId === o.id}
                    onChange={(e) => handleStatusChange(o.id, o.status, e.target.value as PaymentStatus)}
                    className="rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:border-accent disabled:opacity-50 text-foreground"
                  >
                    {PAYMENT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}

            {orders.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                  No orders placed in the system yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-card sm:px-6 rounded-lg mt-4 shadow-sm">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="relative inline-flex items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-stone-750 hover:bg-stone-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="relative ml-3 inline-flex items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-stone-755 hover:bg-stone-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-stone-700">
                Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to <span className="font-medium">{Math.min(currentPage * pageSize, orders.length)}</span> of{" "}
                <span className="font-medium">{orders.length}</span> results
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm bg-white" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-stone-400 ring-1 ring-inset ring-border hover:bg-stone-50 disabled:opacity-50"
                >
                  &larr;
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  const isCurrent = pNum === currentPage;
                  return (
                    <button
                      key={pNum}
                      onClick={() => setCurrentPage(pNum)}
                      aria-current={isCurrent ? "page" : undefined}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 ${isCurrent ? "z-10 bg-stone-900 text-white" : "text-stone-950 ring-1 ring-inset ring-border hover:bg-stone-50"}`}
                    >
                      {pNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-stone-400 ring-1 ring-inset ring-border hover:bg-stone-50 disabled:opacity-50"
                >
                  &rarr;
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-display text-lg text-foreground">Manage Order Shipment</h3>
                <span className="text-xs text-muted-foreground font-mono">Order #{selectedOrder.orderNumber}</span>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedOrder(null);
                }}
                className="rounded-full p-1 hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleFulfillmentSubmit} className="space-y-4 mt-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Shipment Status Override</label>
                <select
                  value={shippingStatus}
                  onChange={(e) => setShippingStatus(e.target.value as ShipmentStatus)}
                  className="w-full rounded-lg border border-input px-3 py-2 bg-muted/20 focus:border-accent focus:bg-background outline-none transition text-foreground"
                >
                  {SHIPMENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Courier / Carrier Name</label>
                <input
                  type="text"
                  placeholder="e.g. Delhivery, Bluedart"
                  value={courierName}
                  onChange={(e) => setCourierName(e.target.value)}
                  className="w-full rounded-lg border border-input px-3 py-2 bg-muted/20 focus:border-accent focus:bg-background outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Tracking Number</label>
                <input
                  type="text"
                  placeholder="e.g. 193710527"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="w-full rounded-lg border border-input px-3 py-2 bg-muted/20 focus:border-accent focus:bg-background outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Tracking URL</label>
                <input
                  type="url"
                  placeholder="https://track.delhivery.com/..."
                  value={trackingUrl}
                  onChange={(e) => setTrackingUrl(e.target.value)}
                  className="w-full rounded-lg border border-input px-3 py-2 bg-muted/20 focus:border-accent focus:bg-background outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">Estimated Delivery Date</label>
                <input
                  type="date"
                  value={estDeliveryDate}
                  onChange={(e) => setEstDeliveryDate(e.target.value)}
                  className="w-full rounded-lg border border-input px-3 py-2 bg-muted/20 focus:border-accent focus:bg-background outline-none transition text-foreground"
                />
              </div>

              <div className="flex gap-3 justify-end border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedOrder(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-stone-900 hover:bg-stone-850 text-white cursor-pointer"
                >
                  Save Shipment Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
