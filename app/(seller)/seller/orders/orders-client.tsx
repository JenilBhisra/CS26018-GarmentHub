"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { SmartImage } from "@/components/site/smart-image";
import { updateOrderStatus } from "@/actions/orders";
import { ORDER_TAB_STATUSES } from "@/lib/order-tabs";
import { markOrderDelivered } from "@/actions/shipping";
import { createPackLogFromOrders, bulkMarkReadyToShip, bulkConfirmShipment } from "@/actions/packlogs";
import { toast } from "sonner";
import { Loader2, Check, Search, Download, PackageOpen, Truck, Send } from "lucide-react";
import type { OrderStatus, Order, OrderItem, User, Shipment, PackLog } from "@prisma/client";

type OrderWithRelations = Order & {
  items: OrderItem[];
  user: User;
  shipment?: Shipment | null;
  packLog?: PackLog | null;
};

interface ProductSnapshot {
  name: string;
  images?: string[];
}

interface VariantSnapshot {
  size?: string;
  sku?: string;
}

type TabKey = keyof typeof ORDER_TAB_STATUSES | "all";

const TABS: { key: TabKey; label: string }[] = [
  { key: "new", label: "New" },
  { key: "packed", label: "Packed" },
  { key: "ready_to_ship", label: "Ready to Ship" },
  { key: "cancelled", label: "Cancelled" },
  { key: "all", label: "All Orders" },
];

interface TabCounts {
  new: number;
  packed: number;
  ready_to_ship: number;
  cancelled: number;
  all: number;
}

interface Props {
  initialOrders: OrderWithRelations[];
  total: number;
  page: number;
  pageSize: number;
  activeTab: TabKey;
  counts: TabCounts | null;
  search: string;
}

export default function SellerOrdersClient({ initialOrders, total, page, pageSize, activeTab, counts, search }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [isBusy, setIsBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState(search);

  const [confirmAction, setConfirmAction] = useState<null | "pack" | "dispatch">(null);
  const [isShipModalOpen, setIsShipModalOpen] = useState(false);
  const [shipEntries, setShipEntries] = useState<Record<string, { courierName: string; trackingNumber: string }>>({});

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function navigate(params: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(params)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  function switchTab(tab: TabKey) {
    setSelected(new Set());
    navigate({ tab, page: "1" });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === initialOrders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(initialOrders.map((o) => o.id)));
    }
  }

  const selectedIds = Array.from(selected);

  async function handlePackOrders() {
    setConfirmAction(null);
    setIsBusy(true);
    startTransition(async () => {
      const res = await createPackLogFromOrders(selectedIds);
      setIsBusy(false);
      if (res.success) {
        toast.success(`Pack Log ${res.name} created for ${selectedIds.length} order(s).`);
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(res.error || "Failed to pack orders.");
      }
    });
  }

  async function handleDispatchOrders() {
    setConfirmAction(null);
    setIsBusy(true);
    startTransition(async () => {
      const res = await bulkMarkReadyToShip(selectedIds);
      setIsBusy(false);
      if (res.succeeded.length > 0) {
        toast.success(`${res.succeeded.length} order(s) moved to Ready to Ship.`);
      }
      if (res.failed.length > 0) {
        toast.error(`${res.failed.length} order(s) failed: ${res.failed[0].error}`);
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  function openShipModal() {
    const entries: Record<string, { courierName: string; trackingNumber: string }> = {};
    for (const id of selectedIds) entries[id] = { courierName: "", trackingNumber: "" };
    setShipEntries(entries);
    setIsShipModalOpen(true);
  }

  async function handleConfirmShipment() {
    const entries = selectedIds.map((id) => ({
      orderId: id,
      courierName: shipEntries[id]?.courierName?.trim() || "",
      trackingNumber: shipEntries[id]?.trackingNumber?.trim() || "",
    }));
    if (entries.some((e) => !e.courierName || !e.trackingNumber)) {
      toast.error("Courier name and AWB/tracking number are required for every selected order.");
      return;
    }

    setIsShipModalOpen(false);
    setIsBusy(true);
    startTransition(async () => {
      const res = await bulkConfirmShipment(entries);
      setIsBusy(false);
      if (res.succeeded.length > 0) {
        toast.success(`${res.succeeded.length} order(s) confirmed shipped.`);
      }
      if (res.failed.length > 0) {
        toast.error(`${res.failed.length} order(s) failed: ${res.failed[0].error}`);
      }
      setSelected(new Set());
      router.refresh();
    });
  }

  function handleDownloadDocuments() {
    if (selectedIds.length === 0) return;
    const idsParam = selectedIds.join(",");
    window.open(`/api/orders/documents?type=labels&orderIds=${encodeURIComponent(idsParam)}`, "_blank");
    window.open(`/api/orders/documents?type=list&orderIds=${encodeURIComponent(idsParam)}`, "_blank");
  }

  async function handleMarkDelivered(orderId: string) {
    setIsBusy(true);
    startTransition(async () => {
      const res = await markOrderDelivered(orderId);
      setIsBusy(false);
      if (res.success) {
        toast.success("Order marked as delivered!");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to mark order as delivered.");
      }
    });
  }

  async function handleManualOverride(orderId: string, newStatus: OrderStatus) {
    setIsBusy(true);
    startTransition(async () => {
      const res = await updateOrderStatus(orderId, newStatus);
      setIsBusy(false);
      if (res.success) {
        toast.success("Order status updated.");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to update order status.");
      }
    });
  }

  return (
    <div className="space-y-6 relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-foreground">Orders Fulfillment</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Accept, pack, dispatch and track marketplace orders.
          </p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ search: searchInput, page: "1" });
          }}
          className="flex items-center gap-2"
        >
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search order, customer..."
              className="rounded-lg border border-input bg-background pl-8 pr-3 py-2 text-xs outline-none focus:border-accent"
            />
          </div>
        </form>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors cursor-pointer ${
              activeTab === t.key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {counts && t.key !== "all" && t.key in counts && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{counts[t.key as keyof TabCounts]}</span>
            )}
            {counts && t.key === "all" && <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{counts.all}</span>}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{selected.size} selected</span>
        {activeTab === "new" && (
          <button
            disabled={selected.size === 0 || isBusy}
            onClick={() => setConfirmAction("pack")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 cursor-pointer"
          >
            <PackageOpen className="h-3.5 w-3.5" /> Pack Orders
          </button>
        )}
        {activeTab === "packed" && (
          <>
            <button
              disabled={selected.size === 0 || isBusy}
              onClick={handleDownloadDocuments}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Download Documents
            </button>
            <button
              disabled={selected.size === 0 || isBusy}
              onClick={() => setConfirmAction("dispatch")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 cursor-pointer"
            >
              <Truck className="h-3.5 w-3.5" /> Dispatch Orders
            </button>
          </>
        )}
        {activeTab === "ready_to_ship" && (
          <>
            <button
              disabled={selected.size === 0 || isBusy}
              onClick={handleDownloadDocuments}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Download Documents
            </button>
            <button
              disabled={selected.size === 0 || isBusy}
              onClick={openShipModal}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 px-3 py-1.5 text-xs font-semibold disabled:opacity-40 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" /> Confirm Shipment
            </button>
          </>
        )}
        {isBusy && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> processing...
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm text-foreground">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
            <tr>
              <th className="px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={initialOrders.length > 0 && selected.size === initialOrders.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="px-4 py-3 text-left">Order</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Products</th>
              <th className="px-4 py-3 text-left">Total</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Pack Log</th>
              <th className="px-4 py-3 text-left">Manual Override</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {initialOrders.map((o) => (
              <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-3 py-3">
                  <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)} />
                </td>
                <td className="px-4 py-3 font-mono font-medium text-xs">#{o.orderNumber}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(o.createdAt).toLocaleDateString("en-IN", { dateStyle: "short" })}
                </td>
                <td className="px-4 py-3">
                  <div className="text-xs">
                    <div className="font-semibold text-foreground">{o.user?.name}</div>
                    <div className="text-muted-foreground">{o.shippingState || "-"}</div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="space-y-1.5 py-1">
                    {o.items.map((it) => {
                      const prod = it.productSnapshot as unknown as ProductSnapshot;
                      const variant = it.variantSnapshot as unknown as VariantSnapshot;
                      const images = prod.images || [];
                      return (
                        <div key={it.id} className="flex items-center gap-2 text-xs">
                          <SmartImage src={images[0]} className="h-8 w-6 shrink-0 rounded object-cover border border-border" alt="" />
                          <span className="truncate max-w-[150px] font-medium" title={prod.name}>
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
                <td className="px-4 py-3 font-medium">₹{Number(o.totalAmount).toLocaleString("en-IN")}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold border bg-stone-100 border-stone-200 text-stone-800">
                    {o.status}
                  </span>
                  {o.status === "SHIPPED" && (
                    <button
                      onClick={() => handleMarkDelivered(o.id)}
                      disabled={isBusy}
                      className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-green-700 hover:underline cursor-pointer"
                    >
                      <Check className="h-3 w-3" /> Mark Delivered
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">
                  {o.packLog ? (
                    <Link href={`/seller/pack-logs/${o.packLog.id}`} className="text-accent hover:underline font-mono">
                      {o.packLog.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={o.status}
                    disabled={isBusy}
                    onChange={(e) => handleManualOverride(o.id, e.target.value as OrderStatus)}
                    className="rounded border border-input bg-background px-2 py-1 text-xs outline-none focus:border-accent disabled:opacity-50 text-foreground"
                  >
                    {["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "CANCELLED"].map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}

            {initialOrders.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                  No orders in this tab.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-card rounded-lg">
          <p className="text-sm text-muted-foreground">
            Page <span className="font-medium">{page}</span> of <span className="font-medium">{totalPages}</span> ({total} orders)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => navigate({ page: String(Math.max(1, page - 1)) })}
              disabled={page <= 1}
              className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-50 cursor-pointer"
            >
              Previous
            </button>
            <button
              onClick={() => navigate({ page: String(Math.min(totalPages, page + 1)) })}
              disabled={page >= totalPages}
              className="rounded-md border border-border px-3 py-1.5 text-xs disabled:opacity-50 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Confirm dialogs for Pack Orders / Dispatch Orders */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-2xl">
            <h3 className="font-display text-lg text-foreground">Are you sure?</h3>
            <p className="text-sm text-muted-foreground mt-2">
              {confirmAction === "pack"
                ? `This will bundle ${selected.size} selected order(s) into a new Pack Log and mark them Packed.`
                : `This will move ${selected.size} selected order(s) to Ready to Ship.`}
            </p>
            <div className="flex gap-3 justify-end mt-5">
              <button onClick={() => setConfirmAction(null)} className="px-4 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted cursor-pointer">
                Cancel
              </button>
              <button
                onClick={confirmAction === "pack" ? handlePackOrders : handleDispatchOrders}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-stone-900 hover:bg-stone-800 text-white cursor-pointer"
              >
                {confirmAction === "pack" ? "Pack Orders" : "Dispatch Orders"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Shipment modal — courier + AWB per selected order */}
      {isShipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <h3 className="font-display text-lg text-foreground">Confirm Shipment</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Enter courier and AWB/tracking number for each order.
            </p>
            <div className="space-y-3 mt-4">
              {selectedIds.map((id) => {
                const order = initialOrders.find((o) => o.id === id);
                return (
                  <div key={id} className="rounded-lg border border-border p-3">
                    <div className="text-xs font-mono font-medium mb-2">#{order?.orderNumber}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        placeholder="Courier name"
                        value={shipEntries[id]?.courierName || ""}
                        onChange={(e) =>
                          setShipEntries((prev) => ({ ...prev, [id]: { ...prev[id], courierName: e.target.value } }))
                        }
                        className="rounded border border-input px-2 py-1.5 text-xs outline-none focus:border-accent bg-background"
                      />
                      <input
                        placeholder="AWB / Tracking #"
                        value={shipEntries[id]?.trackingNumber || ""}
                        onChange={(e) =>
                          setShipEntries((prev) => ({ ...prev, [id]: { ...prev[id], trackingNumber: e.target.value } }))
                        }
                        className="rounded border border-input px-2 py-1.5 text-xs outline-none focus:border-accent bg-background"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 justify-end mt-5 border-t border-border pt-4">
              <button onClick={() => setIsShipModalOpen(false)} className="px-4 py-2 text-xs font-semibold rounded-lg border border-border hover:bg-muted cursor-pointer">
                Cancel
              </button>
              <button onClick={handleConfirmShipment} className="px-4 py-2 text-xs font-semibold rounded-lg bg-green-600 hover:bg-green-700 text-white cursor-pointer">
                Confirm Shipment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
