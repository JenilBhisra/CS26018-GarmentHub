"use client";

import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  TrendingUp, Users2, UserCheck, ShoppingBag, Percent, AlertTriangle, 
  HelpCircle, Search, Settings, CheckSquare, Square, Eye, EyeOff, ChevronRight, 
  FileSpreadsheet, ArrowRight, Loader2, Play, CheckCircle2, XCircle
} from "lucide-react";
import { toast } from "sonner";

import { executeGlobalSearch, SearchResult } from "@/actions/search";
import { updateUserPreferences } from "@/actions/preferences";
import { bulkApproveKycAdmin, bulkApprovePayoutsAdmin } from "@/actions/bulk";
import { LazyDashboardCharts } from "@/components/admin/lazy-dashboard-charts";
import { SmartImage } from "@/components/site/smart-image";

interface AdminClientProps {
  stats: {
    todayOrdersCount: number;
    pendingOrdersCount: number;
    awaitingShipmentCount: number;
    activeSellersCount: number;
    pendingKycCount: number;
    pendingPayoutsCount: number;
    openDisputesCount: number;
    pendingRefundsCount: number;
    negativeWalletsCount: number;
    totalRevenue: number;
    platformCommission: number;
    refundRate: number;
  };
  recentAuditLogs: any[];
  topSellingProducts: any[];
  pendingKycList: any[];
  pendingPayoutList: any[];
  initialPreferences: any;
  revenueTrend: any[];
  refundReasons: any[];
  categorySales: any[];
}

export default function AdminClient({
  stats,
  recentAuditLogs,
  topSellingProducts,
  pendingKycList,
  pendingPayoutList,
  initialPreferences,
  revenueTrend,
  refundReasons,
  categorySales,
}: AdminClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Preference Customization States
  const [preferences, setPreferences] = useState(initialPreferences);
  const [isCustomizing, setIsCustomizing] = useState(false);

  // Modals States
  const [isKycModalOpen, setIsKycModalOpen] = useState(false);
  const [selectedKycIds, setSelectedKycIds] = useState<string[]>([]);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [selectedPayoutIds, setSelectedPayoutIds] = useState<string[]>([]);
  const [payoutStatus, setPayoutStatus] = useState<"PROCESSING" | "PAID">("PROCESSING");
  const [payoutUtr, setPayoutUtr] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

  // Debounce search input
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

  // Toggle card visibility preference
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
    toast.success("Dashboard layout updated.");
  };

  // Reorder card preference (Shift item in list)
  const moveCard = async (index: number, direction: "up" | "down") => {
    const list = [...(preferences.cardOrder || [])];
    if (direction === "up" && index > 0) {
      const temp = list[index];
      list[index] = list[index - 1];
      list[index - 1] = temp;
    } else if (direction === "down" && index < list.length - 1) {
      const temp = list[index];
      list[index] = list[index + 1];
      list[index + 1] = temp;
    }
    const newPrefs = { ...preferences, cardOrder: list };
    setPreferences(newPrefs);
    await updateUserPreferences(newPrefs);
  };

  // Bulk KYC Approval Submit
  const handleKycBulkSubmit = async () => {
    if (selectedKycIds.length === 0) return;
    setIsSubmittingBulk(true);
    try {
      const res = await bulkApproveKycAdmin(selectedKycIds);
      if (res.success) {
        toast.success(`Successfully approved ${res.succeeded.length} KYC requests.`);
        setIsKycModalOpen(false);
        setSelectedKycIds([]);
        router.refresh();
      } else {
        toast.error(`Approved: ${res.succeeded.length}, Failed: ${res.failed.length}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Bulk action failed.");
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  // Bulk Payout Approval Submit
  const handlePayoutBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPayoutIds.length === 0) return;

    if (payoutStatus === "PAID" && payoutUtr.trim().length === 0) {
      toast.error("Bank Reference / UTR is mandatory when marking as PAID.");
      return;
    }

    setIsSubmittingBulk(true);
    try {
      const res = await bulkApprovePayoutsAdmin(selectedPayoutIds, payoutStatus, payoutUtr, payoutNotes);
      if (res.success) {
        toast.success(`Successfully updated ${res.succeeded.length} payout requests.`);
        setIsPayoutModalOpen(false);
        setSelectedPayoutIds([]);
        setPayoutUtr("");
        setPayoutNotes("");
        router.refresh();
      } else {
        const errorDetails = res.failed.map(f => f.error).join(", ");
        toast.error(`Payouts bulk update partially failed: ${errorDetails}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Bulk action failed.");
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  // Dynamic statistics widget definitions
  const allCards = [
    { key: "orders_today", label: "Today's Orders", val: stats.todayOrdersCount, desc: "New bookings today", icon: ShoppingBag, href: "/admin/orders" },
    { key: "orders_pending", label: "Pending Orders", val: stats.pendingOrdersCount, desc: "Awaiting packaging", icon: ShoppingBag, href: "/admin/orders?status=PENDING" },
    { key: "orders_awaiting", label: "Awaiting Shipment", val: stats.awaitingShipmentCount, desc: "Ready to ship", icon: ShoppingBag, href: "/admin/orders?status=PROCESSING" },
    { key: "active_sellers", label: "Active Sellers", val: stats.activeSellersCount, desc: "Approved storefronts", icon: Users2, href: "/admin/sellers" },
    { key: "kyc_pending", label: "Pending KYC Review", val: stats.pendingKycCount, desc: "Verification required", icon: UserCheck, href: "/admin/sellers" },
    { key: "payouts_pending", label: "Pending Payouts", val: stats.pendingPayoutsCount, desc: "Requested withdrawals", icon: AlertTriangle, href: "/admin/settlements?tab=payouts" },
    { key: "disputes_open", label: "Open Disputes", val: stats.openDisputesCount, desc: "Unassigned support tickets", icon: HelpCircle, href: "/admin/disputes" },
    { key: "refunds_pending", label: "Pending Refunds", val: stats.pendingRefundsCount, desc: "Awaiting mediation", icon: AlertTriangle, href: "/admin/settlements?tab=returns" },
    { key: "negative_wallets", label: "Negative Wallets", val: stats.negativeWalletsCount, desc: "Amount owed by sellers", icon: AlertTriangle, href: "/admin/settlements?tab=wallets" },
    { key: "total_revenue", label: "Total Collected", val: formatCurrency(stats.totalRevenue), desc: "Total transactions value", icon: TrendingUp, href: "/admin/orders" },
    { key: "commission", label: "Platform Revenue", val: formatCurrency(stats.platformCommission), desc: "Platform cut earned", icon: Percent, href: "/admin/settlements" },
    { key: "refund_rate", label: "Refund Rate", val: `${stats.refundRate.toFixed(1)}%`, desc: "Return rate threshold < 15%", icon: Percent, href: "/admin/settlements?tab=returns" },
  ];

  // Reorder card layout mapping based on preference keys
  const activeOrder = preferences.cardOrder || allCards.map(c => c.key);
  const orderedCards = activeOrder
    .map((k: string) => allCards.find(c => c.key === k))
    .filter(Boolean) as typeof allCards;

  // Add back missing cards that weren't in the saved order array
  allCards.forEach(c => {
    if (!activeOrder.includes(c.key)) {
      orderedCards.push(c);
    }
  });

  const visibleCards = orderedCards.filter(c => !(preferences.hiddenCards || []).includes(c.key));

  return (
    <div className="space-y-8">
      {/* Search and Layout customization Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-stone-900 font-bold">Marketplace Console</h1>
          <p className="text-sm text-stone-500 mt-1">Transform data visibility, process bulk approvals, and mediate settlements.</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Universal Global Search Bar */}
          <div className="relative flex-1 md:w-80 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4.5 w-4.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search orders, sellers, payouts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-lg text-sm bg-white outline-none focus:ring-1 focus:ring-stone-400 focus:border-stone-400"
            />
            {/* Search results dropdown */}
            {searchQuery.trim().length >= 2 && (
              <div className="absolute right-0 top-11 z-50 w-full rounded-lg border border-stone-200 bg-white p-2 shadow-lg max-h-[300px] overflow-y-auto space-y-1">
                {isSearching ? (
                  <div className="flex items-center justify-center p-6 text-stone-400 text-xs gap-1.5">
                    <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-stone-400">No results found for "{searchQuery}".</div>
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

          {/* Preferences button */}
          <button
            onClick={() => setIsCustomizing(!isCustomizing)}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-stone-200 rounded-lg text-sm bg-white hover:bg-stone-50 text-stone-700 font-semibold cursor-pointer shrink-0"
          >
            <Settings className="h-4 w-4" /> Layout
          </button>
        </div>
      </div>

      {/* Dashboard customizer controls */}
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

      {/* Clicking summary cards opens filtered list */}
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

      {/* Lazily loaded SVG Charts */}
      <div className="border-y border-stone-150 py-2">
        <LazyDashboardCharts
          revenueTrend={revenueTrend}
          refundReasons={refundReasons}
          categorySales={categorySales}
        />
      </div>

      {/* Operational Queues & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Needs Immediate Attention Column */}
        <section className="bg-white rounded-xl border border-stone-200 shadow-xs flex flex-col lg:col-span-2">
          <div className="border-b border-stone-100 p-4 font-bold text-stone-800 text-sm uppercase tracking-wider">
            Needs Immediate Attention
          </div>
          <div className="divide-y divide-stone-100 text-xs max-h-[360px] overflow-y-auto">
            {stats.pendingKycCount === 0 && stats.pendingPayoutsCount === 0 && stats.openDisputesCount === 0 && stats.pendingRefundsCount === 0 ? (
              <div className="p-12 text-center text-stone-400 font-semibold flex flex-col items-center justify-center gap-1.5">
                <CheckCircle2 className="h-8 w-8 text-emerald-300 animate-pulse" />
                <span>Everything is clear! No pending mediation items today.</span>
              </div>
            ) : (
              <>
                {stats.pendingKycCount > 0 && (
                  <div className="p-4 flex items-center justify-between hover:bg-stone-50/40">
                    <div className="space-y-1">
                      <div className="font-bold text-stone-900 text-xs flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-amber-500" /> Pending KYC Registrations
                      </div>
                      <div className="text-stone-400 text-[10px] font-semibold">
                        {stats.pendingKycCount} storefront profiles awaiting review and authorization.
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedKycIds(pendingKycList.map(k => k.id));
                        setIsKycModalOpen(true);
                      }}
                      className="rounded bg-stone-900 text-white px-3 py-1.5 font-bold hover:bg-stone-800 cursor-pointer text-[10px] uppercase tracking-wider flex items-center gap-1"
                    >
                      Resolve <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {stats.pendingPayoutsCount > 0 && (
                  <div className="p-4 flex items-center justify-between hover:bg-stone-50/40">
                    <div className="space-y-1">
                      <div className="font-bold text-stone-900 text-xs flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-amber-500" /> Pending payout requests
                      </div>
                      <div className="text-stone-400 text-[10px] font-semibold">
                        {stats.pendingPayoutsCount} disbursements requested by merchants requiring approval.
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedPayoutIds(pendingPayoutList.map(p => p.id));
                        setIsPayoutModalOpen(true);
                      }}
                      className="rounded bg-stone-900 text-white px-3 py-1.5 font-bold hover:bg-stone-800 cursor-pointer text-[10px] uppercase tracking-wider flex items-center gap-1"
                    >
                      Disburse <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {stats.pendingRefundsCount > 0 && (
                  <div className="p-4 flex items-center justify-between hover:bg-stone-50/40">
                    <div className="space-y-1">
                      <div className="font-bold text-stone-900 text-xs flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" /> Pending refund mediation requests
                      </div>
                      <div className="text-stone-400 text-[10px] font-semibold">
                        {stats.pendingRefundsCount} returns awaiting category finalization and cost assignment.
                      </div>
                    </div>
                    <Link
                      href="/admin/settlements?tab=returns"
                      className="rounded bg-stone-900 text-white px-3 py-1.5 font-bold hover:bg-stone-800 cursor-pointer text-[10px] uppercase tracking-wider flex items-center gap-1"
                    >
                      Mediate <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}

                {stats.openDisputesCount > 0 && (
                  <div className="p-4 flex items-center justify-between hover:bg-stone-50/40">
                    <div className="space-y-1">
                      <div className="font-bold text-stone-900 text-xs flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-rose-500" /> Open disputes
                      </div>
                      <div className="text-stone-400 text-[10px] font-semibold">
                        {stats.openDisputesCount} active disputes between sellers and customers needing arbitration.
                      </div>
                    </div>
                    <Link
                      href="/admin/disputes"
                      className="rounded bg-stone-900 text-white px-3 py-1.5 font-bold hover:bg-stone-800 cursor-pointer text-[10px] uppercase tracking-wider flex items-center gap-1"
                    >
                      Arbitrate <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Quick Operations Actions Side Block */}
        <section className="bg-white rounded-xl border border-stone-200 shadow-xs flex flex-col">
          <div className="border-b border-stone-100 p-4 font-bold text-stone-800 text-sm uppercase tracking-wider">
            Quick Operations
          </div>
          <div className="p-4 flex-1 flex flex-col justify-between gap-6">
            <div className="grid grid-cols-1 gap-2.5">
              <button
                onClick={() => {
                  setSelectedKycIds(pendingKycList.map(k => k.id));
                  setIsKycModalOpen(true);
                }}
                className="w-full text-left px-3.5 py-3 border border-stone-200 rounded-lg text-xs font-bold text-stone-700 bg-white hover:bg-stone-50 flex items-center justify-between cursor-pointer"
              >
                <span>Bulk Approve KYC</span>
                <ChevronRight className="h-3.5 w-3.5 text-stone-400" />
              </button>

              <button
                onClick={() => {
                  setSelectedPayoutIds(pendingPayoutList.map(p => p.id));
                  setIsPayoutModalOpen(true);
                }}
                className="w-full text-left px-3.5 py-3 border border-stone-200 rounded-lg text-xs font-bold text-stone-700 bg-white hover:bg-stone-50 flex items-center justify-between cursor-pointer"
              >
                <span>Process Payouts (Bulk)</span>
                <ChevronRight className="h-3.5 w-3.5 text-stone-400" />
              </button>

              <Link
                href="/admin/settlements?tab=returns"
                className="w-full text-left px-3.5 py-3 border border-stone-200 rounded-lg text-xs font-bold text-stone-700 bg-white hover:bg-stone-50 flex items-center justify-between"
              >
                <span>Review Pending Refunds</span>
                <ChevronRight className="h-3.5 w-3.5 text-stone-400" />
              </Link>

              <Link
                href="/admin/wallets"
                className="w-full text-left px-3.5 py-3 border border-stone-200 rounded-lg text-xs font-bold text-stone-700 bg-white hover:bg-stone-50 flex items-center justify-between"
              >
                <span>Add Manual Adjustment</span>
                <ChevronRight className="h-3.5 w-3.5 text-stone-400" />
              </Link>
            </div>
            <div className="text-[10px] text-stone-400 font-semibold text-center mt-2.5">
              Confirmations are required for all ledger adjustments and bulk status transitions.
            </div>
          </div>
        </section>
      </div>

      {/* KYC Bulk Approval Modal */}
      {isKycModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-stone-200 bg-white p-6 shadow-lg space-y-4">
            <div>
              <h3 className="font-display text-lg font-bold text-stone-900">Bulk Approve KYC</h3>
              <p className="text-xs text-stone-400">Select pending registrations to authorize for active merchant selling.</p>
            </div>

            <div className="max-h-[220px] overflow-y-auto border border-stone-200 rounded-lg divide-y divide-stone-100">
              {pendingKycList.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-400 font-semibold">No pending KYC records.</div>
              ) : (
                pendingKycList.map((k) => {
                  const isChecked = selectedKycIds.includes(k.id);
                  return (
                    <div key={k.id} className="p-3 flex items-center justify-between hover:bg-stone-50 text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (isChecked) setSelectedKycIds(selectedKycIds.filter(id => id !== k.id));
                            else setSelectedKycIds([...selectedKycIds, k.id]);
                          }}
                          className="text-stone-500 cursor-pointer"
                        >
                          {isChecked ? <CheckSquare className="h-4.5 w-4.5" /> : <Square className="h-4.5 w-4.5" />}
                        </button>
                        <span>{k.storeName}</span>
                      </div>
                      <span className="text-[10px] text-stone-400 font-mono">PAN: {k.panNumber}</span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsKycModalOpen(false);
                  setSelectedKycIds([]);
                }}
                disabled={isSubmittingBulk}
                className="rounded px-4 py-2 text-xs font-bold border border-stone-250 hover:bg-stone-50 cursor-pointer text-stone-600"
              >
                Cancel
              </button>
              <button
                onClick={handleKycBulkSubmit}
                disabled={isSubmittingBulk || selectedKycIds.length === 0}
                className="rounded bg-stone-900 text-white px-4 py-2 text-xs font-bold hover:bg-stone-800 disabled:opacity-50 cursor-pointer flex items-center gap-1"
              >
                {isSubmittingBulk ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Approve Selected ({selectedKycIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payouts Bulk Approval Modal */}
      {isPayoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-stone-200 bg-white p-6 shadow-lg space-y-4">
            <div>
              <h3 className="font-display text-lg font-bold text-stone-900">Bulk Approve Payouts</h3>
              <p className="text-xs text-stone-400">Select pendingPayouts and configure status. Bank UTR code is strictly required for PAID status.</p>
            </div>

            <form onSubmit={handlePayoutBulkSubmit} className="space-y-4">
              <div className="max-h-[160px] overflow-y-auto border border-stone-200 rounded-lg divide-y divide-stone-100">
                {pendingPayoutList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-stone-400 font-semibold">No pending payout records.</div>
                ) : (
                  pendingPayoutList.map((p) => {
                    const isChecked = selectedPayoutIds.includes(p.id);
                    return (
                      <div key={p.id} className="p-3 flex items-center justify-between hover:bg-stone-50 text-xs font-semibold">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (isChecked) setSelectedPayoutIds(selectedPayoutIds.filter(id => id !== p.id));
                              else setSelectedPayoutIds([...selectedPayoutIds, p.id]);
                            }}
                            className="text-stone-500 cursor-pointer"
                          >
                            {isChecked ? <CheckSquare className="h-4.5 w-4.5" /> : <Square className="h-4.5 w-4.5" />}
                          </button>
                          <span>{p.storeName}</span>
                        </div>
                        <span className="text-xs font-bold text-stone-900">₹{Number(p.amount).toLocaleString("en-IN")}</span>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Disbursement Status</label>
                  <select
                    value={payoutStatus}
                    onChange={(e) => setPayoutStatus(e.target.value as any)}
                    className="w-full rounded border border-stone-200 p-2 text-xs font-semibold outline-none bg-white text-stone-800"
                  >
                    <option value="PROCESSING">Mark Processing</option>
                    <option value="PAID">Disburse (PAID)</option>
                  </select>
                </div>

                {payoutStatus === "PAID" && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">UTR / Bank Ref Number</label>
                    <input
                      type="text"
                      placeholder="e.g. UTR129384"
                      value={payoutUtr}
                      onChange={(e) => setPayoutUtr(e.target.value)}
                      className="w-full rounded border border-stone-200 p-2 text-xs outline-none bg-white text-stone-800"
                      required
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Internal Notes (Optional)</label>
                <textarea
                  placeholder="Memo notes for payouts history..."
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  className="w-full min-h-[50px] rounded border border-stone-200 p-2 text-xs outline-none text-stone-800 bg-white"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPayoutModalOpen(false);
                    setSelectedPayoutIds([]);
                    setPayoutUtr("");
                    setPayoutNotes("");
                  }}
                  disabled={isSubmittingBulk}
                  className="rounded px-4 py-2 text-xs font-bold border border-stone-250 hover:bg-stone-50 cursor-pointer text-stone-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBulk || selectedPayoutIds.length === 0}
                  className="rounded bg-stone-900 text-white px-4 py-2 text-xs font-bold hover:bg-stone-800 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                >
                  {isSubmittingBulk ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Submit Bulk ({selectedPayoutIds.length})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
