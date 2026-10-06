"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { approveVendor, rejectVendor } from "@/actions/admin";
import type { VendorRequestRow } from "@/actions/admin";
import {
  CheckCircle, XCircle, Clock, Store, Building2,
  ChevronDown, Search, X, AlertTriangle,
} from "lucide-react";
import { useRouter } from "next/navigation";

type StatusFilter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";
type TypeFilter = "ALL" | "SELLER" | "B2B_VENDOR";

interface Props {
  initialRequests: VendorRequestRow[];
}

export function VendorRequestsClient({ initialRequests }: Props) {
  const router = useRouter();
  const [requests, setRequests] = useState<VendorRequestRow[]>(initialRequests);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Reject modal state
  const [rejectTarget, setRejectTarget] = useState<VendorRequestRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Detail modal state
  const [detailTarget, setDetailTarget] = useState<VendorRequestRow | null>(null);

  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Filtered list
  const filtered = requests.filter((r) => {
    if (statusFilter !== "ALL" && r.approvalStatus !== statusFilter) return false;
    if (typeFilter !== "ALL" && r.type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.businessName.toLowerCase().includes(q) ||
        r.ownerName.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
      );
    }
    return true;
  });

  function showFeedback(type: "success" | "error", msg: string) {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3500);
  }

  function handleApprove(row: VendorRequestRow) {
    startTransition(async () => {
      const result = await approveVendor(row.profileId, row.type);
      if (result.success) {
        setRequests((prev) =>
          prev.map((r) =>
            r.profileId === row.profileId
              ? { ...r, approvalStatus: "APPROVED", verifiedAt: new Date() }
              : r
          )
        );
        showFeedback("success", `${row.businessName} approved successfully.`);
        router.refresh();
      } else {
        showFeedback("error", result.error);
      }
    });
  }

  function openRejectModal(row: VendorRequestRow) {
    setRejectTarget(row);
    setRejectReason("");
  }

  function handleRejectSubmit() {
    if (!rejectTarget || !rejectReason.trim()) return;
    const target = rejectTarget;
    startTransition(async () => {
      const result = await rejectVendor(target.profileId, target.type, rejectReason);
      if (result.success) {
        setRequests((prev) =>
          prev.map((r) =>
            r.profileId === target.profileId
              ? { ...r, approvalStatus: "REJECTED", rejectedReason: rejectReason }
              : r
          )
        );
        showFeedback("success", `${target.businessName} rejected.`);
        setRejectTarget(null);
        router.refresh();
      } else {
        showFeedback("error", result.error);
      }
    });
  }

  const STATUS_TABS: { label: string; value: StatusFilter }[] = [
    { label: "Pending", value: "PENDING" },
    { label: "Approved", value: "APPROVED" },
    { label: "Rejected", value: "REJECTED" },
    { label: "All", value: "ALL" },
  ];

  const pendingCount = requests.filter((r) => r.approvalStatus === "PENDING").length;

  return (
    <>
      {/* Feedback toast */}
      {feedback && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm shadow-lg border ${
            feedback.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          )}
          {feedback.msg}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Toolbar */}
        <div className="border-b border-border p-4 space-y-3">
          {/* Status tabs */}
          <div className="flex items-center gap-1 flex-wrap">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setStatusFilter(t.value)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === t.value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {t.label}
                {t.value === "PENDING" && pendingCount > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${statusFilter === "PENDING" ? "bg-white/20" : "bg-amber-100 text-amber-700"}`}>
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              {/* Type filter */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                className="text-xs border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground outline-none"
              >
                <option value="ALL">All types</option>
                <option value="SELLER">Sellers only</option>
                <option value="B2B_VENDOR">B2B only</option>
              </select>
            </div>
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search by business, owner or email…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-4 py-2 text-sm border border-border rounded-lg bg-background outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
            No requests match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="px-4 py-3 text-left">Business</th>
                  <th className="px-4 py-3 text-left">Owner</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">GST/PAN</th>
                  <th className="px-4 py-3 text-left">Applied</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((row) => (
                  <RequestRow
                    key={row.profileId}
                    row={row}
                    isPending={isPending}
                    onApprove={() => handleApprove(row)}
                    onReject={() => openRejectModal(row)}
                    onViewDetail={() => setDetailTarget(row)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer count */}
        <div className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
          Showing {filtered.length} of {requests.length} requests
        </div>
      </div>

      {/* Reject Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setRejectTarget(null)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-background border border-border p-6 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-semibold text-foreground">Reject Vendor Application</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Rejecting: <span className="font-medium text-foreground">{rejectTarget.businessName}</span>
                </p>
              </div>
              <button onClick={() => setRejectTarget(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-xs text-red-700 mb-4 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              The vendor will be notified of this rejection and will see your reason when they log in.
            </div>

            <div className="space-y-2 mb-5">
              <label htmlFor="reject-reason" className="block text-xs font-medium text-foreground">
                Rejection reason <span className="text-red-500">*</span>
              </label>
              <textarea
                id="reject-reason"
                rows={4}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this application is being rejected…"
                className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setRejectTarget(null)}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={!rejectReason.trim() || isPending}
                className="flex-1 rounded-xl bg-red-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Rejecting…
                  </span>
                ) : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDetailTarget(null)} />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-background border border-border p-6 shadow-xl">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="font-semibold text-foreground text-lg">{detailTarget.businessName}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <TypeBadge type={detailTarget.type} />
                  <StatusBadge status={detailTarget.approvalStatus} />
                </div>
              </div>
              <button onClick={() => setDetailTarget(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <DetailField label="Owner Name" value={detailTarget.ownerName} />
              <DetailField label="Email" value={detailTarget.email} />
              <DetailField label="Phone" value={detailTarget.phone ?? "—"} />
              <DetailField label="Applied On" value={format(new Date(detailTarget.createdAt), "dd MMM yyyy, HH:mm")} />
              <DetailField label="GSTIN" value={detailTarget.gstin ?? "Not provided"} />
              <DetailField label="PAN" value={detailTarget.pan ?? "Not provided"} />
              <div className="col-span-2">
                <DetailField label="Address / Pickup" value={detailTarget.address || "Not provided"} />
              </div>
              {detailTarget.rejectedReason && (
                <div className="col-span-2 rounded-lg bg-red-50 border border-red-100 p-3 text-xs text-red-700">
                  <strong>Rejection reason:</strong> {detailTarget.rejectedReason}
                </div>
              )}
              {detailTarget.verifiedAt && (
                <div className="col-span-2 rounded-lg bg-green-50 border border-green-100 p-3 text-xs text-green-700">
                  <strong>Verified on:</strong> {format(new Date(detailTarget.verifiedAt), "dd MMM yyyy, HH:mm")}
                </div>
              )}
            </div>

            {detailTarget.approvalStatus === "PENDING" && (
              <div className="flex gap-3 mt-5 pt-4 border-t border-border">
                <button
                  onClick={() => { setDetailTarget(null); openRejectModal(detailTarget); }}
                  className="flex-1 rounded-xl border border-red-200 text-red-600 px-4 py-2.5 text-sm hover:bg-red-50 transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => { setDetailTarget(null); handleApprove(detailTarget); }}
                  disabled={isPending}
                  className="flex-1 rounded-xl bg-green-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  Approve
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function RequestRow({
  row,
  isPending,
  onApprove,
  onReject,
  onViewDetail,
}: {
  row: VendorRequestRow;
  isPending: boolean;
  onApprove: () => void;
  onReject: () => void;
  onViewDetail: () => void;
}) {
  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <button
          onClick={onViewDetail}
          className="text-left group"
        >
          <div className="font-medium text-foreground group-hover:text-accent transition-colors">
            {row.businessName}
          </div>
          <div className="text-xs text-muted-foreground">{row.address || "No address"}</div>
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="text-sm">{row.ownerName}</div>
        <div className="text-xs text-muted-foreground">{row.email}</div>
        {row.phone && <div className="text-xs text-muted-foreground">{row.phone}</div>}
      </td>
      <td className="px-4 py-3">
        <TypeBadge type={row.type} />
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        <div>{row.gstin ? `GST: ${row.gstin}` : "—"}</div>
        <div>{row.pan ? `PAN: ${row.pan}` : ""}</div>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {format(new Date(row.createdAt), "dd MMM yyyy")}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={row.approvalStatus} rejectedReason={row.rejectedReason} />
      </td>
      <td className="px-4 py-3 text-right">
        {row.approvalStatus === "PENDING" && (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onApprove}
              disabled={isPending}
              title="Approve"
              className="flex items-center gap-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 text-xs font-medium hover:bg-green-100 disabled:opacity-50 transition-colors"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Approve
            </button>
            <button
              onClick={onReject}
              disabled={isPending}
              title="Reject"
              className="flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 text-xs font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </button>
          </div>
        )}
        {row.approvalStatus === "APPROVED" && (
          <button
            onClick={onReject}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-border text-muted-foreground px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50 transition-colors ml-auto"
          >
            <XCircle className="h-3.5 w-3.5" />
            Revoke
          </button>
        )}
        {row.approvalStatus === "REJECTED" && (
          <button
            onClick={onApprove}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-green-200 text-green-700 px-3 py-1.5 text-xs hover:bg-green-50 disabled:opacity-50 transition-colors ml-auto"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Re-approve
          </button>
        )}
      </td>
    </tr>
  );
}

function StatusBadge({
  status,
  rejectedReason,
}: {
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectedReason?: string | null;
}) {
  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs text-amber-700">
        <Clock className="h-3 w-3" />
        Pending
      </span>
    );
  }
  if (status === "APPROVED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs text-green-700">
        <CheckCircle className="h-3 w-3" />
        Approved
      </span>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-xs text-red-700">
        <XCircle className="h-3 w-3" />
        Rejected
      </span>
      {rejectedReason && (
        <span
          title={rejectedReason}
          className="text-[10px] text-muted-foreground max-w-[140px] truncate"
        >
          {rejectedReason}
        </span>
      )}
    </div>
  );
}

function TypeBadge({ type }: { type: "SELLER" | "B2B_VENDOR" }) {
  if (type === "SELLER") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-xs text-orange-700">
        <Store className="h-3 w-3" />
        Seller
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs text-blue-700">
      <Building2 className="h-3 w-3" />
      B2B
    </span>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

// Keep ChevronDown in imports to avoid unused warning — used implicitly via future expand features
const _unused = ChevronDown;
void _unused;
