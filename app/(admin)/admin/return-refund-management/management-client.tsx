"use client";

import React, { useState, useTransition } from "react";
import { Plus, Edit2, Trash2, Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createReturnReasonRule, updateReturnReasonRule, deleteReturnReasonRule, seedReturnReasonRules } from "@/actions/returns";
import type { ReturnReasonCategory, ShippingResponsibility } from "@prisma/client";

interface RuleData {
  id: string;
  name: string;
  description: string;
  responsibility: ReturnReasonCategory;
  originalShippingResponsibility: ShippingResponsibility;
  returnShippingResponsibility: ShippingResponsibility;
  reverseCommission: boolean;
  isActive: boolean;
  createdAt: string;
}

interface Props {
  initialRules: RuleData[];
}

export default function ReturnRefundManagementClient({ initialRules }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [rules, setRules] = useState<RuleData[]>(initialRules);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleData | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [responsibility, setResponsibility] = useState<ReturnReasonCategory>("CUSTOMER_FAULT");
  const [originalShippingResponsibility, setOriginalShippingResponsibility] = useState<ShippingResponsibility>("CUSTOMER");
  const [returnShippingResponsibility, setReturnShippingResponsibility] = useState<ShippingResponsibility>("CUSTOMER");
  const [reverseCommission, setReverseCommission] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  const openAddModal = () => {
    setEditingRule(null);
    setName("");
    setDescription("");
    setResponsibility("CUSTOMER_FAULT");
    setOriginalShippingResponsibility("CUSTOMER");
    setReturnShippingResponsibility("CUSTOMER");
    setReverseCommission(false);
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (rule: RuleData) => {
    setEditingRule(rule);
    setName(rule.name);
    setDescription(rule.description);
    setResponsibility(rule.responsibility);
    setOriginalShippingResponsibility(rule.originalShippingResponsibility);
    setReturnShippingResponsibility(rule.returnShippingResponsibility);
    setReverseCommission(rule.reverseCommission);
    setIsActive(rule.isActive);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Rule name is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        responsibility,
        originalShippingResponsibility,
        returnShippingResponsibility,
        reverseCommission,
        isActive,
      };

      if (editingRule) {
        const res = await updateReturnReasonRule(editingRule.id, payload);
        if (res.success && res.rule) {
          toast.success("Return reason rule updated successfully!");
          setIsModalOpen(false);
          router.refresh();
          // Update local state
          setRules(rules.map(r => r.id === editingRule.id ? {
            ...r,
            ...payload,
            description: payload.description || "",
            isActive: payload.isActive ?? true,
          } as RuleData : r));
        } else {
          toast.error(res.error || "Failed to update rule.");
        }
      } else {
        const res = await createReturnReasonRule(payload);
        if (res.success && res.rule) {
          toast.success("Return reason rule created successfully!");
          setIsModalOpen(false);
          router.refresh();
          // Update local state
          const newRule: RuleData = {
            id: res.rule.id,
            name: res.rule.name,
            description: res.rule.description || "",
            responsibility: res.rule.responsibility,
            originalShippingResponsibility: res.rule.originalShippingResponsibility,
            returnShippingResponsibility: res.rule.returnShippingResponsibility,
            reverseCommission: res.rule.reverseCommission,
            isActive: res.rule.isActive,
            createdAt: res.rule.createdAt.toISOString(),
          };
          setRules([...rules, newRule]);
        } else {
          toast.error(res.error || "Failed to create rule.");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSoftDelete = async (id: string, currentName: string) => {
    const confirmed = window.confirm(`Are you sure you want to deactivate the rule "${currentName}"? It will no longer be visible to customers.`);
    if (!confirmed) return;

    try {
      const res = await deleteReturnReasonRule(id);
      if (res.success) {
        toast.success(`Rule "${currentName}" deactivated successfully.`);
        router.refresh();
        setRules(rules.map(r => r.id === id ? { ...r, isActive: false } : r));
      } else {
        toast.error(res.error || "Failed to deactivate rule.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to deactivate.");
    }
  };

  const handleReactivate = async (rule: RuleData) => {
    try {
      const res = await updateReturnReasonRule(rule.id, {
        name: rule.name,
        description: rule.description || undefined,
        responsibility: rule.responsibility,
        originalShippingResponsibility: rule.originalShippingResponsibility,
        returnShippingResponsibility: rule.returnShippingResponsibility,
        reverseCommission: rule.reverseCommission,
        isActive: true,
      });
      if (res.success) {
        toast.success(`Rule "${rule.name}" reactivated successfully.`);
        router.refresh();
        setRules(rules.map(r => r.id === rule.id ? { ...r, isActive: true } : r));
      } else {
        toast.error(res.error || "Failed to reactivate rule.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to reactivate.");
    }
  };

  const handleResetDefaults = async () => {
    const confirmed = window.confirm("Seed default return reason rules? This will create standard reason mappings if they do not exist.");
    if (!confirmed) return;

    setIsSeeding(true);
    try {
      const res = await seedReturnReasonRules();
      if (res.success) {
        toast.success(`Seeding complete. Created ${res.seededCount} new rules.`);
        router.refresh();
        // Reload page to get updated list
        window.location.reload();
      } else {
        toast.error(res.error || "Seeding failed.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to seed.");
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white border border-stone-200 p-4 rounded-xl shadow-sm">
        <div className="text-sm font-semibold text-stone-600">
          Total Mapped Rules: <span className="font-mono text-stone-900 bg-stone-100 px-2 py-0.5 rounded">{rules.length}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleResetDefaults}
            disabled={isSeeding}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition cursor-pointer disabled:opacity-50"
          >
            {isSeeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Seed Defaults
          </button>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-stone-800 transition cursor-pointer shadow"
          >
            <Plus className="h-4 w-4" /> Add Return Reason
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 font-semibold text-stone-600 uppercase tracking-wider text-[11px]">
                <th className="px-5 py-3">Reason Name</th>
                <th className="px-5 py-3">Responsibility</th>
                <th className="px-5 py-3">Original Ship. Resp.</th>
                <th className="px-5 py-3">Return Ship. Resp.</th>
                <th className="px-5 py-3 text-center">Comm. Action</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-stone-500">
                    No return reason rules found. Click "Seed Defaults" to pre-populate common rules.
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id} className={`hover:bg-stone-50/50 transition-colors ${!rule.isActive ? "opacity-60 bg-stone-50/30" : ""}`}>
                    <td className="px-5 py-4">
                      <div className="font-semibold text-stone-900">{rule.name}</div>
                      {rule.description && (
                        <div className="text-xs text-stone-500 mt-0.5 line-clamp-1 max-w-xs">{rule.description}</div>
                      )}
                    </td>
                    <td className="px-5 py-4 font-medium">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        rule.responsibility === "SELLER_FAULT"
                          ? "bg-rose-50 text-rose-700 border border-rose-100"
                          : rule.responsibility === "CUSTOMER_FAULT"
                          ? "bg-amber-50 text-amber-700 border border-amber-100"
                          : "bg-blue-50 text-blue-700 border border-blue-100"
                      }`}>
                        {rule.responsibility === "SELLER_FAULT" && "Seller Pays"}
                        {rule.responsibility === "CUSTOMER_FAULT" && "Customer Pays"}
                        {rule.responsibility === "PLATFORM_FAULT" && "Platform Pays"}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-stone-600 font-semibold">{rule.originalShippingResponsibility}</td>
                    <td className="px-5 py-4 font-mono text-xs text-stone-600 font-semibold">{rule.returnShippingResponsibility}</td>
                    <td className="px-5 py-4 text-center">
                      <span className={`text-xs font-semibold ${rule.reverseCommission ? "text-emerald-600" : "text-stone-500"}`}>
                        {rule.reverseCommission ? "Reverses" : "Remains"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        rule.isActive
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          : "bg-stone-100 text-stone-600 border border-stone-200"
                      }`}>
                        {rule.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => openEditModal(rule)}
                          className="p-1 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded transition cursor-pointer"
                          title="Edit rule"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        {rule.isActive ? (
                          <button
                            onClick={() => handleSoftDelete(rule.id, rule.name)}
                            className="p-1 text-rose-500 hover:text-rose-900 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="Deactivate rule"
                          >
                            <EyeOff className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(rule)}
                            className="p-1 text-emerald-500 hover:text-emerald-900 hover:bg-emerald-50 rounded transition cursor-pointer"
                            title="Reactivate rule"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg space-y-4 text-left">
            <div>
              <h2 className="font-display text-xl mb-1">{editingRule ? "Edit Return Reason Rule" : "Add Return Reason Rule"}</h2>
              <p className="text-xs text-muted-foreground">
                Set responsibility and shipping charge mapping for return reasons.
              </p>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Reason Name / Trigger</label>
                <input
                  type="text"
                  placeholder="e.g. Damaged product, Item defective..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded border border-input bg-background p-2.5 text-sm outline-none text-foreground font-medium"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Description (Optional)</label>
                <textarea
                  placeholder="Describe when this rule applies..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full min-h-[70px] rounded border border-input bg-background p-2.5 text-sm outline-none text-foreground"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Product Refund Responsibility</label>
                  <select
                    value={responsibility}
                    onChange={(e) => setResponsibility(e.target.value as ReturnReasonCategory)}
                    className="w-full rounded border border-input bg-background p-2.5 text-sm outline-none text-foreground font-semibold"
                  >
                    <option value="SELLER_FAULT">Seller Fault (Seller pays)</option>
                    <option value="CUSTOMER_FAULT">Customer Fault (Customer pays)</option>
                    <option value="PLATFORM_FAULT">Platform Fault (Platform pays)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Commission Action</label>
                  <select
                    value={reverseCommission ? "true" : "false"}
                    onChange={(e) => setReverseCommission(e.target.value === "true")}
                    className="w-full rounded border border-input bg-background p-2.5 text-sm outline-none text-foreground font-semibold"
                  >
                    <option value="false">Remains Unchanged</option>
                    <option value="true">Reverses Commission</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Original Shipping Paid By</label>
                  <select
                    value={originalShippingResponsibility}
                    onChange={(e) => setOriginalShippingResponsibility(e.target.value as ShippingResponsibility)}
                    className="w-full rounded border border-input bg-background p-2.5 text-sm outline-none text-foreground font-semibold"
                  >
                    <option value="SELLER">Seller</option>
                    <option value="CUSTOMER">Customer</option>
                    <option value="PLATFORM">Platform</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Return Shipping Paid By</label>
                  <select
                    value={returnShippingResponsibility}
                    onChange={(e) => setReturnShippingResponsibility(e.target.value as ShippingResponsibility)}
                    className="w-full rounded border border-input bg-background p-2.5 text-sm outline-none text-foreground font-semibold"
                  >
                    <option value="SELLER">Seller</option>
                    <option value="CUSTOMER">Customer</option>
                    <option value="PLATFORM">Platform</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActiveCheck"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-input text-stone-900 focus:ring-stone-900 h-4.5 w-4.5 cursor-pointer"
                />
                <label htmlFor="isActiveCheck" className="text-xs font-semibold text-stone-850 cursor-pointer select-none">
                  Active (Rules only trigger if active)
                </label>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="rounded px-4 py-2.5 text-xs border border-border hover:bg-muted cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded bg-stone-900 text-white px-4 py-2.5 text-xs font-semibold hover:bg-stone-800 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Rule"
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
