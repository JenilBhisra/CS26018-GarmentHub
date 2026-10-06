"use client";

import React, { useState, useTransition } from "react";
import { adjustWalletAdmin } from "@/actions/wallets";
import { toast } from "sonner";
import { Search, Plus, Loader2, AlertCircle } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

interface WalletData {
  id: string;
  storeName: string;
  sellerId: string;
  withdrawableBalance: number;
  pendingBalance: number;
  negativeBalance: number;
  reserveBalance: number;
  totalEarned: number;
  totalPaid: number;
  totalRefunded: number;
}

interface WalletsClientProps {
  initialSellers: WalletData[];
  totalPages: number;
  currentPage: number;
}

export default function WalletsClient({ initialSellers, totalPages, currentPage }: WalletsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [isPending, startTransition] = useTransition();

  // Adjustment Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSellerId, setSelectedSellerId] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustType, setAdjustType] = useState<"MANUAL_CREDIT" | "MANUAL_DEBIT">("MANUAL_CREDIT");
  const [adjustReason, setAdjustReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search logic
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (search.trim()) {
      params.set("search", search.trim());
    } else {
      params.delete("search");
    }
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", page.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  // Submit Adjustment
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSellerId) {
      toast.error("Please select a vendor store.");
      return;
    }
    const amt = parseFloat(adjustAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid positive amount.");
      return;
    }
    if (!adjustReason.trim()) {
      toast.error("Reason is mandatory for financial adjustments.");
      return;
    }

    // Confirmation dialog before proceeding
    const confirmed = window.confirm(
      `Are you sure you want to perform a manual ${
        adjustType === "MANUAL_CREDIT" ? "Credit" : "Debit"
      } of ₹${amt.toLocaleString("en-IN")}? This operation will create an immutable transaction log.`
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const res = await adjustWalletAdmin(selectedSellerId, amt, adjustType, adjustReason);
      if (res.success) {
        toast.success("Wallet adjustment successfully applied!");
        setIsModalOpen(false);
        // Reset form
        setSelectedSellerId("");
        setAdjustAmount("");
        setAdjustReason("");
        router.refresh();
      } else {
        toast.error("Failed to apply adjustment.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Vendor Wallets & Adjustments</h1>
          <p className="text-sm text-muted-foreground">Manage cash flow, hold balances, and issue direct credits/debits.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-95 transition-opacity cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" /> Manual Adjustment
        </button>
      </div>

      {/* Filter and Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by store name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-input bg-background pl-9 pr-4 py-2 text-sm text-foreground focus:border-accent outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted cursor-pointer"
        >
          Search
        </button>
      </form>

      {/* Wallets Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left">Vendor Store</th>
              <th className="px-4 py-3 text-right">Waiting for Release (Pending)</th>
              <th className="px-4 py-3 text-right">Available to Withdraw</th>
              <th className="px-4 py-3 text-right">Amount Deducted (Negative)</th>
              <th className="px-4 py-3 text-right">Processing (Reserved)</th>
              <th className="px-4 py-3 text-right">Total Earned</th>
              <th className="px-4 py-3 text-right">Total Paid</th>
              <th className="px-4 py-3 text-right">Total Refunded</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {initialSellers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                    <span>No wallets found matching the criteria.</span>
                  </div>
                </td>
              </tr>
            ) : (
              initialSellers.map((s) => (
                <tr key={s.sellerId} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-4.5 font-medium text-foreground">{s.storeName}</td>
                  <td className="px-4 py-4.5 text-right font-mono text-amber-600">
                    ₹{Number(s.pendingBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4.5 text-right font-mono text-emerald-600 font-semibold">
                    ₹{Number(s.withdrawableBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4.5 text-right font-mono text-destructive">
                    {s.negativeBalance > 0
                      ? `-₹${Number(s.negativeBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                      : "₹0.00"}
                  </td>
                  <td className="px-4 py-4.5 text-right font-mono text-sky-600">
                    ₹{Number(s.reserveBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4.5 text-right font-mono text-muted-foreground">
                    ₹{Number(s.totalEarned).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4.5 text-right font-mono text-muted-foreground">
                    ₹{Number(s.totalPaid).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4.5 text-right font-mono text-muted-foreground">
                    ₹{Number(s.totalRefunded).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="rounded border border-border px-3 py-1 text-xs hover:bg-muted disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="rounded border border-border px-3 py-1 text-xs hover:bg-muted disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Manual Adjustment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <h2 className="font-display text-xl mb-1">Manual Balance Adjustment</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Add or remove funds directly from a vendor store wallet. All operations require a mandatory audit reason.
            </p>

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Select Vendor Store</label>
                <select
                  value={selectedSellerId}
                  onChange={(e) => setSelectedSellerId(e.target.value)}
                  className="w-full rounded border border-input bg-background p-2 text-sm outline-none"
                  required
                >
                  <option value="">-- Choose Store --</option>
                  {initialSellers.map((s) => (
                    <option key={s.sellerId} value={s.sellerId}>
                      {s.storeName} (Avail: ₹{Number(s.withdrawableBalance).toLocaleString("en-IN")})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Adjustment Type</label>
                  <div className="flex gap-2">
                    <label className="flex-1 flex items-center gap-1.5 cursor-pointer rounded border p-2 text-xs bg-background">
                      <input
                        type="radio"
                        name="adjustType"
                        checked={adjustType === "MANUAL_CREDIT"}
                        onChange={() => setAdjustType("MANUAL_CREDIT")}
                      />
                      <span>Credit (+)</span>
                    </label>
                    <label className="flex-1 flex items-center gap-1.5 cursor-pointer rounded border p-2 text-xs bg-background">
                      <input
                        type="radio"
                        name="adjustType"
                        checked={adjustType === "MANUAL_DEBIT"}
                        onChange={() => setAdjustType("MANUAL_DEBIT")}
                      />
                      <span>Debit (-)</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Amount (INR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="₹500.00"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    className="w-full rounded border border-input bg-background p-2 text-sm outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Mandatory Audit Reason</label>
                <textarea
                  placeholder="e.g. Compensation for shipping delay or customer refund settlement..."
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full min-h-[80px] rounded border border-input bg-background p-2 text-sm outline-none"
                  required
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="rounded px-4 py-2 text-xs border border-border hover:bg-muted cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded bg-foreground text-background px-4 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Apply Adjustment"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
