"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Clock, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

import { sellerCreatePromotion } from "@/actions/promotions";
import type { PromotionStatus, ApprovalStatus } from "@prisma/client";

interface Product { id: string; name: string }
interface Category { id: string; name: string; slug: string }

interface Promotion {
  id: string;
  name: string;
  description: string | null;
  type: string;
  discountType: string;
  discountValue: number;
  status: PromotionStatus;
  approvalStatus: ApprovalStatus;
  rejectionReason: string | null;
  startDate: Date | string;
  endDate: Date | string;
  categoryId: string | null;
  category: { name: string } | null;
  products: { product: { id: string; name: string } }[];
  createdAt: Date | string;
}

interface Props {
  promotions: Promotion[];
  products: Product[];
  categories: Category[];
}

const APPROVAL_BADGES: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING: { label: "Pending Approval", color: "text-warning bg-warning/10", icon: <Clock className="h-3.5 w-3.5" /> },
  APPROVED: { label: "Approved", color: "text-success bg-success/10", icon: <CheckCircle className="h-3.5 w-3.5" /> },
  REJECTED: { label: "Rejected", color: "text-destructive bg-destructive/10", icon: <XCircle className="h-3.5 w-3.5" /> },
};

const STATUS_BADGES: Record<string, string> = {
  DRAFT: "text-muted-foreground bg-muted",
  ACTIVE: "text-success bg-success/10",
  SCHEDULED: "text-accent bg-accent/10",
  EXPIRED: "text-muted-foreground bg-muted",
  INACTIVE: "text-muted-foreground bg-muted",
};

export default function PromotionsClient({ promotions: initialPromotions, products, categories }: Props) {
  const [promotions] = useState(initialPromotions);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "PRODUCT_DISCOUNT",
    discountType: "PERCENTAGE",
    discountValue: "",
    startDate: "",
    endDate: "",
    categoryId: "",
    productIds: [] as string[],
  });

  const toggleProduct = (id: string) => {
    setForm((f) => ({
      ...f,
      productIds: f.productIds.includes(id) ? f.productIds.filter((p) => p !== id) : [...f.productIds, id],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Promotion name is required."); return; }
    if (!form.discountValue || isNaN(Number(form.discountValue)) || Number(form.discountValue) <= 0) {
      toast.error("Enter a valid discount value."); return;
    }
    if (!form.startDate || !form.endDate) { toast.error("Start and end dates are required."); return; }
    if (form.type === "PRODUCT_DISCOUNT" && form.productIds.length === 0) {
      toast.error("Select at least one product for a Product Discount."); return;
    }
    if (form.type === "CATEGORY_DISCOUNT" && !form.categoryId) {
      toast.error("Select a category for a Category Discount."); return;
    }

    startTransition(async () => {
      const res = await sellerCreatePromotion({
        name: form.name,
        description: form.description || undefined,
        type: form.type as "PRODUCT_DISCOUNT" | "CATEGORY_DISCOUNT",
        discountType: form.discountType as "PERCENTAGE" | "FIXED_AMOUNT",
        discountValue: Number(form.discountValue),
        startDate: form.startDate,
        endDate: form.endDate,
        categoryId: form.categoryId || undefined,
        productIds: form.productIds,
      });

      if (res.success) {
        toast.success("Promotion submitted for admin approval!");
        setShowForm(false);
        setForm({ name: "", description: "", type: "PRODUCT_DISCOUNT", discountType: "PERCENTAGE", discountValue: "", startDate: "", endDate: "", categoryId: "", productIds: [] });
        // Refresh
        window.location.reload();
      } else {
        toast.error(res.error || "Failed to create promotion.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-foreground">My Promotions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seller-created promotions require admin approval before going live.
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

      {/* Create Promotion Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-medium text-foreground">New Promotion</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">Promotion Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Summer Sale 2025" className="input-field mt-1 w-full" required />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value, productIds: [], categoryId: "" })}
                className="input-field mt-1 w-full">
                <option value="PRODUCT_DISCOUNT">Product Discount</option>
                <option value="CATEGORY_DISCOUNT">Category Discount</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Description (optional)</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2} placeholder="Brief description..." className="input-field mt-1 w-full resize-none" />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs text-muted-foreground">Discount Type</label>
              <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                className="input-field mt-1 w-full">
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED_AMOUNT">Fixed Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Discount Value *</label>
              <input value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                type="number" min="0.01" step="0.01" placeholder={form.discountType === "PERCENTAGE" ? "e.g. 20" : "e.g. 100"}
                className="input-field mt-1 w-full" required />
            </div>
            <div className="sm:col-span-1" />
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

          {/* Product/Category selector */}
          {form.type === "PRODUCT_DISCOUNT" && (
            <div>
              <label className="text-xs text-muted-foreground">Select Products *</label>
              <div className="mt-2 grid max-h-48 overflow-y-auto gap-1.5 rounded-md border border-border p-2 bg-muted/30">
                {products.length === 0 && <p className="text-xs text-muted-foreground p-2">No active products found.</p>}
                {products.map((p) => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted text-sm">
                    <input type="checkbox" checked={form.productIds.includes(p.id)} onChange={() => toggleProduct(p.id)}
                      className="accent-accent" />
                    <span className="text-foreground">{p.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {form.type === "CATEGORY_DISCOUNT" && (
            <div>
              <label className="text-xs text-muted-foreground">Select Category *</label>
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                className="input-field mt-1 w-full">
                <option value="">-- Select a category --</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setShowForm(false)}
              className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted transition">
              Cancel
            </button>
            <button type="submit" disabled={isPending}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 transition disabled:opacity-50">
              {isPending ? "Submitting…" : "Submit for Approval"}
            </button>
          </div>
        </form>
      )}

      {/* Promotions List */}
      <div className="space-y-3">
        {promotions.length === 0 && (
          <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
            No promotions yet. Create your first promotion above.
          </div>
        )}
        {promotions.map((promo) => {
          const approval = APPROVAL_BADGES[promo.approvalStatus] ?? APPROVAL_BADGES.PENDING;
          const statusClass = STATUS_BADGES[promo.status] ?? STATUS_BADGES.DRAFT;
          const expanded = expandedId === promo.id;
          return (
            <div key={promo.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <div
                className="flex cursor-pointer items-center justify-between p-4 hover:bg-muted/30 transition"
                onClick={() => setExpandedId(expanded ? null : promo.id)}
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="font-medium text-foreground">{promo.name}</div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${approval.color}`}>
                      {approval.icon} {approval.label}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 font-medium ${statusClass}`}>
                      {promo.status}
                    </span>
                    <span className="text-muted-foreground">
                      {promo.discountType === "PERCENTAGE" ? `${promo.discountValue}% off` : `₹${promo.discountValue} off`}
                    </span>
                  </div>
                </div>
                {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
              </div>
              {expanded && (
                <div className="border-t border-border p-4 space-y-3 text-sm">
                  {promo.description && <p className="text-muted-foreground">{promo.description}</p>}
                  {promo.approvalStatus === "REJECTED" && promo.rejectionReason && (
                    <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-destructive text-xs">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div><strong>Rejected:</strong> {promo.rejectionReason}</div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><span className="text-muted-foreground">Type:</span> <span className="text-foreground font-medium">{promo.type.replace("_", " ")}</span></div>
                    <div><span className="text-muted-foreground">Discount:</span> <span className="text-foreground font-medium">{promo.discountType === "PERCENTAGE" ? `${promo.discountValue}%` : `₹${promo.discountValue}`}</span></div>
                    <div><span className="text-muted-foreground">Starts:</span> <span className="text-foreground font-medium">{new Date(promo.startDate).toLocaleDateString("en-IN")}</span></div>
                    <div><span className="text-muted-foreground">Ends:</span> <span className="text-foreground font-medium">{new Date(promo.endDate).toLocaleDateString("en-IN")}</span></div>
                    {promo.category && <div><span className="text-muted-foreground">Category:</span> <span className="text-foreground font-medium">{promo.category.name}</span></div>}
                    {promo.products.length > 0 && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Products:</span>{" "}
                        <span className="text-foreground font-medium">{promo.products.map((pp) => pp.product.name).join(", ")}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
