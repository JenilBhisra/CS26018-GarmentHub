"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { 
  CheckCircle2, XCircle, AlertCircle, CheckSquare, Square, 
  DollarSign, UserCheck, ArrowRight, Search, Loader2, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { bulkApproveKycAdmin, bulkApprovePayoutsAdmin } from "@/actions/bulk";

interface KycItem {
  id: string;
  sellerId: string;
  storeName: string;
  gstCertificate: string | null;
  panCard: string | null;
  idProof: string | null;
  addressProof: string | null;
  bankProof: string | null;
  status: string;
}

interface PayoutItem {
  id: string;
  sellerId: string;
  storeName: string;
  bankAccountHolder: string | null;
  bankAccountNumber: string | null;
  bankIFSC: string | null;
  bankName: string | null;
  amount: number;
  status: string;
  createdAt: Date;
}

interface DisputeItem {
  id: string;
  orderId: string | null;
  orderNumber: string;
  reason: string;
  description: string;
  status: string;
  totalAmount: number;
  createdAt: Date;
}

interface AdminTasksClientProps {
  initialKyc: KycItem[];
  initialPayouts: PayoutItem[];
  initialDisputes: DisputeItem[];
}

export default function AdminTasksClient({
  initialKyc,
  initialPayouts,
  initialDisputes,
}: AdminTasksClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"all" | "kyc" | "payouts" | "disputes">("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // KYC Selections
  const [selectedKycIds, setSelectedKycIds] = useState<string[]>([]);
  const [isKycSubmitting, startKycTransition] = useTransition();

  // Payout Selections
  const [selectedPayoutIds, setSelectedPayoutIds] = useState<string[]>([]);
  const [payoutStatus, setPayoutStatus] = useState<"PROCESSING" | "PAID">("PROCESSING");
  const [payoutUtr, setPayoutUtr] = useState("");
  const [isPayoutSubmitting, startPayoutTransition] = useTransition();

  // Format currency helper
  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Bulk KYC Approve
  const handleBulkKycApprove = () => {
    if (selectedKycIds.length === 0) return;
    startKycTransition(async () => {
      const res = await bulkApproveKycAdmin(selectedKycIds);
      if (res.success) {
        toast.success(`Successfully approved ${res.succeeded.length} KYC profiles!`);
        setSelectedKycIds([]);
        router.refresh();
      } else {
        toast.error(`Kyc approval completed with errors. Succeeded: ${res.succeeded.length}, Failed: ${res.failed.length}`);
        router.refresh();
      }
    });
  };

  // Bulk Payout Approve
  const handleBulkPayoutApprove = () => {
    if (selectedPayoutIds.length === 0) return;
    if (payoutStatus === "PAID" && !payoutUtr.trim()) {
      toast.error("Bank Reference / UTR number is mandatory when marking payouts as PAID.");
      return;
    }

    startPayoutTransition(async () => {
      const res = await bulkApprovePayoutsAdmin(selectedPayoutIds, payoutStatus, payoutUtr);
      if (res.success) {
        toast.success(`Successfully processed ${res.succeeded.length} payout requests!`);
        setSelectedPayoutIds([]);
        setPayoutUtr("");
        router.refresh();
      } else {
        toast.error(`Payout processing completed with errors. Succeeded: ${res.succeeded.length}, Failed: ${res.failed.length}`);
        router.refresh();
      }
    });
  };

  const toggleKycSelection = (id: string) => {
    setSelectedKycIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const togglePayoutSelection = (id: string) => {
    setSelectedPayoutIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Filters
  const filteredKyc = initialKyc.filter(k => 
    k.storeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredPayouts = initialPayouts.filter(p => 
    p.storeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDisputes = initialDisputes.filter(d => 
    d.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.reason.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalTasksCount = filteredKyc.length + filteredPayouts.length + filteredDisputes.length;

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-light text-stone-900 flex items-center gap-2">
            Admin Task Center
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
              {totalTasksCount} Action Items
            </span>
          </h1>
          <p className="text-sm text-stone-500 mt-1">Consolidated operational desk to resolve merchant validations, disbursements, and customer disputes.</p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Filter task records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-stone-200 bg-white py-1.5 pl-10 pr-4 text-xs font-medium placeholder:text-stone-400 focus:border-stone-400 focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* Tabs list navigation */}
      <div className="flex gap-2 border-b border-stone-200 pb-px">
        {[
          { id: "all", label: `All Actions (${totalTasksCount})` },
          { id: "kyc", label: `KYC Review (${filteredKyc.length})` },
          { id: "payouts", label: `Payout Requests (${filteredPayouts.length})` },
          { id: "disputes", label: `Customer Disputes (${filteredDisputes.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 text-xs font-semibold border-b-2 transition-all px-2 ${
              activeTab === tab.id
                ? "border-stone-900 text-stone-900"
                : "border-transparent text-stone-500 hover:text-stone-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. KYC approvals center */}
      {(activeTab === "all" || activeTab === "kyc") && filteredKyc.length > 0 && (
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-3">
            <h2 className="text-sm font-bold text-stone-850 flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-indigo-600" />
              Pending Merchant KYC Profiles
            </h2>
            {selectedKycIds.length > 0 && (
              <button
                onClick={handleBulkKycApprove}
                disabled={isKycSubmitting}
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-stone-900 text-white hover:opacity-90 transition px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                {isKycSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Approve Selected ({selectedKycIds.length})
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-150 text-stone-400 font-bold uppercase tracking-wider">
                  <th className="py-2.5 w-10">Select</th>
                  <th className="py-2.5">Store Name</th>
                  <th className="py-2.5">GST Cert</th>
                  <th className="py-2.5">PAN Card</th>
                  <th className="py-2.5">ID Proof</th>
                  <th className="py-2.5">Address Proof</th>
                  <th className="py-2.5">Bank Proof</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
                {filteredKyc.map((k) => (
                  <tr key={k.id} className="hover:bg-stone-50/50">
                    <td className="py-3">
                      <button onClick={() => toggleKycSelection(k.id)} className="text-stone-500 hover:text-stone-800">
                        {selectedKycIds.includes(k.id) ? (
                          <CheckSquare className="h-4.5 w-4.5 text-indigo-600" />
                        ) : (
                          <Square className="h-4.5 w-4.5" />
                        )}
                      </button>
                    </td>
                    <td className="py-3 font-semibold text-stone-900">{k.storeName}</td>
                    <td className="py-3">
                      {k.gstCertificate ? (
                        <a href={k.gstCertificate} target="_blank" className="text-indigo-600 hover:underline">View GST</a>
                      ) : (
                        <span className="text-stone-400">Missing</span>
                      )}
                    </td>
                    <td className="py-3">
                      {k.panCard ? (
                        <a href={k.panCard} target="_blank" className="text-indigo-600 hover:underline">View PAN</a>
                      ) : (
                        <span className="text-stone-400">Missing</span>
                      )}
                    </td>
                    <td className="py-3">
                      {k.idProof ? (
                        <a href={k.idProof} target="_blank" className="text-indigo-600 hover:underline">View ID</a>
                      ) : (
                        <span className="text-stone-400">Missing</span>
                      )}
                    </td>
                    <td className="py-3">
                      {k.addressProof ? (
                        <a href={k.addressProof} target="_blank" className="text-indigo-600 hover:underline">View Address</a>
                      ) : (
                        <span className="text-stone-400">Missing</span>
                      )}
                    </td>
                    <td className="py-3">
                      {k.bankProof ? (
                        <a href={k.bankProof} target="_blank" className="text-indigo-600 hover:underline">View Bank</a>
                      ) : (
                        <span className="text-stone-400">Missing</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 2. Payouts disbursement center */}
      {(activeTab === "all" || activeTab === "payouts") && filteredPayouts.length > 0 && (
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-stone-100 pb-3">
            <h2 className="text-sm font-bold text-stone-850 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              Pending Disbursements & Payouts
            </h2>
            
            {selectedPayoutIds.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={payoutStatus}
                  onChange={(e) => setPayoutStatus(e.target.value as any)}
                  className="rounded-lg border border-stone-200 bg-white text-xs font-semibold px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="PROCESSING">Mark Processing</option>
                  <option value="PAID">Mark Disbursed (PAID)</option>
                </select>

                {payoutStatus === "PAID" && (
                  <input
                    type="text"
                    placeholder="Enter UTR Reference..."
                    value={payoutUtr}
                    onChange={(e) => setPayoutUtr(e.target.value)}
                    className="rounded-lg border border-stone-200 bg-white text-xs font-semibold px-2.5 py-1.5 w-44 focus:border-stone-400 focus:outline-none"
                  />
                )}

                <button
                  onClick={handleBulkPayoutApprove}
                  disabled={isPayoutSubmitting}
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition px-3 py-1.5 rounded-lg disabled:opacity-50"
                >
                  {isPayoutSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Execute Bulk Action ({selectedPayoutIds.length})
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-150 text-stone-400 font-bold uppercase tracking-wider">
                  <th className="py-2.5 w-10">Select</th>
                  <th className="py-2.5">Merchant Store</th>
                  <th className="py-2.5">Bank Account details</th>
                  <th className="py-2.5 text-right">Disbursable Amt</th>
                  <th className="py-2.5 text-center">Status</th>
                  <th className="py-2.5">Request Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
                {filteredPayouts.map((p) => (
                  <tr key={p.id} className="hover:bg-stone-50/50">
                    <td className="py-3">
                      <button onClick={() => togglePayoutSelection(p.id)} className="text-stone-500 hover:text-stone-800">
                        {selectedPayoutIds.includes(p.id) ? (
                          <CheckSquare className="h-4.5 w-4.5 text-emerald-600" />
                        ) : (
                          <Square className="h-4.5 w-4.5" />
                        )}
                      </button>
                    </td>
                    <td className="py-3">
                      <div className="font-semibold text-stone-900">{p.storeName}</div>
                    </td>
                    <td className="py-3 text-[11px] text-stone-500">
                      <div>Holder: {p.bankAccountHolder || "N/A"}</div>
                      <div>Bank: {p.bankName || "N/A"} · A/C: {p.bankAccountNumber || "N/A"}</div>
                      <div>IFSC: {p.bankIFSC || "N/A"}</div>
                    </td>
                    <td className="py-3 text-right font-bold text-stone-950">{formatCurrency(p.amount)}</td>
                    <td className="py-3 text-center">
                      <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3 text-stone-400 font-mono text-[11px]">
                      {new Date(p.createdAt).toLocaleDateString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 3. Disputes center */}
      {(activeTab === "all" || activeTab === "disputes") && filteredDisputes.length > 0 && (
        <section className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
          <div className="border-b border-stone-100 pb-3">
            <h2 className="text-sm font-bold text-stone-850 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              Open Customer Disputes
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {filteredDisputes.map((d) => (
              <div key={d.id} className="rounded-xl border border-stone-200 bg-stone-50/30 p-4 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-stone-900 font-mono text-xs">{d.orderNumber}</span>
                    <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-bold text-red-700 border border-red-200">
                      DISPUTED
                    </span>
                  </div>
                  <div className="text-xs font-bold text-stone-800 mt-2">Reason: {d.reason}</div>
                  <p className="text-[11px] text-stone-500 mt-1 line-clamp-2">{d.description}</p>
                </div>

                <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                  <span className="font-semibold text-stone-900">Total: {formatCurrency(d.totalAmount)}</span>
                  <button 
                    onClick={() => router.push(`/admin/disputes?id=${d.id}`)}
                    className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800 transition"
                  >
                    Investigate
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {totalTasksCount === 0 && (
        <div className="rounded-xl border border-dashed border-stone-250 bg-stone-50/50 p-12 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-stone-400" />
          <h3 className="mt-4 text-sm font-bold text-stone-850">All Clear! No operational tasks pending.</h3>
          <p className="mt-1 text-xs text-stone-500">Every dispute has been resolved, payouts completed, and KYC review lists are empty.</p>
        </div>
      )}
    </div>
  );
}
