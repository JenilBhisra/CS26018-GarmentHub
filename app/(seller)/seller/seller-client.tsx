"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TrendingUp, ShoppingBag, Package, Eye, Percent, AlertCircle, Clock, XCircle,
  ArrowUpRight, ArrowDownLeft, Search, Settings, EyeOff,
  ChevronRight, Loader2, AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

import { executeGlobalSearch, SearchResult } from "@/actions/search";
import { updateUserPreferences } from "@/actions/preferences";
import { bulkUpdateInventorySeller } from "@/actions/bulk";
import { LazyDashboardCharts } from "@/components/admin/lazy-dashboard-charts";
import { SmartImage } from "@/components/site/smart-image";

interface SellerClientProps {
  profile: any;
  kycStatus: string;
  rejectionReason: string | null;
  wallet: any;
  stats: {
    todayOrdersCount: number;
    pendingOrdersCount: number;
    deliveredOrdersCount: number;
    returnRequestsCount: number;
    totalRevenue: number;
    refundPercentage: number;
  };
  lowStockVariants: any[];
  outOfStockVariants: any[];
  inactiveProducts: any[];
  highReturnProducts: any[];
  recentOrders: any[];
  ordersToShip: any[];
  initialPreferences: any;
  revenueTrend: any[];
  topProducts: any[];
  netUnitsSoldTrend: { label: string; units: number }[];
}

export default function SellerClient({
  profile,
  kycStatus,
  rejectionReason,
  wallet,
  stats,
  lowStockVariants,
  outOfStockVariants,
  inactiveProducts,
  highReturnProducts,
  recentOrders,
  ordersToShip,
  initialPreferences,
  revenueTrend,
  topProducts,
  netUnitsSoldTrend,
}: SellerClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Preference Customization
  const [preferences, setPreferences] = useState(initialPreferences);
  const [isCustomizing, setIsCustomizing] = useState(false);

  // Bulk Operations
  const [bulkInventoryStock, setBulkInventoryStock] = useState<string>("");
  const [isSubmittingBulkStock, setIsSubmittingBulkStock] = useState(false);

  // Debounce search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const delay = setTimeout(async () => {
      setIsSearching(true);
      const res = await executeGlobalSearch(searchQuery);
      setSearchResults(res);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(delay);
  }, [searchQuery]);

  // Format currency helper
  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Toggle card visibility
  const toggleCardVisibility = async (cardKey: string) => {
    const hidden = preferences.hiddenCards || [];
    let updatedHidden = [];
    if (hidden.includes(cardKey)) {
      updatedHidden = hidden.filter((k: string) => k !== cardKey);
    } else {
      updatedHidden = [...hidden, cardKey];
    }
    const newPrefs = { ...preferences, hiddenCards: updatedHidden };
    setPreferences(newPrefs);
    await updateUserPreferences(newPrefs);
    toast.success("Seller layout preference updated.");
  };

  // Reorder dashboard cards (up/down in customize panel)
  const moveCard = async (idx: number, direction: "up" | "down") => {
    const ordered = orderedCards.map((c) => c.key);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= ordered.length) return;
    [ordered[idx], ordered[swapIdx]] = [ordered[swapIdx], ordered[idx]];
    const newPrefs = { ...preferences, cardOrder: ordered };
    setPreferences(newPrefs);
    await updateUserPreferences(newPrefs);
  };

  // Bulk Inventory Stock Submit
  const handleBulkStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const stockVal = parseInt(bulkInventoryStock);
    if (isNaN(stockVal) || stockVal < 0) {
      toast.error("Please enter a valid stock quantity.");
      return;
    }

    const lowStockIds = lowStockVariants.map(v => v.id);
    if (lowStockIds.length === 0) {
      toast.info("No low stock variants to update.");
      return;
    }

    setIsSubmittingBulkStock(true);
    try {
      const updates = lowStockIds.map(id => ({ variantId: id, stock: stockVal }));
      const res = await bulkUpdateInventorySeller(updates);
      if (res.success) {
        toast.success(`Successfully updated stock for ${res.succeeded.length} variants.`);
        setBulkInventoryStock("");
        router.refresh();
      } else {
        toast.error("Bulk inventory update failed.");
      }
    } catch (err: any) {
      toast.error(err.message || "Bulk action failed.");
    } finally {
      setIsSubmittingBulkStock(false);
    }
  };

  const allCards = [
    { key: "withdrawable", label: "Available to Withdraw", val: formatCurrency(wallet.withdrawableBalance), desc: "Available balance", icon: ArrowUpRight, href: "/seller/wallet" },
    { key: "pending_bal", label: "Waiting for Return Period", val: formatCurrency(wallet.pendingBalance), desc: "Pending maturity balance", icon: Clock, href: "/seller/wallet" },
    { key: "negative_bal", label: "Amount Owed", val: wallet.negativeBalance > 0 ? `-₹${Number(wallet.negativeBalance).toFixed(2)}` : "₹0.00", desc: "Negative wallet balance", icon: ArrowDownLeft, href: "/seller/wallet" },
    { key: "revenue", label: "Gross Revenue", val: formatCurrency(stats.totalRevenue), desc: "Gross product sales value", icon: TrendingUp, href: "/seller/orders" },
    { key: "orders_today", label: "Today's Orders", val: stats.todayOrdersCount, desc: "Placed today", icon: ShoppingBag, href: "/seller/orders" },
    { key: "orders_pending", label: "Pending Orders", val: stats.pendingOrdersCount, desc: "Awaiting fulfillment", icon: Package, href: "/seller/orders?status=PENDING" },
    { key: "orders_delivered", label: "Delivered Orders", val: stats.deliveredOrdersCount, desc: "Shipped & Completed", icon: Package, href: "/seller/orders?status=DELIVERED" },
    { key: "returns", label: "Return Requests", val: stats.returnRequestsCount, desc: "Awaiting review", icon: AlertCircle, href: "/seller/returns" },
    { key: "refund_rate", label: "Refund Rate", val: `${stats.refundPercentage.toFixed(1)}%`, desc: "Seller return rate", icon: Percent, href: "/seller/returns" },
  ];

  const activeOrder = preferences.cardOrder || allCards.map(c => c.key);
  const orderedCards = activeOrder
    .map((k: string) => allCards.find(c => c.key === k))
    .filter(Boolean) as typeof allCards;

  allCards.forEach(c => {
    if (!activeOrder.includes(c.key)) {
      orderedCards.push(c);
    }
  });

  const visibleCards = orderedCards.filter(c => !(preferences.hiddenCards || []).includes(c.key));

  return (
    <div className="space-y-8">
      {/* KYC Status alert banners */}
      {kycStatus !== "APPROVED" && (
        <div className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
          kycStatus === "NOT_SUBMITTED"
            ? "border-amber-200 bg-amber-50/50 text-amber-800"
            : kycStatus === "PENDING"
            ? "border-sky-200 bg-sky-50/50 text-sky-800"
            : "border-red-200 bg-red-50/50 text-red-800"
        }`}>
          <div className="flex gap-3">
            {kycStatus === "NOT_SUBMITTED" ? (
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            ) : kycStatus === "PENDING" ? (
              <Clock className="h-5 w-5 shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
            )}
            <div>
              <h3 className="font-semibold text-sm">
                {kycStatus === "NOT_SUBMITTED" && "Verification Status: Action Required"}
                {kycStatus === "PENDING" && "Verification Status: Pending Review"}
                {kycStatus === "REJECTED" && "Verification Status: Rejected"}
              </h3>
              <p className="text-xs mt-1">
                {kycStatus === "NOT_SUBMITTED" && "Please submit your Business KYC documents to enable product creation and payout requests."}
                {kycStatus === "PENDING" && "Your business details are under review. Verification typically takes 24-48 business hours."}
                {kycStatus === "REJECTED" && `Your submission was rejected. Reason: ${rejectionReason || "Please verify your document details."}`}
              </p>
            </div>
          </div>
          <div>
            <Link
              href="/seller/kyc"
              className={`inline-flex items-center text-xs font-semibold px-4 py-2 rounded-lg border transition-colors shrink-0 ${
                kycStatus === "NOT_SUBMITTED"
                  ? "bg-amber-800 text-white border-amber-800 hover:bg-amber-900"
                  : kycStatus === "PENDING"
                  ? "bg-sky-800 text-white border-sky-800 hover:bg-sky-900"
                  : "bg-red-800 text-white border-red-800 hover:bg-red-900"
              }`}
            >
              {kycStatus === "NOT_SUBMITTED" && "Start Verification"}
              {kycStatus === "PENDING" && "View Details"}
              {kycStatus === "REJECTED" && "Resubmit Documents"}
            </Link>
          </div>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-stone-900 font-bold">Store Console: {profile.storeName}</h1>
          <p className="text-sm text-stone-500 mt-1">Fulfill orders, configure product stock levels, and review wallet statements.</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Global Search */}
          <div className="relative flex-1 md:w-80 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search your orders, products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-stone-400 focus:border-stone-400"
            />
            {searchQuery.trim().length >= 2 && (
              <div className="absolute right-0 top-11 z-50 w-full rounded-lg border border-stone-200 bg-white p-2 shadow-lg max-h-[300px] overflow-y-auto space-y-1">
                {isSearching ? (
                  <div className="flex items-center justify-center p-6 text-stone-400 text-xs gap-1.5">
                    <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-stone-400">No results found for &quot;{searchQuery}&quot;.</div>
                ) : (
                  searchResults.map((r) => (
                    <Link
                      key={r.id + r.type}
                      href={r.route}
                      onClick={() => setSearchQuery("")}
                      className="flex justify-between items-center px-3 py-2 rounded-lg hover:bg-stone-50 text-xs transition-colors"
                    >
                      <div className="text-left">
                        <div className="font-bold text-stone-900">{r.label}</div>
                        <div className="text-[10px] text-stone-400 mt-0.5">{r.sublabel}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[8px] font-extrabold bg-stone-100 text-stone-600 border border-stone-200">
                        {r.type}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setIsCustomizing(!isCustomizing)}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-stone-200 rounded-lg text-sm bg-white hover:bg-stone-50 text-stone-700 font-semibold cursor-pointer shrink-0"
          >
            <Settings className="h-4 w-4" /> Layout
          </button>
        </div>
      </div>

      {/* Customize items preferences layout */}
      {isCustomizing && (
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-stone-200 pb-2">
            <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">Customize Dashboard Metrics</h3>
            <button onClick={() => setIsCustomizing(false)} className="text-stone-400 hover:text-stone-700 text-xs font-semibold cursor-pointer">Done</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {orderedCards.map((c, idx) => {
              const isHidden = (preferences.hiddenCards || []).includes(c.key);
              return (
                <div key={c.key} className="bg-white border border-stone-200 p-2.5 rounded-lg flex flex-col justify-between gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-800 truncate">{c.label}</span>
                    <button onClick={() => toggleCardVisibility(c.key)} className="text-stone-500 cursor-pointer">
                      {isHidden ? <EyeOff className="h-3.5 w-3.5 text-stone-400" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <div className="flex gap-1.5 justify-end">
                    <button
                      onClick={() => moveCard(idx, "up")}
                      disabled={idx === 0}
                      className="text-[10px] font-bold text-stone-500 hover:text-stone-800 disabled:opacity-30 cursor-pointer"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => moveCard(idx, "down")}
                      disabled={idx === orderedCards.length - 1}
                      className="text-[10px] font-bold text-stone-500 hover:text-stone-800 disabled:opacity-30 cursor-pointer"
                    >
                      →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Clickable summary cards grid */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {visibleCards.map((w) => (
          <Link
            key={w.key}
            href={w.href}
            className="bg-white rounded-xl border border-stone-200 p-4 hover:border-stone-400 hover:shadow-xs transition-all block"
          >
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-stone-400">
              <span>{w.label}</span>
              <w.icon className="h-4 w-4 shrink-0 text-stone-300" />
            </div>
            <div className="mt-2 font-display text-2xl font-bold text-stone-900">{w.val}</div>
            <div className="mt-1 text-[10px] text-stone-400 font-semibold flex items-center justify-between">
              <span>{w.desc}</span>
              <ChevronRight className="h-3.5 w-3.5 text-stone-300 shrink-0" />
            </div>
          </Link>
        ))}
      </div>

      {/* Net Sold Units trend */}
      <section className="bg-white rounded-xl border border-stone-200 shadow-xs p-4">
        <h2 className="font-bold text-stone-800 text-sm uppercase tracking-wider mb-3">Net Sold Units (Last 7 Days)</h2>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={netUnitsSoldTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="units" name="Units Sold" stroke="#1c1917" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Lazy Sales Chart Trend widget */}
      <div className="border-y border-stone-150 py-2">
        <LazyDashboardCharts
          revenueTrend={revenueTrend}
          refundReasons={[]}
          categorySales={topProducts}
        />
      </div>

      {/* Operational tables and widgets */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Orders To Ship Widget — links out to the full Orders workflow page */}
        <section className="bg-white rounded-xl border border-stone-200 shadow-xs flex flex-col lg:col-span-2">
          <div className="border-b border-stone-100 p-4 flex items-center justify-between">
            <h2 className="font-bold text-stone-800 text-sm uppercase tracking-wider">Orders Awaiting Shipment</h2>
            <Link
              href="/seller/orders?tab=new"
              className="rounded bg-stone-900 text-white px-3 py-1.5 text-xs font-bold hover:bg-stone-800 cursor-pointer"
            >
              Manage in Orders →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[10px] font-bold uppercase tracking-wider text-stone-400 bg-stone-50 border-b border-stone-150">
                <tr>
                  <th className="px-4 py-3">Order Number</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-right">Value</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-semibold text-stone-700">
                {ordersToShip.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-stone-400 font-semibold">
                      No orders awaiting package/shipment today.
                    </td>
                  </tr>
                ) : (
                  ordersToShip.map((o) => (
                    <tr key={o.id} className="hover:bg-stone-50/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-stone-900">{o.orderNumber}</td>
                      <td className="px-4 py-3">{o.user?.name || "Customer"}</td>
                      <td className="px-4 py-3 text-right">₹{Number(o.totalAmount).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-center">
                        <Link href={`/seller/orders?search=${o.orderNumber}`} className="text-stone-900 hover:underline">
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Low Stock Alerts & Inventory bulk actions */}
        <section className="bg-white rounded-xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="border-b border-stone-150 p-4 flex justify-between items-center">
              <h3 className="font-bold text-stone-800 text-sm uppercase tracking-wider">Product Inventory Alerts</h3>
              {lowStockVariants.length > 0 && (
                <form onSubmit={handleBulkStockSubmit} className="flex items-center gap-1.5">
                  <input
                    type="number"
                    placeholder="Set stock"
                    value={bulkInventoryStock}
                    onChange={(e) => setBulkInventoryStock(e.target.value)}
                    className="w-16 rounded border border-stone-200 px-2 py-1 text-xs outline-none bg-white text-stone-850"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingBulkStock}
                    className="rounded bg-stone-900 text-white px-2 py-1 text-xs font-bold hover:bg-stone-800 disabled:opacity-50 cursor-pointer flex items-center gap-0.5"
                  >
                    {isSubmittingBulkStock ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : null}
                    Save
                  </button>
                </form>
              )}
            </div>
            <ul className="divide-y divide-stone-100 text-xs font-semibold">
              {lowStockVariants.length === 0 && outOfStockVariants.length === 0 ? (
                <li className="p-10 text-center text-stone-400 font-semibold">All inventory levels are healthy!</li>
              ) : (
                <>
                  {outOfStockVariants.map((v) => (
                    <li key={v.id} className="flex items-center gap-3 p-3.5 hover:bg-stone-50/40">
                      <SmartImage src={v.images?.[0] || v.product.images?.[0] || ""} className="h-10 w-8 rounded object-cover border border-stone-200 shrink-0" alt="" />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-stone-900 truncate">{v.product.name}</div>
                        <div className="text-[9px] text-stone-400 mt-0.5 font-semibold">
                          Size: {v.size || "Free"} | Color: {v.color || "Default"}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="rounded-full bg-rose-50 text-rose-700 px-2.5 py-1 font-bold text-[9px] uppercase tracking-wider flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" /> Out of stock
                        </span>
                      </div>
                    </li>
                  ))}

                  {lowStockVariants.map((v) => (
                    <li key={v.id} className="flex items-center gap-3 p-3.5 hover:bg-stone-50/40">
                      <SmartImage src={v.images?.[0] || v.product.images?.[0] || ""} className="h-10 w-8 rounded object-cover border border-stone-200 shrink-0" alt="" />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-stone-900 truncate">{v.product.name}</div>
                        <div className="text-[9px] text-stone-400 mt-0.5 font-semibold">
                          Size: {v.size || "Free"} | Color: {v.color || "Default"}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="rounded-full bg-amber-50 text-amber-700 px-2.5 py-1 font-bold text-[9px] uppercase tracking-wider">
                          {v.stock} left
                        </span>
                      </div>
                    </li>
                  ))}
                </>
              )}
            </ul>
          </div>
          <div className="border-t border-stone-100 p-3 text-center text-[10px] text-stone-400 font-semibold">
            Stock alert trigger limits set at &le; 5 units.
          </div>
        </section>
      </div>
    </div>
  );
}
