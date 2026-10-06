"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { removeOrderFromPackLog } from "@/actions/packlogs";
import { Loader2, ScanLine, Download } from "lucide-react";
import type { Order, OrderItem, User, Shipment, PackLog } from "@prisma/client";

type OrderWithRelations = Order & { items: OrderItem[]; user: User; shipment?: Shipment | null };
type PackLogWithOrders = PackLog & { orders: OrderWithRelations[] };

interface VariantSnapshot {
  sku?: string;
}

export default function PackLogDetailClient({ packLog }: { packLog: PackLogWithOrders }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  function handleRemove(orderId: string) {
    setBusyOrderId(orderId);
    startTransition(async () => {
      const res = await removeOrderFromPackLog(packLog.id, orderId);
      setBusyOrderId(null);
      if (res.success) {
        toast.success("Order removed from this pack log.");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to remove order.");
      }
    });
  }

  function exportOrders() {
    const idsParam = packLog.orders.map((o) => o.id).join(",");
    window.open(`/api/orders/documents?type=list&orderIds=${encodeURIComponent(idsParam)}`, "_blank");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            <Link href="/seller/pack-logs" className="hover:underline">
              Pack Logs
            </Link>{" "}
            / {packLog.name}
          </p>
          <h1 className="font-display text-3xl text-foreground mt-1">View Pack Log Details</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportOrders}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" /> Export Orders
          </button>
          <Link
            href={`/seller/pack-logs/${packLog.id}/scan`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-800 px-3 py-1.5 text-xs font-semibold"
          >
            <ScanLine className="h-3.5 w-3.5" /> Scan & Pack Orders
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Name</div>
          <div className="font-mono font-medium">{packLog.name}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Date</div>
          <div>{new Date(packLog.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Order Count</div>
          <div>{packLog.orderCount}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Total Qty</div>
          <div>{packLog.totalQty}</div>
        </div>
        <div className="col-span-2 sm:col-span-4">
          <div className="text-xs text-muted-foreground">Status</div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold border mt-1 ${
              packLog.status === "DISPATCHED"
                ? "bg-green-100 border-green-200 text-green-800"
                : "bg-stone-100 border-stone-200 text-stone-800"
            }`}
          >
            {packLog.status}
          </span>
        </div>
      </div>

      <div>
        <h2 className="font-medium text-foreground mb-3">Orders Info</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm text-foreground">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left">Order</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Buyer</th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">Qty</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Courier</th>
                <th className="px-4 py-3 text-left">AWB</th>
                <th className="px-4 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {packLog.orders.map((o) => (
                <tr key={o.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs">#{o.orderNumber}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(o.createdAt).toLocaleDateString("en-IN", { dateStyle: "short" })}
                  </td>
                  <td className="px-4 py-3 text-xs">{o.user?.name}</td>
                  <td className="px-4 py-3 text-xs">
                    {o.items.map((it) => (it.variantSnapshot as unknown as VariantSnapshot)?.sku).filter(Boolean).join(", ")}
                  </td>
                  <td className="px-4 py-3 text-xs">{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
                  <td className="px-4 py-3 text-xs">{o.status}</td>
                  <td className="px-4 py-3 text-xs">{o.shipment?.courierName || "-"}</td>
                  <td className="px-4 py-3 text-xs">{o.shipment?.trackingNumber || "-"}</td>
                  <td className="px-4 py-3 text-right">
                    {o.status === "PACKED" && (
                      <button
                        onClick={() => handleRemove(o.id)}
                        disabled={busyOrderId === o.id}
                        className="text-xs font-semibold text-destructive hover:underline disabled:opacity-50 cursor-pointer inline-flex items-center gap-1"
                      >
                        {busyOrderId === o.id && <Loader2 className="h-3 w-3 animate-spin" />}
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
