"use client";

import React, { useState, useTransition } from "react";
import { updatePayoutStatusAdmin } from "@/actions/payouts";
import { updateReturnStatus, finalizeRefundAdmin } from "@/actions/returns";
import { toast } from "sonner";
import { Search, Loader2, AlertCircle, RefreshCw, CheckCircle, XCircle, ArrowRightLeft, DollarSign } from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PayoutStatus, ReturnStatus, ReturnReasonCategory, ShippingResponsibility } from "@prisma/client";

interface PayoutRequestData {
  id: string;
  sellerId: string;
  storeName: string;
  bankAccountHolder: string | null;
  bankAccountNumber: string | null;
  bankIFSC: string | null;
  bankName: string | null;
  amount: number;
  status: PayoutStatus;
  bankReference: string | null;
  rejectionReason: string | null;
  adminNotes: string | null;
  createdAt: Date;
}

interface ReturnRequestData {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  sellerStoreName: string;
  reason: string;
  description: string | null;
  status: ReturnStatus;
  refundAmount: number;
  restoreStock: boolean;
  stockRestored: boolean;
  originalShippingFee: number;
  returnShippingFee: number;
  shippingResponsibility: "SELLER" | "CUSTOMER" | "PLATFORM" | null;
  reasonCategory: "SELLER_FAULT" | "CUSTOMER_FAULT" | "PLATFORM_FAULT" | null;
  deductionAmount: number;
  sellerDeductionAmount: number;
  customerRefundAmount: number;
  platformCost: number;
  reverseCommission: boolean;
  returnReasonRuleId: string | null;
  returnReasonRule: {
    id: string;
    name: string;
    responsibility: "SELLER_FAULT" | "CUSTOMER_FAULT" | "PLATFORM_FAULT";
    originalShippingResponsibility: "SELLER" | "CUSTOMER" | "PLATFORM";
    returnShippingResponsibility: "SELLER" | "CUSTOMER" | "PLATFORM";
    reverseCommission: boolean;
  } | null;
  adminNotes: string | null;
  createdAt: Date;
}

interface SettlementsClientProps {
  payouts: PayoutRequestData[];
  returns: ReturnRequestData[];
}

export default function SettlementsClient({ payouts, returns }: SettlementsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"payouts" | "returns">("payouts");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "ALL");

  // Payout UTR Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [activePayoutId, setActivePayoutId] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refund Finalize Modal State
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [activeRefund, setActiveRefund] = useState<ReturnRequestData | null>(null);
  const [isOverrideEnabled, setIsOverrideEnabled] = useState(false);
  const [overrideCategory, setOverrideCategory] = useState<"SELLER_FAULT" | "CUSTOMER_FAULT" | "PLATFORM_FAULT">("CUSTOMER_FAULT");
  const [overrideResponsibility, setOverrideResponsibility] = useState<"SELLER" | "CUSTOMER" | "PLATFORM">("CUSTOMER");
  const [refundNotes, setRefundNotes] = useState("");

  // Apply filters to URL query
  const applyFilters = (searchVal: string, statusVal: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (searchVal.trim()) {
      params.set("search", searchVal.trim());
    } else {
      params.delete("search");
    }
    if (statusVal !== "ALL") {
      params.set("status", statusVal);
    } else {
      params.delete("status");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters(search, statusFilter);
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    applyFilters(search, val);
  };

  // Payout processing transitions
  const handlePayoutTransition = async (payoutId: string, status: PayoutStatus) => {
    const confirmed = window.confirm(`Mark this payout request as ${status.toLowerCase()}?`);
    if (!confirmed) return;

    try {
      const res = await updatePayoutStatusAdmin(payoutId, status);
      if (res.success) {
        toast.success(`Payout successfully marked as ${status.toLowerCase()}.`);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to update payout status.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    }
  };

  const handlePayoutWithReason = async (payoutId: string, status: "REJECTED" | "FAILED" | "REVERSED") => {
    const reason = window.prompt(`Please enter the reason for marking payout as ${status.toLowerCase()}:`);
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error("Reason is mandatory.");
      return;
    }

    try {
      const res = await updatePayoutStatusAdmin(payoutId, status, undefined, reason);
      if (res.success) {
        toast.success(`Payout successfully marked as ${status.toLowerCase()}.`);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to update request.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    }
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankReference.trim()) {
      toast.error("Bank reference UTR code is mandatory.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await updatePayoutStatusAdmin(activePayoutId, "PAID", bankReference, undefined, adminNotes);
      if (res.success) {
        toast.success("Payout marked as PAID.");
        setIsPayModalOpen(false);
        setBankReference("");
        setAdminNotes("");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to disburse payout.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Return request transitions
  const handleReturnTransition = async (returnId: string, status: ReturnStatus, restoreStock = true) => {
    const confirmed = window.confirm(`Mark this return request as ${status.toLowerCase()}?`);
    if (!confirmed) return;

    try {
      const res = await updateReturnStatus(returnId, status, undefined, restoreStock);
      if (res.success) {
        toast.success(`Return status updated to ${status.toLowerCase()}.`);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to update return status.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    }
  };

  const handleReturnReject = async (returnId: string) => {
    const reason = window.prompt("Please enter the reason for rejecting this return request:");
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error("Rejection reason is mandatory.");
      return;
    }

    try {
      const res = await updateReturnStatus(returnId, "REJECTED", reason, false);
      if (res.success) {
        toast.success("Return request rejected successfully.");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to reject return.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    }
  };

  const handleFinalizeRefundClick = (ret: ReturnRequestData) => {
    setActiveRefund(ret);
    setIsOverrideEnabled(false);
    setOverrideCategory((ret.reasonCategory as any) || "CUSTOMER_FAULT");
    setOverrideResponsibility((ret.shippingResponsibility as any) || "CUSTOMER");
    setRefundNotes(ret.adminNotes || "");
    setIsRefundModalOpen(true);
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRefund) return;

    setIsSubmitting(true);
    try {
      const res = await finalizeRefundAdmin(
        activeRefund.id,
        refundNotes,
        isOverrideEnabled ? overrideCategory : undefined,
        isOverrideEnabled ? overrideResponsibility : undefined
      );
      if (res.success) {
        toast.success("Refund successfully finalized.");
        setIsRefundModalOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to finalize refund.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Live calculation preview helper based on Category selection
  const getCalculatedPreview = () => {
    if (!activeRefund) return { customerRefund: 0, sellerDeduction: 0, platformCost: 0, commissionStatus: "Remains" };

    if (!isOverrideEnabled) {
      return {
        customerRefund: Number(activeRefund.customerRefundAmount),
        sellerDeduction: Number(activeRefund.sellerDeductionAmount),
        platformCost: Number(activeRefund.platformCost || 0),
        commissionStatus: activeRefund.reverseCommission ? "Reverses" : "Remains",
      };
    }

    const refundBase = Number(activeRefund.refundAmount);
    const originalShipping = Number(activeRefund.originalShippingFee || 0);
    const returnShipping = Number(activeRefund.returnShippingFee || 0);

    let origShipResp = "CUSTOMER";
    let retShipResp = "CUSTOMER";
    let reverseComm = false;

    const rule = activeRefund.returnReasonRule;
    if (rule && overrideCategory === rule.responsibility) {
      origShipResp = rule.originalShippingResponsibility;
      retShipResp = rule.returnShippingResponsibility;
      reverseComm = rule.reverseCommission;
    } else {
      if (overrideCategory === "SELLER_FAULT") {
        origShipResp = "SELLER";
        retShipResp = "SELLER";
        reverseComm = false;
      } else if (overrideCategory === "CUSTOMER_FAULT") {
        origShipResp = "CUSTOMER";
        retShipResp = "CUSTOMER";
        reverseComm = false;
      } else { // PLATFORM_FAULT
        origShipResp = "PLATFORM";
        retShipResp = "PLATFORM";
        reverseComm = true;
      }
    }

    if (overrideResponsibility) {
      retShipResp = overrideResponsibility;
    }

    let customerRefund = refundBase;
    if (origShipResp === "SELLER" || origShipResp === "PLATFORM") {
      customerRefund += originalShipping;
    }
    if (retShipResp === "CUSTOMER") {
      customerRefund -= returnShipping;
    }
    customerRefund = Math.max(0, customerRefund);

    let sellerDeduction = 0;
    if (overrideCategory !== "PLATFORM_FAULT") {
      sellerDeduction = refundBase;
      if (origShipResp === "SELLER") sellerDeduction += originalShipping;
      if (retShipResp === "SELLER") sellerDeduction += returnShipping;
    } else {
      if (origShipResp === "SELLER") sellerDeduction += originalShipping;
      if (retShipResp === "SELLER") sellerDeduction += returnShipping;
    }

    let platformCost = 0;
    if (overrideCategory === "PLATFORM_FAULT") platformCost += refundBase;
    if (origShipResp === "PLATFORM") platformCost += originalShipping;
    if (retShipResp === "PLATFORM") platformCost += returnShipping;

    return {
      customerRefund,
      sellerDeduction,
      platformCost,
      commissionStatus: reverseComm ? "Reverses" : "Remains",
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4 gap-4">
        <div>
          <h1 className="font-display text-3xl">Settlements & Refunds</h1>
          <p className="text-sm text-muted-foreground">Manage cash flow payouts to merchants and customer returns/refunds mediation.</p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-muted/60 p-1.5 rounded-lg border border-border">
          <button
            onClick={() => setActiveTab("payouts")}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === "payouts"
                ? "bg-card text-foreground shadow-sm font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <DollarSign className="h-4.5 w-4.5" /> Payout Requests
          </button>
          <button
            onClick={() => setActiveTab("returns")}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === "returns"
                ? "bg-card text-foreground shadow-sm font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <RefreshCw className="h-4 w-4" /> Returns & Refunds
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={activeTab === "payouts" ? "Search store name..." : "Search customer, store, or order..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-input bg-background pl-9 pr-4 py-2 text-sm text-foreground focus:border-accent outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted cursor-pointer"
          >
            Search
          </button>
        </form>

        {activeTab === "payouts" && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PROCESSING">Processing</option>
              <option value="PAID">Paid</option>
              <option value="FAILED">Failed</option>
              <option value="REJECTED">Rejected</option>
              <option value="REVERSED">Reversed</option>
            </select>
          </div>
        )}
      </div>

      {/* Settlements payouts view */}
      {activeTab === "payouts" && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left">Ref ID</th>
                <th className="px-4 py-3 text-left">Vendor Store</th>
                <th className="px-4 py-3 text-left">Bank Account Details</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-left">Date Requested</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-left">Audit Log / UTR</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payouts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <AlertCircle className="h-5 w-5 text-muted-foreground" />
                      <span>No payout requests found.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-4.5 font-medium text-foreground">PAY-{p.id.substring(0, 8).toUpperCase()}</td>
                    <td className="px-4 py-4.5 text-foreground">{p.storeName}</td>
                    <td className="px-4 py-4.5 text-xs text-muted-foreground leading-normal">
                      {p.bankAccountNumber ? (
                        <div>
                          <div className="font-semibold text-foreground">{p.bankAccountHolder}</div>
                          <div>{p.bankName} - A/C: {p.bankAccountNumber}</div>
                          <div>IFSC: {p.bankIFSC}</div>
                        </div>
                      ) : (
                        <span className="text-destructive font-semibold">No bank account listed</span>
                      )}
                    </td>
                    <td className="px-4 py-4.5 text-right font-mono font-semibold text-foreground">
                      ₹{Number(p.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-4.5 text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-4.5 text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          p.status === "PENDING"
                            ? "bg-amber-100 text-amber-800"
                            : p.status === "PROCESSING"
                            ? "bg-blue-100 text-blue-800"
                            : p.status === "PAID"
                            ? "bg-emerald-100 text-emerald-800"
                            : p.status === "REJECTED"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-4.5 text-xs text-muted-foreground leading-normal">
                      {p.status === "PAID" && (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-semibold text-emerald-700">UTR: {p.bankReference}</span>
                          {p.adminNotes && <span>Notes: {p.adminNotes}</span>}
                        </div>
                      )}
                      {(p.status === "REJECTED" || p.status === "FAILED") && (
                        <div className="text-destructive">
                          <span className="font-semibold">Reason:</span> {p.rejectionReason}
                        </div>
                      )}
                      {p.status === "REVERSED" && (
                        <div className="text-purple-700">
                          <span className="font-semibold">Reversal:</span> {p.rejectionReason}
                        </div>
                      )}
                      {p.status === "PROCESSING" && <span className="text-blue-600 animate-pulse font-medium">Processing payment...</span>}
                      {p.status === "PENDING" && <span>Awaiting admin review</span>}
                    </td>
                    <td className="px-4 py-4.5 text-right space-x-1.5 whitespace-nowrap">
                      {p.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => handlePayoutTransition(p.id, "PROCESSING")}
                            className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 cursor-pointer"
                          >
                            Process
                          </button>
                          <button
                            onClick={() => handlePayoutWithReason(p.id, "REJECTED")}
                            className="rounded border border-border px-2.5 py-1 text-xs font-medium text-destructive hover:bg-red-50 cursor-pointer"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {p.status === "PROCESSING" && (
                        <>
                          <button
                            onClick={() => {
                              setActivePayoutId(p.id);
                              setIsPayModalOpen(true);
                            }}
                            className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 cursor-pointer"
                          >
                            Disburse (Paid)
                          </button>
                          <button
                            onClick={() => handlePayoutWithReason(p.id, "FAILED")}
                            className="rounded border border-border px-2.5 py-1 text-xs font-medium text-destructive hover:bg-red-50 cursor-pointer"
                          >
                            Mark Failed
                          </button>
                        </>
                      )}
                      {p.status === "PAID" && (
                        <button
                          onClick={() => handlePayoutWithReason(p.id, "REVERSED")}
                          className="rounded border border-border px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50 cursor-pointer"
                        >
                          Reverse
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Return Requests view */}
      {activeTab === "returns" && (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left">Ref ID</th>
                <th className="px-4 py-3 text-left">Order Number</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Atelier / Vendor</th>
                <th className="px-4 py-3 text-left">Return Reason</th>
                <th className="px-4 py-3 text-right">Refund Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {returns.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <AlertCircle className="h-5 w-5 text-muted-foreground" />
                      <span>No returns or refund requests found.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                returns.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-4 font-semibold text-foreground font-mono">RET-{r.id.substring(0, 8).toUpperCase()}</td>
                    <td className="px-4 py-4 font-semibold text-foreground font-mono">{r.orderNumber}</td>
                    <td className="px-4 py-4 text-xs text-muted-foreground leading-normal">
                      <div className="font-semibold text-foreground">{r.customerName}</div>
                      <div>{r.customerEmail}</div>
                    </td>
                    <td className="px-4 py-4 text-foreground">{r.sellerStoreName}</td>
                    <td className="px-4 py-4 text-xs text-muted-foreground leading-normal">
                      <div className="font-semibold text-foreground">{r.reason}</div>
                      {r.description && <div className="mt-0.5 italic">"{r.description}"</div>}
                      <div className="mt-1 flex flex-wrap gap-1 text-[9px] font-bold">
                        <span className="bg-stone-100 text-stone-700 px-1 py-0.5 rounded border border-stone-200">
                          {r.reasonCategory ? r.reasonCategory.replace("_FAULT", " FAULT") : "CUSTOMER FAULT"}
                        </span>
                        {r.originalShippingFee > 0 && (
                          <span className="bg-stone-100 text-stone-600 px-1 py-0.5 rounded border border-stone-200">
                            Orig Ship: ₹{r.originalShippingFee}
                          </span>
                        )}
                        {r.returnShippingFee > 0 && (
                          <span className="bg-stone-100 text-stone-600 px-1 py-0.5 rounded border border-stone-200">
                            Ret Ship: ₹{r.returnShippingFee}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-xs text-muted-foreground leading-normal">
                      <div className="font-semibold text-foreground">₹{Number(r.customerRefundAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div>
                      <div className="text-[10px] text-rose-600">Seller Dec: ₹{Number(r.sellerDeductionAmount).toLocaleString("en-IN")}</div>
                      {Number(r.platformCost) > 0 && (
                        <div className="text-[10px] text-blue-600 font-semibold">Platform: ₹{Number(r.platformCost).toLocaleString("en-IN")}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          r.status === "REQUESTED"
                            ? "bg-amber-100 text-amber-800"
                            : r.status === "APPROVED"
                            ? "bg-blue-100 text-blue-800"
                            : r.status === "ITEM_RECEIVED"
                            ? "bg-indigo-100 text-indigo-800"
                            : r.status === "REFUNDED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right space-x-1.5 whitespace-nowrap">
                      {r.status === "REQUESTED" && (
                        <>
                          <button
                            onClick={() => handleReturnTransition(r.id, "APPROVED")}
                            className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReturnReject(r.id)}
                            className="rounded border border-border px-2.5 py-1 text-xs font-medium text-destructive hover:bg-red-50 cursor-pointer"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {r.status === "APPROVED" && (
                        <>
                          <button
                            onClick={() => handleReturnTransition(r.id, "ITEM_RECEIVED")}
                            className="rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 cursor-pointer"
                          >
                            Item Received
                          </button>
                        </>
                      )}
                      {(r.status === "APPROVED" || r.status === "ITEM_RECEIVED") && (
                        <button
                          onClick={() => handleFinalizeRefundClick(r)}
                          className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 cursor-pointer"
                        >
                          Issue Refund
                        </button>
                      )}
                      {r.status === "REFUNDED" && (
                        <span className="text-xs text-emerald-600 font-semibold flex items-center justify-end gap-1">
                          ✓ Refund Issued
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* UTR Input Payout Modal */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <h2 className="font-display text-xl mb-1">Confirm Disbursement</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Enter the bank reference / UTR code returned by your bank transaction. This action will deduct reserves and mark the request as paid.
            </p>

            <form onSubmit={handlePaySubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Bank Reference / UTR Number</label>
                <input
                  type="text"
                  placeholder="e.g. UTRN1293840294"
                  value={bankReference}
                  onChange={(e) => setBankReference(e.target.value)}
                  className="w-full rounded border border-input bg-background p-2 text-sm outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Disbursement Notes (Optional)</label>
                <textarea
                  placeholder="Paid from primary HDFC escrow account..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full min-h-[60px] rounded border border-input bg-background p-2 text-sm outline-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
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
                      Saving...
                    </>
                  ) : (
                    "Mark Disbursed"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Refund Finalization Details & Overrides Modal */}
      {isRefundModalOpen && activeRefund && (() => {
        const preview = getCalculatedPreview();
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg space-y-4">
              <div>
                <h2 className="font-display text-xl mb-1">Finalize Customer Refund</h2>
                <p className="text-xs text-muted-foreground">
                  Mediate shipping responsibility, review calculated financial cost splits, and approve refund transaction.
                </p>
              </div>

              <form onSubmit={handleRefundSubmit} className="space-y-4">
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 space-y-1">
                  <div className="text-xs text-stone-500 font-semibold">Selected return reason:</div>
                  <div className="text-sm font-bold text-stone-900">{activeRefund.reason}</div>
                  {activeRefund.description && (
                    <div className="text-xs text-stone-550 italic">"{activeRefund.description}"</div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="enableOverrideCheck"
                    checked={isOverrideEnabled}
                    onChange={(e) => setIsOverrideEnabled(e.target.checked)}
                    className="rounded border-input text-stone-950 focus:ring-stone-950 h-4 w-4 cursor-pointer"
                  />
                  <label htmlFor="enableOverrideCheck" className="text-xs font-bold text-stone-700 cursor-pointer select-none">
                    Enable Advanced Override (Modify rules manually)
                  </label>
                </div>

                {isOverrideEnabled && (
                  <div className="grid grid-cols-2 gap-4 bg-amber-50/50 border border-amber-200/50 p-3 rounded-lg animate-fadeIn">
                    {/* Category selector */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Reason Category</label>
                      <select
                        value={overrideCategory}
                        onChange={(e) => {
                          const cat = e.target.value as any;
                          setOverrideCategory(cat);
                          if (cat === "SELLER_FAULT") setOverrideResponsibility("SELLER");
                          else if (cat === "CUSTOMER_FAULT") setOverrideResponsibility("CUSTOMER");
                          else setOverrideResponsibility("PLATFORM");
                        }}
                        className="w-full rounded border border-input bg-background p-2 text-sm outline-none font-semibold text-foreground"
                      >
                        <option value="SELLER_FAULT">Seller Fault</option>
                        <option value="CUSTOMER_FAULT">Customer Fault</option>
                        <option value="PLATFORM_FAULT">Platform Fault</option>
                      </select>
                    </div>

                    {/* Responsibility selector */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Shipping Responsibility</label>
                      <select
                        value={overrideResponsibility}
                        onChange={(e) => setOverrideResponsibility(e.target.value as any)}
                        className="w-full rounded border border-input bg-background p-2 text-sm outline-none font-semibold text-foreground"
                      >
                        <option value="SELLER">Seller</option>
                        <option value="CUSTOMER">Customer</option>
                        <option value="PLATFORM">Platform</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Financial breakdown table */}
                <div className="rounded-lg bg-muted/40 p-4 border border-border space-y-2.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1.5">
                    Calculated Settlement Breakdown
                  </div>
                  <div className="grid grid-cols-2 text-xs leading-normal gap-y-1.5 font-medium text-muted-foreground">
                    <div>Product Base Value:</div>
                    <div className="text-right text-foreground">₹{Number(activeRefund.refundAmount).toFixed(2)}</div>

                    <div>Original Shipping Paid:</div>
                    <div className="text-right text-foreground">₹{Number(activeRefund.originalShippingFee).toFixed(2)}</div>

                    <div>Return Shipping Cost:</div>
                    <div className="text-right text-foreground">₹{Number(activeRefund.returnShippingFee).toFixed(2)}</div>

                    <div>Commission Status:</div>
                    <div className="text-right text-foreground font-semibold">{preview.commissionStatus}</div>
                  </div>

                  <div className="border-t border-dashed border-border pt-2 grid grid-cols-3 text-center gap-2">
                    <div className="bg-emerald-50 border border-emerald-100 p-2 rounded">
                      <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Customer Refund</div>
                      <div className="text-sm font-extrabold text-emerald-700 mt-0.5">₹{preview.customerRefund.toFixed(2)}</div>
                    </div>
                    <div className="bg-rose-50 border border-rose-100 p-2 rounded">
                      <div className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Seller Deduct</div>
                      <div className="text-sm font-extrabold text-rose-700 mt-0.5">₹{preview.sellerDeduction.toFixed(2)}</div>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 p-2 rounded">
                      <div className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">Platform Cost</div>
                      <div className="text-sm font-extrabold text-blue-700 mt-0.5">₹{preview.platformCost.toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                {/* Notes input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Refund Transaction Notes / Internal Memo</label>
                  <textarea
                    placeholder="Enter details of processing e.g. Reconciled, items returned damaged..."
                    value={refundNotes}
                    onChange={(e) => setRefundNotes(e.target.value)}
                    className="w-full min-h-[70px] rounded border border-input bg-background p-2 text-sm outline-none"
                    required
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRefundModalOpen(false)}
                    disabled={isSubmitting}
                    className="rounded px-4 py-2 text-xs border border-border hover:bg-muted cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded bg-emerald-600 text-white px-4 py-2 text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Approve & Finalize Refund"
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
