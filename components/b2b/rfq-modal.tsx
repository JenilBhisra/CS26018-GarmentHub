"use client";

import { useState, useTransition } from "react";
import { createRFQ } from "@/actions/b2b";
import { X, Send, CheckCircle2 } from "lucide-react";

type RFQModalProps = {
  productId: string;
  productName: string;
  productImage?: string | null;
  storeName: string;
  moq: number;
  bulkPrice: number;
  isOpen: boolean;
  onClose: () => void;
};

export function RFQModal({
  productId,
  productName,
  productImage,
  storeName,
  moq,
  bulkPrice,
  isOpen,
  onClose,
}: RFQModalProps) {
  const [quantity, setQuantity] = useState<number>(moq || 50);
  const [targetPrice, setTargetPrice] = useState<number>(bulkPrice || 0);
  const [deliveryCity, setDeliveryCity] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Front-end validations
    if (quantity <= 0) {
      setError("Quantity must be greater than 0.");
      return;
    }
    if (targetPrice < 0) {
      setError("Target price must not be negative.");
      return;
    }
    if (!deliveryCity.trim()) {
      setError("Delivery city is required.");
      return;
    }

    startTransition(async () => {
      const res = await createRFQ(productId, quantity, targetPrice, deliveryCity, notes);
      if (res.success) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onClose();
          // Reset form fields
          setDeliveryCity("");
          setNotes("");
        }, 2000);
      } else {
        setError(res.error || "Failed to submit request.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden m-4 animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 px-6 py-4 bg-stone-50">
          <div>
            <h3 className="text-md font-semibold text-stone-900 font-display">Request Wholesale Quote</h3>
            <p className="text-xs text-stone-500">Submit an inquiry to receive a quote proposal from the supplier.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition-all"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Success State */}
        {success ? (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-3 min-h-[300px]">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 animate-bounce">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h4 className="font-semibold text-stone-900 text-lg">Inquiry Submitted Successfully</h4>
            <p className="text-sm text-stone-500 max-w-sm">
              Your Request for Quote has been sent to <strong className="text-stone-850 font-semibold">{storeName}</strong>. You will be notified when they respond.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800 font-medium">
                {error}
              </div>
            )}

            {/* Product Summary */}
            <div className="flex gap-4 p-3 bg-stone-50 rounded-xl border border-stone-100 items-center">
              <div className="w-16 h-16 rounded-lg bg-stone-200 overflow-hidden relative shrink-0">
                {productImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={productImage} className="h-full w-full object-cover" alt="" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-stone-400 text-[10px]">No image</div>
                )}
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">{storeName}</span>
                <h4 className="text-sm font-semibold text-stone-800 leading-tight">{productName}</h4>
                <div className="flex gap-3 text-xs text-stone-500 mt-1 font-mono">
                  <span>MOQ: <strong className="text-stone-700">{moq} pcs</strong></span>
                  <span>Est. Bulk Price: <strong className="text-stone-700">₹{bulkPrice}/pc</strong></span>
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block">Quantity Needed *</label>
                <input
                  type="number"
                  min="1"
                  required
                  className="w-full h-10 border border-stone-300 rounded-lg px-3 text-sm focus:border-stone-900 focus:outline-none"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block">Target Unit Price (₹) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  className="w-full h-10 border border-stone-300 rounded-lg px-3 text-sm focus:border-stone-900 focus:outline-none"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block">Delivery City *</label>
              <input
                type="text"
                required
                className="w-full h-10 border border-stone-300 rounded-lg px-3 text-sm focus:border-stone-900 focus:outline-none"
                placeholder="e.g. Mumbai, New Delhi"
                value={deliveryCity}
                onChange={(e) => setDeliveryCity(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-stone-700 uppercase tracking-wider block">Additional Notes / Custom Specs</label>
              <textarea
                rows={3}
                className="w-full border border-stone-300 rounded-lg p-3 text-sm focus:border-stone-900 focus:outline-none"
                placeholder="Specify size breakups, custom branding requirements, design details, packing requests..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={onClose}
                className="h-10 border border-stone-200 text-stone-600 rounded-lg px-4 text-sm font-semibold hover:bg-stone-50 transition-colors"
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="h-10 bg-stone-950 text-white rounded-lg px-5 text-sm font-semibold hover:bg-stone-850 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {isPending ? (
                  "Submitting..."
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Send RFQ
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
