"use client";

import React, { useState, useTransition } from "react";
import { requestReturn } from "@/actions/returns";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

interface ReturnDialogProps {
  orderId: string;
  orderNumber: string;
  deliveryDate: Date;
  alreadyRequested: boolean;
  reasons?: string[];
}

export default function ReturnDialog({
  orderId,
  orderNumber,
  deliveryDate,
  alreadyRequested,
  reasons = [],
}: ReturnDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate return window (7 days)
  const delDate = new Date(deliveryDate);
  const diffTime = Math.abs(Date.now() - delDate.getTime());
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  const isExpired = diffDays > 7;

  if (alreadyRequested) {
    return (
      <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800">
        Return Requested
      </span>
    );
  }

  if (isExpired) {
    return null; // Return window expired
  }

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("Please enter a reason for the return.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to request a return/refund for order #${orderNumber}?`
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const res = await requestReturn(orderId, reason, description);
      if (res.success) {
        toast.success("Return request successfully submitted!");
        setIsOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || "Failed to request return.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center rounded border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition cursor-pointer"
      >
        <RefreshCw className="mr-1 h-3.5 w-3.5" /> Request Return
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg text-left">
            <h2 className="font-display text-xl mb-1">Request Return / Refund</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Submit a return request for Order #{orderNumber}. Our team will review the request and get back to you shortly.
            </p>

            <form onSubmit={handleReturnSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Reason for Return</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded border border-input bg-background p-2.5 text-sm outline-none text-foreground"
                  required
                >
                  <option value="">-- Select Reason --</option>
                  {reasons.length > 0 ? (
                    reasons.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))
                  ) : (
                    <>
                      <option value="Size mismatch / Incorrect fit">Size mismatch / Incorrect fit</option>
                      <option value="Item damaged or defective">Item damaged or defective</option>
                      <option value="Incorrect product shipped">Incorrect product shipped</option>
                      <option value="Quality not as expected">Quality not as expected</option>
                      <option value="Changed my mind">Changed my mind</option>
                    </>
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Additional Details (Optional)</label>
                <textarea
                  placeholder="Describe the issue in detail. Add notes on condition, size, etc..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full min-h-[80px] rounded border border-input bg-background p-2.5 text-sm outline-none text-foreground"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
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
                      Submitting...
                    </>
                  ) : (
                    "Submit Request"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
