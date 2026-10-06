"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { Star, MessageSquare, CornerDownRight, X, Send } from "lucide-react";
import { toast } from "sonner";
import { sellerReplyToReview } from "@/actions/reviews";
import { SmartImage } from "@/components/site/smart-image";

export default function SellerReviewsClient({ initialReviews }: { initialReviews: any[] }) {
  const [reviews, setReviews] = useState(initialReviews);
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleOpenReply = (review: any) => {
    setActiveReplyId(review.id);
    setReplyText(review.sellerReply || "");
  };

  const handleCloseReply = () => {
    setActiveReplyId(null);
    setReplyText("");
  };

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeReplyId) return;

    setSubmitting(true);
    try {
      const res = await sellerReplyToReview(activeReplyId, replyText);
      if (res.success) {
        toast.success("Response submitted successfully!");
        setReviews(
          reviews.map((r) =>
            r.id === activeReplyId ? { ...r, sellerReply: replyText.trim() } : r
          )
        );
        handleCloseReply();
      } else {
        toast.error(res.error || "Failed to submit response.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-stone-900">Product Reviews</h1>
        <p className="text-sm text-stone-500 mt-1">
          Monitor and respond to customer reviews submitted for your products.
        </p>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-200 bg-white p-12 text-center text-stone-500">
          <Star className="mx-auto h-8 w-8 text-stone-300 mb-3" />
          <h3 className="font-medium text-stone-800 text-sm">No reviews yet</h3>
          <p className="text-xs text-stone-400 mt-1">Reviews left on your products will be displayed here.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Product Name */}
                <div>
                  <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider">Product</div>
                  <div className="font-medium text-stone-900 text-sm">{r.product.name}</div>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-2">
                  <div className="flex text-emerald-600">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4 w-4 ${i < r.rating ? "fill-current" : "opacity-30"}`}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-stone-500">{r.rating}/5</span>
                </div>
              </div>

              {/* Review Text */}
              <div className="border-t border-stone-100 pt-4 space-y-2">
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <span className="font-bold text-stone-800">{r.user.name}</span>
                  <span>•</span>
                  <span>{new Date(r.createdAt).toLocaleDateString("en-IN")}</span>
                  {r.isVerifiedPurchase && (
                    <span className="ml-2 bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold text-[9px] border border-emerald-200 uppercase tracking-wider">
                      Verified Purchase
                    </span>
                  )}
                  {r.isHidden && (
                    <span className="ml-2 bg-red-50 text-red-700 px-1.5 py-0.5 rounded-full font-bold text-[9px] border border-red-200 uppercase tracking-wider">
                      Hidden by Admin
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-bold text-stone-800">{r.title}</h4>
                <p className="text-sm text-stone-600 whitespace-pre-line leading-relaxed">{r.comment}</p>

                {/* Review Images */}
                {r.images && r.images.length > 0 && (
                  <div className="flex gap-2 pt-2">
                    {r.images.map((img: any) => (
                      <div key={img.id} className="h-16 w-16 overflow-hidden rounded border border-stone-200 bg-stone-50 relative">
                        <SmartImage src={img.imageUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Response Block */}
              {r.sellerReply ? (
                <div className="bg-stone-50 rounded-lg p-4 flex gap-3 border-l-2 border-stone-300">
                  <CornerDownRight className="h-4 w-4 text-stone-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">My Response</div>
                    <p className="text-xs text-stone-600 whitespace-pre-line leading-relaxed">{r.sellerReply}</p>
                    <button
                      onClick={() => handleOpenReply(r)}
                      className="text-[10px] text-stone-500 font-bold hover:text-stone-900 pt-1 block underline"
                    >
                      Edit Response
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pt-2">
                  <button
                    onClick={() => handleOpenReply(r)}
                    className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-900 border border-stone-200 hover:border-stone-400 rounded-lg px-3 py-1.5 transition"
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> Reply to Review
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reply Modal */}
      {activeReplyId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-xl relative">
            <button
              onClick={handleCloseReply}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-600"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="font-display text-xl text-stone-950 mb-4">
              {reviews.find((r) => r.id === activeReplyId)?.sellerReply ? "Edit Response" : "Respond to Customer Review"}
            </h3>

            <form onSubmit={handleSubmitReply} className="space-y-4">
              <div className="text-xs text-stone-500 bg-stone-50 rounded p-3 border border-stone-100 italic">
                &ldquo;{reviews.find((r) => r.id === activeReplyId)?.comment}&rdquo;
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1">
                  Your Response
                </label>
                <textarea
                  required
                  value={replyText}
                  onChange={(e) => setModifyReply(e.target.value)}
                  placeholder="Thank the customer, clarify details, or offer solutions..."
                  rows={4}
                  className="w-full rounded-lg border border-stone-200 p-3 text-xs outline-none bg-stone-50 focus:border-stone-900 focus:bg-white"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={handleCloseReply}
                  className="rounded-lg border border-stone-200 px-4 py-2 text-xs font-medium hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 text-white px-4 py-2 text-xs font-medium hover:opacity-90 transition disabled:opacity-50"
                >
                  <Send className="h-3 w-3" /> {submitting ? "Sending..." : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  // Quick helper to avoid compiler issues if editing
  function setModifyReply(val: string) {
    setReplyText(val);
  }
}
