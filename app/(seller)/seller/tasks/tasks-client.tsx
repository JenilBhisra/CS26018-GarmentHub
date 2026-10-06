"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Truck, Package, AlertTriangle, CornerUpLeft, Search,
  ArrowRight, CheckCircle2, Clock, Sparkles, ExternalLink
} from "lucide-react";
import Link from "next/link";

interface OrderToShip {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  firstProductName: string;
  itemCount: number;
  totalAmount: number;
  createdAt: Date;
  status: string;
}

interface StockVariant {
  id: string;
  productId: string;
  productName: string;
  size: string | null;
  color: string | null;
  stock: number;
  sku: string | null;
}

interface PendingReturn {
  id: string;
  orderNumber: string;
  customerName: string;
  reason: string;
  status: string;
  refundAmount: number;
  createdAt: Date;
  firstProductName: string;
}

interface SellerTasksClientProps {
  ordersToShip: OrderToShip[];
  lowStockVariants: StockVariant[];
  outOfStockVariants: StockVariant[];
  pendingReturns: PendingReturn[];
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  REQUESTED: {
    label: "Refund Requested",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  ITEM_RECEIVED: {
    label: "Item Received",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
};

export default function SellerTasksClient({
  ordersToShip,
  lowStockVariants,
  outOfStockVariants,
  pendingReturns,
}: SellerTasksClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "all" | "shipment" | "inventory" | "returns"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Formats currency
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);

  // Format relative date e.g. "3 days ago"
  const relativeDate = (date: Date) => {
    const d = new Date(date);
    const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    return `${diff} days ago`;
  };

  // Filtered data
  const q = searchQuery.toLowerCase();
  const filteredOrders = ordersToShip.filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.firstProductName.toLowerCase().includes(q)
  );
  const filteredLow = lowStockVariants.filter(
    (v) =>
      v.productName.toLowerCase().includes(q) ||
      (v.sku || "").toLowerCase().includes(q)
  );
  const filteredOut = outOfStockVariants.filter(
    (v) =>
      v.productName.toLowerCase().includes(q) ||
      (v.sku || "").toLowerCase().includes(q)
  );
  const filteredReturns = pendingReturns.filter(
    (r) =>
      r.orderNumber.toLowerCase().includes(q) ||
      r.customerName.toLowerCase().includes(q) ||
      r.firstProductName.toLowerCase().includes(q)
  );

  const totalTasks =
    filteredOrders.length +
    filteredLow.length +
    filteredOut.length +
    filteredReturns.length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-light text-stone-900 flex items-center gap-3">
            My Task Center
            {totalTasks > 0 && (
              <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 border border-rose-200">
                {totalTasks} pending
              </span>
            )}
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Everything that needs your attention — shipments, inventory, and
            return requests.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-stone-200 bg-white py-1.5 pl-10 pr-4 text-xs font-medium placeholder:text-stone-400 focus:border-stone-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-stone-200 pb-px overflow-x-auto hide-scrollbar">
        {[
          { id: "all", label: `All Tasks (${totalTasks})` },
          { id: "shipment", label: `Ship Orders (${filteredOrders.length})` },
          {
            id: "inventory",
            label: `Inventory Alerts (${filteredLow.length + filteredOut.length})`,
          },
          {
            id: "returns",
            label: `Pending Returns (${filteredReturns.length})`,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`shrink-0 pb-3 text-xs font-semibold border-b-2 transition-all px-2 ${
              activeTab === tab.id
                ? "border-stone-900 text-stone-900"
                : "border-transparent text-stone-500 hover:text-stone-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SECTION 1: Orders to ship */}
      {(activeTab === "all" || activeTab === "shipment") &&
        filteredOrders.length > 0 && (
          <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Truck className="h-4 w-4 text-indigo-600" />
                Orders Awaiting Shipment
                <span className="ml-1 inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                  {filteredOrders.length}
                </span>
              </h2>
              <Link
                href="/seller/orders"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                View all orders <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-100 text-stone-400 font-bold uppercase tracking-wider">
                    <th className="py-2.5">Order #</th>
                    <th className="py-2.5">Customer</th>
                    <th className="py-2.5">Product</th>
                    <th className="py-2.5 text-right">Amount</th>
                    <th className="py-2.5 text-center">Waiting</th>
                    <th className="py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50 text-stone-700 font-medium">
                  {filteredOrders.map((o) => (
                    <tr key={o.id} className="hover:bg-stone-50/50">
                      <td className="py-3 font-mono font-bold text-stone-900">
                        #{o.orderNumber}
                      </td>
                      <td className="py-3">
                        <div className="font-semibold">{o.customerName}</div>
                        <div className="text-stone-400 text-[10px]">
                          {o.customerEmail}
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="line-clamp-1 max-w-[180px]">
                          {o.firstProductName}
                        </div>
                        {o.itemCount > 1 && (
                          <div className="text-stone-400 text-[10px]">
                            +{o.itemCount - 1} more item(s)
                          </div>
                        )}
                      </td>
                      <td className="py-3 text-right font-bold text-stone-950">
                        {fmt(o.totalAmount)}
                      </td>
                      <td className="py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-amber-600 font-semibold">
                          <Clock className="h-3 w-3" />
                          {relativeDate(o.createdAt)}
                        </span>
                      </td>
                      <td className="py-3">
                        <Link
                          href={`/seller/orders`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                        >
                          Ship <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      {/* SECTION 2: Inventory Alerts */}
      {(activeTab === "all" || activeTab === "inventory") &&
        (filteredOut.length > 0 || filteredLow.length > 0) && (
          <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <Package className="h-4 w-4 text-rose-600" />
                Inventory Alerts
              </h2>
              <Link
                href="/seller/products"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                Manage inventory <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Out of stock */}
            {filteredOut.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Out of Stock ({filteredOut.length})
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredOut.map((v) => (
                    <Link
                      key={v.id}
                      href={`/seller/products`}
                      className="flex items-center justify-between rounded-lg border border-rose-100 bg-rose-50/40 px-3 py-2.5 hover:bg-rose-50 transition"
                    >
                      <div>
                        <div className="font-semibold text-stone-900 text-xs line-clamp-1">
                          {v.productName}
                        </div>
                        <div className="text-[10px] text-stone-500 mt-0.5">
                          {[v.size, v.color].filter(Boolean).join(" / ") ||
                            "Default"}{" "}
                          {v.sku && `· ${v.sku}`}
                        </div>
                      </div>
                      <span className="ml-2 shrink-0 inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[9px] font-bold text-rose-700">
                        OUT OF STOCK
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Low stock */}
            {filteredLow.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Low Stock — Restock Soon ({filteredLow.length})
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredLow.map((v) => (
                    <Link
                      key={v.id}
                      href={`/seller/products`}
                      className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50/40 px-3 py-2.5 hover:bg-amber-50 transition"
                    >
                      <div>
                        <div className="font-semibold text-stone-900 text-xs line-clamp-1">
                          {v.productName}
                        </div>
                        <div className="text-[10px] text-stone-500 mt-0.5">
                          {[v.size, v.color].filter(Boolean).join(" / ") ||
                            "Default"}{" "}
                          {v.sku && `· ${v.sku}`}
                        </div>
                      </div>
                      <span className="ml-2 shrink-0 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                        {v.stock} LEFT
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

      {/* SECTION 3: Pending Returns */}
      {(activeTab === "all" || activeTab === "returns") &&
        filteredReturns.length > 0 && (
          <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <CornerUpLeft className="h-4 w-4 text-purple-600" />
                Return Requests Needing Attention
                <span className="ml-1 inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                  {filteredReturns.length}
                </span>
              </h2>
              <Link
                href="/seller/returns"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                View all returns <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {filteredReturns.map((r) => {
                const statusMeta =
                  STATUS_LABELS[r.status] || {
                    label: r.status,
                    className: "bg-stone-100 text-stone-600 border-stone-200",
                  };

                return (
                  <div
                    key={r.id}
                    className="rounded-xl border border-stone-200 bg-stone-50/30 p-4 space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-mono font-bold text-stone-900 text-xs">
                          #{r.orderNumber}
                        </div>
                        <div className="text-[11px] text-stone-500 mt-0.5">
                          {r.customerName} · {r.firstProductName}
                        </div>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold border ${statusMeta.className}`}
                      >
                        {statusMeta.label}
                      </span>
                    </div>

                    <div className="text-[11px] text-stone-600 font-medium">
                      Reason:{" "}
                      <span className="text-stone-800 font-semibold">
                        {r.reason}
                      </span>
                    </div>

                    <div className="border-t border-stone-100 pt-2.5 flex items-center justify-between">
                      <div className="text-xs font-bold text-stone-950">
                        Refund: {fmt(r.refundAmount)}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-stone-400">
                          {relativeDate(r.createdAt)}
                        </span>
                        <Link
                          href="/seller/returns"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

      {/* All clear empty state */}
      {totalTasks === 0 && (
        <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/50 p-12 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-stone-400" />
          <h3 className="mt-4 text-sm font-bold text-stone-800">
            All clear! No tasks pending.
          </h3>
          <p className="mt-1 text-xs text-stone-500">
            All orders are shipped, inventory is stocked, and there are no open
            return requests.
          </p>
        </div>
      )}
    </div>
  );
}
