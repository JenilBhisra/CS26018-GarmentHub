"use client";

import { useState, useTransition } from "react";
import { respondToRFQ } from "@/actions/b2b";
import { Send, CheckCircle2, AlertCircle } from "lucide-react";

type QuoteFormProps = {
  rfqId: string;
  defaultPrice: number;
  defaultMOQ: number;
};

export function QuoteForm({ rfqId, defaultPrice, defaultMOQ }: QuoteFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [price, setPrice] = useState<number>(defaultPrice);
  const [moq, setMoq] = useState<number>(defaultMOQ);
  const [leadTime, setLeadTime] = useState<string>("5 business days");
  const [validityDate, setValidityDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validations
    if (price <= 0) {
      setError("Offered price must be greater than 0.");
      return;
    }
    if (moq <= 0) {
      setError("MOQ must be greater than 0.");
      return;
    }
    if (!leadTime.trim()) {
      setError("Lead time is required.");
      return;
    }
    if (!validityDate) {
      setError("Quote validity date is required.");
      return;
    }

    const valDate = new Date(validityDate);
    if (valDate <= new Date()) {
      setError("Validity date must be a future date.");
      return;
    }

    startTransition(async () => {
      const res = await respondToRFQ(rfqId, price, moq, leadTime, validityDate, notes);
      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setIsOpen(false);
          // Reset form fields
          setNotes("");
          setValidityDate("");
        }, 2000);
      } else {
        setError(res.error || "Failed to submit quote.");
      }
    });
  };

  return (
    <div className="mt-4 pt-4 border-t border-stone-150">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="h-9 px-4 rounded-lg bg-stone-900 hover:bg-stone-850 text-white text-xs font-semibold transition-colors"
        >
          Submit Price Quotation
        </button>
      ) : (
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-4 animate-fadeIn">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold text-stone-900 uppercase">New Quotation Offer</h4>
            <button
              onClick={() => {
                setIsOpen(false);
                setError(null);
              }}
              className="text-stone-400 hover:text-stone-700 text-xs font-semibold"
            >
              Cancel
            </button>
          </div>

          {success ? (
            <div className="flex items-center gap-2 text-emerald-600 text-xs p-3 bg-emerald-50 rounded-lg border border-emerald-100 font-semibold">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Quotation sent successfully! Reloading dashboard...</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {error && (
                <div className="flex items-start gap-1.5 p-3 rounded-lg bg-red-50 border border-red-200 text-[11px] text-red-800 font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-650" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-stone-500 uppercase">Unit Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    className="w-full h-8 border border-stone-300 rounded px-2 text-xs focus:outline-none focus:border-stone-900 bg-white"
                    value={price}
                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-stone-500 uppercase">Min Order (MOQ) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="w-full h-8 border border-stone-300 rounded px-2 text-xs focus:outline-none focus:border-stone-900 bg-white"
                    value={moq}
                    onChange={(e) => setMoq(parseInt(e.target.value, 10) || 1)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-stone-500 uppercase">Lead Time *</label>
                  <input
                    type="text"
                    required
                    className="w-full h-8 border border-stone-300 rounded px-2 text-xs focus:outline-none focus:border-stone-900 bg-white"
                    placeholder="e.g. 7 days"
                    value={leadTime}
                    onChange={(e) => setLeadTime(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-stone-500 uppercase">Valid Until *</label>
                  <input
                    type="date"
                    required
                    className="w-full h-8 border border-stone-300 rounded px-2 text-[11px] focus:outline-none focus:border-stone-900 bg-white"
                    value={validityDate}
                    onChange={(e) => setValidityDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-stone-500 uppercase">Notes / Terms</label>
                <textarea
                  rows={2}
                  className="w-full border border-stone-300 rounded p-2 text-xs focus:outline-none focus:border-stone-900 bg-white"
                  placeholder="e.g. Price includes shipping, custom tags available..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isPending}
                  className="h-8 bg-stone-950 text-white rounded px-4 text-xs font-semibold hover:bg-stone-850 transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <Send className="h-3 w-3" />
                  {isPending ? "Submitting..." : "Send Quote"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
