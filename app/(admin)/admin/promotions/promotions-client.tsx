"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { adminModeratePromotion, adminCreatePromotion } from "@/actions/promotions";
import type { ApprovalStatus, PromotionStatus, PromotionType, CouponDiscountType } from "@prisma/client";

interface Promotion {
  id: string;
  name: string;
  description: string | null;
  type: PromotionType;
  discountType: CouponDiscountType;
  discountValue: number;
  status: PromotionStatus;
  approvalStatus: ApprovalStatus;
  rejectionReason: string | null;
  startDate: Date | string;
  endDate: Date | string;
  sellerId: string | null;
  createdByAdmin: boolean;
  seller: { storeName: string } | null;
  category: { name: string } | null;
  products: { product: { name: string } }[];
}

interface Seller { id: string; storeName: string }
interface Category { id: string; name: string; slug: string }

interface Props {
  promotions: Promotion[];
  categories: Category[];
  sellers: Seller[];
}

const APPROVAL_BADGES = {
  PENDING: { label: "Pending", color: "text-warning bg-warning/10", icon: <Clock className="h-3.5 w-3.5" /> },
  APPROVED: { label: "Approved", color: "text-success bg-success/10", icon: <CheckCircle className="h-3.5 w-3.5" /> },
  REJECTED: { label: "Rejected", color: "text-destructive bg-destructive/10", icon: <XCircle className="h-3.5 w-3.5" /> },
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "text-muted-foreground bg-muted",
  ACTIVE: "text-success bg-success/10",
  SCHEDULED: "text-accent bg-accent/10",
  EXPIRED: "text-muted-foreground bg-muted",
  INACTIVE: "text-muted-foreground bg-muted",
};

export default function AdminPromotionsClient({ promotions: initialPromotions, categories, sellers }: Props) {
  const [promotions, setPromotions] = useState(initialPromotions);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"ALL" | "PENDING_REVIEW">("PENDING_REVIEW");

  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "SITEWIDE",
    discountType: "PERCENTAGE",
    discountValue: "",
    startDate: "",
    endDate: "",
    sellerId: "",
    categoryId: "",
    productIds: [] as string[],
  });

  const handleApprove = (id: string) => {
    startTransition(async () => {
      const res = await adminModeratePromotion(id, "APPROVED");
      if (res.success) {
        toast.success("Promotion approved!");
        setPromotions((prev) =>
          prev.map((p) => p.id === id ? { ...p, approvalStatus: "APPROVED", status: "ACTIVE" } : p)
        );
      } else {
        toast.error(res.error || "Failed to approve.");
      }
    });
  };

  const handleReject = (id: string) => {
    if (!rejectReason.trim()) { toast.error("Provide a rejection reason."); return; }
    startTransition(async () => {
      const res = await adminModeratePromotion(id, "REJECTED", rejectReason);
      if (res.success) {
        toast.success("Promotion rejected.");
        setPromotions((prev) =>
          prev.map((p) => p.id === id ? { ...p, approvalStatus: "REJECTED", status: "INACTIVE", rejectionReason: rejectReason } : p)
        );
        setRejectingId(null);
        setRejectReason("");
      } else {
        toast.error(res.error || "Failed to reject.");
      }
    });
  };

  const handleCreatePromotion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Promotion name is required."); return; }
    if (!form.discountValue || Number(form.discountValue) <= 0) { toast.error("Enter a valid discount value."); return; }
    if (!form.startDate || !form.endDate) { toast.error("Start and end dates are required."); return; }

    startTransition(async () => {
      const res = await adminCreatePromotion({
        name: form.name,
        description: form.description || undefined,
        type: form.type as PromotionType,
        discountType: form.discountType as CouponDiscountType,
        discountValue: Number(form.discountValue),
        startDate: form.startDate,
        endDate: form.endDate,
        sellerId: form.sellerId || undefined,
        categoryId: form.categoryId || undefined,
        productIds: form.productIds.length > 0 ? form.productIds : undefined,
      });

      if (res.success) {
        toast.success("Promotion created and activated!");
        setShowForm(false);
        window.location.reload();
      } else {
        toast.error(res.error || "Failed to create promotion.");
      }
    });
  };

  const pendingReview = promotions.filter((p) => !p.createdByAdmin && p.approvalStatus === "PENDING");
  const displayedPromotions = activeTab === "PENDING_REVIEW" ? pendingReview : promotions;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-foreground">Promotions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage automatic price promotions. Approve or reject seller-submitted promotions.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90 transition"
        >
          <Plus className="h-4 w-4" />
          Create Promotion
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreatePromotion} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">New Admin Promotion (Auto-Approved)</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="End of Season Sale" className="input-field mt-1 w-full" required />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input-field mt-1 w-full">
                <option value="SITEWIDE">Sitewide</option>
                <option value="CATEGORY_DISCOUNT">Category Discount</option>
                <option value="SELLER_SPECIFIC">Seller-Specific</option>
                <option value="PRODUCT_DISCOUNT">Product Discount</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Description (optional)</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description..." className="input-field mt-1 w-full" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs text-muted-foreground">Discount Type</label>
              <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })} className="input-field mt-1 w-full">
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED_AMOUNT">Fixed Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Value *</label>
              <input value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                type="number" min="0.01" step="0.01" placeholder="e.g. 15" className="input-field mt-1 w-full" required />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">Start Date *</label>
              <input value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                type="datetime-local" className="input-field mt-1 w-full" required />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">End Date *</label>
              <input value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                type="datetime-local" className="input-field mt-1 w-full" required />
            </div>
          </div>
          {form.type === "SELLER_SPECIFIC" && (
            <div>
              <label className="text-xs text-muted-foreground">Seller</label>
              <select value={form.sellerId} onChange={(e) => setForm({ ...form, sellerId: e.target.value })} className="input-field mt-1 w-full">
                <option value="">-- Select Seller --</option>
                {sellers.map((s) => <option key={s.id} value={s.id}>{s.storeName}</option>)}
              </select>
            </div>
          )}
          {form.type === "CATEGORY_DISCOUNT" && (
            <div>
              <label className="text-xs text-muted-foreground">Category</label>
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="input-field mt-1 w-full">
                <option value="">-- Select Category --</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted transition">Cancel</button>
            <button type="submit" disabled={isPending} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 transition disabled:opacity-50">
              {isPending ? "Creating…" : "Create & Activate"}
            </button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {(["PENDING_REVIEW", "ALL"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${activeTab === tab ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {tab === "PENDING_REVIEW"
              ? `Pending Review${pendingReview.length > 0 ? ` (${pendingReview.length})` : ""}`
              : "All Promotions"
            }
          </button>
        ))}
      </div>

      {/* Promotions List */}
      <div className="space-y-3">
        {displayedPromotions.length === 0 && (
          <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            {activeTab === "PENDING_REVIEW" ? "No promotions pending review." : "No promotions created yet."}
          </div>
        )}
        {displayedPromotions.map((promo) => {
          const approval = APPROVAL_BADGES[promo.approvalStatus] ?? APPROVAL_BADGES.PENDING;
          const statusClass = STATUS_BADGE[promo.status] ?? STATUS_BADGE.DRAFT;
          const expanded = expandedId === promo.id;
          return (
            <div key={promo.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <div
                className="flex cursor-pointer items-center justify-between p-4 hover:bg-muted/30 transition"
                onClick={() => setExpandedId(expanded ? null : promo.id)}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-foreground">{promo.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    {!promo.createdByAdmin && promo.seller && (
                      <span className="text-muted-foreground">by {promo.seller.storeName}</span>
                    )}
                    {promo.createdByAdmin && (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 font-medium text-accent">Admin</span>
                    )}
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${approval.color}`}>
                      {approval.icon} {approval.label}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 font-medium ${statusClass}`}>{promo.status}</span>
                    <span className="text-muted-foreground">
                      {promo.discountType === "PERCENTAGE" ? `${promo.discountValue}% off` : `₹${promo.discountValue} off`}
                    </span>
                  </div>
                </div>
                {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
              </div>

              {expanded && (
                <div className="border-t border-border p-4 space-y-4 text-sm">
                  {promo.description && <p className="text-muted-foreground">{promo.description}</p>}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><span className="text-muted-foreground">Type:</span> <span className="font-medium text-foreground">{promo.type}</span></div>
                    <div><span className="text-muted-foreground">Dates:</span> <span className="font-medium text-foreground">{new Date(promo.startDate).toLocaleDateString("en-IN")} → {new Date(promo.endDate).toLocaleDateString("en-IN")}</span></div>
                    {promo.category && <div><span className="text-muted-foreground">Category:</span> <span className="font-medium text-foreground">{promo.category.name}</span></div>}
                    {promo.products.length > 0 && (
                      <div className="col-span-2"><span className="text-muted-foreground">Products:</span> <span className="font-medium text-foreground">{promo.products.map((pp) => pp.product.name).join(", ")}</span></div>
                    )}
                  </div>
                  {promo.rejectionReason && (
                    <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-destructive text-xs">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div><strong>Rejection Reason:</strong> {promo.rejectionReason}</div>
                    </div>
                  )}
                  {promo.approvalStatus === "PENDING" && !promo.createdByAdmin && (
                    <div className="space-y-2">
                      {rejectingId === promo.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Reason for rejection..."
                            rows={3}
                            className="input-field w-full resize-none text-xs"
                          />
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => { setRejectingId(null); setRejectReason(""); }}
                              className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted transition">
                              Cancel
                            </button>
                            <button onClick={() => handleReject(promo.id)} disabled={isPending}
                              className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition disabled:opacity-50">
                              Confirm Reject
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setRejectingId(promo.id)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 transition">
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </button>
                          <button onClick={() => handleApprove(promo.id)} disabled={isPending}
                            className="inline-flex items-center gap-1.5 rounded-md bg-success px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition disabled:opacity-50">
                            <CheckCircle className="h-3.5 w-3.5" /> Approve
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
