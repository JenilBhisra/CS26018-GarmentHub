"use client";

import React, { useState, useTransition } from "react";
import { requestPayout } from "@/actions/payouts";
import { releasePendingBalances } from "@/actions/wallets"; // manual release trigger for local verification
import { toast } from "sonner";
import { Loader2, AlertCircle, ArrowUpRight, ArrowDownLeft, CheckCircle2, History, CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import { PayoutStatus, TransactionType } from "@prisma/client";

interface WalletTxData {
  id: string;
  amount: number;
  type: TransactionType;
  status: PayoutStatus;
  description: string | null;
  releaseAt: Date | null;
  isReleased: boolean;
  createdAt: Date;
}

interface PayoutReqData {
  id: string;
  amount: number;
  status: PayoutStatus;
  bankReference: string | null;
  rejectionReason: string | null;
  adminNotes: string | null;
  createdAt: Date;
}

interface WalletClientProps {
  sellerId: string;
  withdrawableBalance: number;
  pendingBalance: number;
  negativeBalance: number;
  reserveBalance: number;
  totalEarned: number;
  totalPaid: number;
  totalRefunded: number;
  kycApproved: boolean;
  bankComplete: boolean;
  payouts: PayoutReqData[];
  transactions: WalletTxData[];
}

export default function WalletClient({
  sellerId,
  withdrawableBalance,
  pendingBalance,
  negativeBalance,
  reserveBalance,
  totalEarned,
  totalPaid,
  totalRefunded,
  kycApproved,
  bankComplete,
  payouts,
  transactions,
}: WalletClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [payoutAmount, setPayoutAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);

  const canRequestPayout = kycApproved && bankComplete && negativeBalance === 0 && withdrawableBalance > 0;

  // Handle payout request submission
  const handlePayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }
    if (amount > withdrawableBalance) {
      toast.error(`Insufficient balance. Max withdrawal: ₹${withdrawableBalance.toLocaleString("en-IN")}`);
      return;
    }

    const confirmed = window.confirm(
      `Confirm withdrawal request of ₹${amount.toLocaleString("en-IN")}? It will be processed into your registered bank account.`
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const res = await requestPayout(amount);
      if (res.success) {
        toast.success("Payout request successfully submitted!");
        setPayoutAmount("");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to request payout.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Run Balance Release simulation locally (Testing Helper)
  const triggerBalanceRelease = async () => {
    setIsReleasing(true);
    try {
      const res = await releasePendingBalances(sellerId);
      if (res.success) {
        if (res.count > 0) {
          toast.success(`Released ${res.count} pending earning transaction(s) to withdrawable balance!`);
          router.refresh();
        } else {
          toast.info("No pending earnings matured yet for release (7 days return hold active).");
        }
      } else {
        toast.error("Release processing failed.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setIsReleasing(false);
    }
  };

  const getTxTypeLabel = (t: TransactionType) => {
    switch (t) {
      case "EARNING":
        return "Earning Credited";
      case "PAYOUT":
        return "Payout Requested";
      case "REFUND":
        return "Refund Deduction";
      case "MANUAL_CREDIT":
        return "Manual Adjustment Credit";
      case "MANUAL_DEBIT":
        return "Manual Adjustment Debit";
      case "RELEASE":
        return "Balance Released";
      default:
        return t;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Wallet & Earnings</h1>
          <p className="text-sm text-muted-foreground">Monitor settlement cycles, track withdrawable balances, and submit requests.</p>
        </div>
        
        {/* Release simulator button for local testing */}
        <button
          onClick={triggerBalanceRelease}
          disabled={isReleasing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 cursor-pointer shrink-0"
        >
          {isReleasing ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          )}
          Check Balance Maturities
        </button>
      </div>

      {/* Verification alerts */}
      {!kycApproved && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-800 flex gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold">KYC Verification Incomplete</h4>
            <p className="mt-0.5">Your payouts are locked until your store KYC profile is submitted and approved by administration.</p>
          </div>
        </div>
      )}

      {kycApproved && !bankComplete && (
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 text-xs text-red-800 flex gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold">Bank Details Missing</h4>
            <p className="mt-0.5">Please update your registered bank details (Account Holder, Number, IFSC, Name) in settings to enable payouts.</p>
          </div>
        </div>
      )}

      {/* Balances Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Available to Withdraw</div>
          <div className="mt-2 font-display text-3xl text-emerald-600 font-semibold">
            ₹{withdrawableBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1.5">Cleared balances ready for payout</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Waiting for Return Period</div>
          <div className="mt-2 font-display text-3xl text-amber-600 font-semibold">
            ₹{pendingBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1.5">Pending release (7 days customer return window)</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Amount Deducted</div>
          <div className="mt-2 font-display text-3xl text-destructive font-semibold">
            {negativeBalance > 0
              ? `-₹${negativeBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
              : "₹0.00"}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1.5">Recovered automatically from future releases</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Payment Under Review</div>
          <div className="mt-2 font-display text-3xl text-sky-600 font-semibold">
            ₹{reserveBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1.5">Withdrawn payouts currently processing</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Payout Form */}
        <section className="rounded-lg border border-border bg-card p-5 lg:col-span-1 h-fit">
          <h2 className="font-display text-lg mb-2">Request Payout</h2>
          <form onSubmit={handlePayoutSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground font-semibold">Amount to Withdraw (INR)</label>
              <input
                type="number"
                min="1"
                step="0.01"
                placeholder="₹10,000.00"
                value={payoutAmount}
                disabled={!canRequestPayout}
                onChange={(e) => setPayoutAmount(e.target.value)}
                className="w-full rounded border border-input bg-background p-2.5 text-sm outline-none focus:border-accent disabled:opacity-50"
                required
              />
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                Maximum withdrawable: ₹{withdrawableBalance.toLocaleString("en-IN")}
              </span>
            </div>

            {negativeBalance > 0 && (
              <div className="rounded bg-destructive/10 p-2.5 text-[11px] text-destructive leading-normal">
                You cannot withdraw while your wallet is in a negative balance. Credits will first recover debt.
              </div>
            )}

            <button
              type="submit"
              disabled={!canRequestPayout || isSubmitting}
              className="w-full rounded-lg bg-foreground text-background py-2.5 text-center text-sm font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              Withdraw Funds
            </button>
          </form>
        </section>

        {/* Histories logs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Payout History */}
          <section className="rounded-lg border border-border bg-card">
            <div className="border-b border-border p-4 font-semibold text-foreground flex items-center gap-1.5">
              <History className="h-4 w-4" /> Settlement History
            </div>
            <div className="max-h-[220px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/10 text-xs text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-2 text-left">Date requested</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2 text-center">Status</th>
                    <th className="px-4 py-2 text-left">Reference / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payouts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-xs">
                        No settlements requested yet.
                      </td>
                    </tr>
                  ) : (
                    payouts.map((p) => (
                      <tr key={p.id} className="text-xs">
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(p.createdAt).toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                          ₹{Number(p.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              p.status === "PAID"
                                ? "bg-emerald-100 text-emerald-800"
                                : p.status === "PENDING"
                                ? "bg-amber-100 text-amber-800"
                                : p.status === "PROCESSING"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {p.status === "PAID" && `UTR: ${p.bankReference || "N/A"}`}
                          {(p.status === "REJECTED" || p.status === "FAILED") && `Reason: ${p.rejectionReason}`}
                          {p.status === "PROCESSING" && "Processing with bank..."}
                          {p.status === "PENDING" && "Under platform review"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Wallet ledger logs */}
          <section className="rounded-lg border border-border bg-card">
            <div className="border-b border-border p-4 font-semibold text-foreground flex items-center gap-1.5">
              <History className="h-4 w-4" /> Recent Ledger Transactions
            </div>
            <div className="max-h-[220px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/10 text-xs text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Description</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground text-xs">
                        No transactions recorded in wallet ledger.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((t) => (
                      <tr key={t.id} className="text-xs">
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(t.createdAt).toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-foreground leading-normal">
                          <div className="font-medium">{getTxTypeLabel(t.type)}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{t.description}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">
                          <span
                            className={
                              t.amount > 0 ? "text-emerald-600 inline-flex items-center gap-0.5" : "text-destructive inline-flex items-center gap-0.5"
                            }
                          >
                            {t.amount > 0 ? (
                              <ArrowDownLeft className="h-3 w-3" />
                            ) : (
                              <ArrowUpRight className="h-3 w-3" />
                            )}
                            ₹{Math.abs(t.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
