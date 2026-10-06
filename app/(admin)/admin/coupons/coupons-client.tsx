"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp } from "lucide-react";
import { adminCreateCoupon, adminUpdateCouponStatus, adminDeleteCoupon } from "@/actions/promotions";
import type { CouponDiscountType, CouponStatus } from "@prisma/client";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discountType: CouponDiscountType;
  discountValue: number;
  minimumOrderAmount: number;
  maximumDiscount: number | null;
  usageLimit: number | null;
  perUserLimit: number;
  usageCount: number;
  startDate: Date | string;
  endDate: Date | string;
  status: CouponStatus;
  sellerId: string | null;
  seller: { storeName: string } | null;
  categoryId: string | null;
  category: { name: string } | null;
  productId: string | null;
  product: { name: string } | null;
  _count: { usages: number };
}

interface Seller { id: string; storeName: string }
interface Category { id: string; name: string; slug: string }
interface Product { id: string; name: string; seller: { storeName: string } }

interface Props {
  coupons: Coupon[];
  categories: Category[];
  sellers: Seller[];
  products: Product[];
}

const SCOPE_OPTIONS = [
  { value: "SITEWIDE", label: "Sitewide" },
  { value: "SELLER", label: "Seller-specific" },
  { value: "CATEGORY", label: "Category-specific" },
  { value: "PRODUCT", label: "Product-specific" },
];

export default function CouponsClient({ coupons: initialCoupons, categories, sellers, products }: Props) {
  const [coupons, setCoupons] = useState(initialCoupons);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [scope, setScope] = useState("SITEWIDE");

  const [form, setForm] = useState({
    code: "",
    description: "",
    discountType: "PERCENTAGE",
    discountValue: "",
    minimumOrderAmount: "",
    maximumDiscount: "",
    usageLimit: "",
    perUserLimit: "1",
    startDate: "",
    endDate: "",
    sellerId: "",
    categoryId: "",
    productId: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) { toast.error("Coupon code is required."); return; }
    if (!form.discountValue || Number(form.discountValue) <= 0) { toast.error("Enter a valid discount value."); return; }
    if (!form.startDate || !form.endDate) { toast.error("Start and end dates are required."); return; }

    startTransition(async () => {
      const res = await adminCreateCoupon({
        code: form.code.trim().toUpperCase(),
        description: form.description || undefined,
        discountType: form.discountType as CouponDiscountType,
        discountValue: Number(form.discountValue),
        minimumOrderAmount: form.minimumOrderAmount ? Number(form.minimumOrderAmount) : undefined,
        maximumDiscount: form.maximumDiscount ? Number(form.maximumDiscount) : undefined,
        usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
        perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        sellerId: scope === "SELLER" ? form.sellerId || undefined : undefined,
        categoryId: scope === "CATEGORY" ? form.categoryId || undefined : undefined,
        productId: scope === "PRODUCT" ? form.productId || undefined : undefined,
      });

      if (res.success) {
        toast.success("Coupon created!");
        setShowForm(false);
        window.location.reload();
      } else {
        toast.error(res.error || "Failed to create coupon.");
      }
    });
  };

  const handleToggleStatus = (coupon: Coupon) => {
    const newStatus = coupon.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    startTransition(async () => {
      const res = await adminUpdateCouponStatus(coupon.id, newStatus);
      if (res.success) {
        toast.success(`Coupon ${newStatus === "ACTIVE" ? "activated" : "deactivated"}.`);
        setCoupons((prev) => prev.map((c) => c.id === coupon.id ? { ...c, status: newStatus } : c));
      } else {
        toast.error(res.error || "Failed to update status.");
      }
    });
  };

  const handleDelete = (couponId: string) => {
    startTransition(async () => {
      const res = await adminDeleteCoupon(couponId);
      if (res.success) {
        toast.success("Coupon deleted.");
        setCoupons((prev) => prev.filter((c) => c.id !== couponId));
      } else {
        toast.error(res.error || "Failed to delete coupon.");
      }
    });
  };

  const STATUS_BADGE = {
    ACTIVE: "text-success bg-success/10",
    INACTIVE: "text-muted-foreground bg-muted",
    EXPIRED: "text-warning bg-warning/10",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-foreground">Coupons</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create and manage discount coupon codes.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90 transition"
        >
          <Plus className="h-4 w-4" />
          Create Coupon
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">New Coupon Code</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">Code *</label>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="SUMMER25" className="input-field mt-1 w-full font-mono tracking-widest uppercase" required />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Scope</label>
              <select value={scope} onChange={(e) => setScope(e.target.value)} className="input-field mt-1 w-full">
                {SCOPE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
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
              <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}
                className="input-field mt-1 w-full">
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED_AMOUNT">Fixed Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Discount Value *</label>
              <input value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                type="number" min="0.01" step="0.01" placeholder={form.discountType === "PERCENTAGE" ? "e.g. 20" : "e.g. 200"}
                className="input-field mt-1 w-full" required />
            </div>
            {form.discountType === "PERCENTAGE" && (
              <div>
                <label className="text-xs text-muted-foreground">Max Discount (₹)</label>
                <input value={form.maximumDiscount} onChange={(e) => setForm({ ...form, maximumDiscount: e.target.value })}
                  type="number" min="0" placeholder="Cap (optional)" className="input-field mt-1 w-full" />
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs text-muted-foreground">Min Order (₹)</label>
              <input value={form.minimumOrderAmount} onChange={(e) => setForm({ ...form, minimumOrderAmount: e.target.value })}
                type="number" min="0" placeholder="0" className="input-field mt-1 w-full" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Total Usage Limit</label>
              <input value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                type="number" min="1" placeholder="Unlimited" className="input-field mt-1 w-full" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Per User Limit</label>
              <input value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })}
                type="number" min="1" placeholder="1" className="input-field mt-1 w-full" />
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

          {scope === "SELLER" && (
            <div>
              <label className="text-xs text-muted-foreground">Seller</label>
              <select value={form.sellerId} onChange={(e) => setForm({ ...form, sellerId: e.target.value })} className="input-field mt-1 w-full">
                <option value="">-- Select Seller --</option>
                {sellers.map((s) => <option key={s.id} value={s.id}>{s.storeName}</option>)}
              </select>
            </div>
          )}
          {scope === "CATEGORY" && (
            <div>
              <label className="text-xs text-muted-foreground">Category</label>
              <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="input-field mt-1 w-full">
                <option value="">-- Select Category --</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {scope === "PRODUCT" && (
            <div>
              <label className="text-xs text-muted-foreground">Product</label>
              <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className="input-field mt-1 w-full">
                <option value="">-- Select Product --</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.seller.storeName})</option>)}
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
              {isPending ? "Creating…" : "Create Coupon"}
            </button>
          </div>
        </form>
      )}

      {/* Coupons Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Discount</th>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3">Validity</th>
              <th className="px-4 py-3">Used</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {coupons.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  No coupons yet. Create one above.
                </td>
              </tr>
            )}
            {coupons.map((coupon) => {
              const now = new Date();
              const isExpired = new Date(coupon.endDate) < now;
              const effectiveStatus = isExpired ? "EXPIRED" : coupon.status;
              return (
                <tr key={coupon.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-mono font-semibold text-accent">{coupon.code}</div>
                    {coupon.description && <div className="text-xs text-muted-foreground truncate max-w-[160px]">{coupon.description}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {coupon.discountType === "PERCENTAGE"
                      ? <><span className="font-medium text-foreground">{coupon.discountValue}%</span>{coupon.maximumDiscount && <span className="text-xs text-muted-foreground ml-1">up to ₹{coupon.maximumDiscount}</span>}</>
                      : <span className="font-medium text-foreground">₹{coupon.discountValue}</span>
                    }
                    {coupon.minimumOrderAmount > 0 && (
                      <div className="text-xs text-muted-foreground">Min ₹{coupon.minimumOrderAmount}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {coupon.seller ? `Seller: ${coupon.seller.storeName}` :
                     coupon.category ? `Category: ${coupon.category.name}` :
                     coupon.product ? `Product: ${coupon.product.name}` : "Sitewide"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <div>{new Date(coupon.startDate).toLocaleDateString("en-IN")}</div>
                    <div>→ {new Date(coupon.endDate).toLocaleDateString("en-IN")}</div>
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {coupon._count.usages}
                    {coupon.usageLimit && <span className="text-muted-foreground"> / {coupon.usageLimit}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[effectiveStatus] || "text-muted-foreground bg-muted"}`}>
                      {effectiveStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleStatus(coupon)}
                        disabled={isPending || isExpired}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition"
                        title={coupon.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      >
                        {coupon.status === "ACTIVE"
                          ? <ToggleRight className="h-5 w-5 text-success" />
                          : <ToggleLeft className="h-5 w-5" />
                        }
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete coupon "${coupon.code}"?`)) handleDelete(coupon.id);
                        }}
                        disabled={isPending}
                        className="text-muted-foreground hover:text-destructive disabled:opacity-30 transition"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setExpandedId(expandedId === coupon.id ? null : coupon.id)}
                        className="text-muted-foreground hover:text-foreground transition"
                        title="Details"
                      >
                        {expandedId === coupon.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                    {expandedId === coupon.id && (
                      <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                        <div>Per user limit: {coupon.perUserLimit}</div>
                        <div>Times used: {coupon._count.usages}</div>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
