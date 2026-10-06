"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { Star, EyeOff, Eye, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { moderateReview } from "@/actions/reviews";
import { SmartImage } from "@/components/site/smart-image";

export default function AdminReviewsClient({ initialReviews }: { initialReviews: any[] }) {
  const [reviews, setReviews] = useState(initialReviews);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const paginatedReviews = reviews.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(reviews.length / pageSize);

  const handleToggleHide = async (reviewId: string, currentHidden: boolean) => {
    setProcessingId(reviewId);
    try {
      const res = await moderateReview(reviewId, !currentHidden);
      if (res.success) {
        toast.success(!currentHidden ? "Review hidden from catalog" : "Review marked visible");
        setReviews(
          reviews.map((r) =>
            r.id === reviewId ? { ...r, isHidden: !currentHidden } : r
          )
        );
      } else {
        toast.error(res.error || "Failed to update review status.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-stone-900">Reviews Moderation</h1>
        <p className="text-sm text-stone-500 mt-1">
          Monitor customer reviews and hide inappropriate comments or ratings.
        </p>
      </div>

      {reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-200 bg-white p-12 text-center text-stone-500">
          <Star className="mx-auto h-8 w-8 text-stone-300 mb-3" />
          <h3 className="font-medium text-stone-800 text-sm">No reviews found</h3>
          <p className="text-xs text-stone-400 mt-1">Product reviews posted on the platform will appear here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-left text-sm text-stone-600">
            <thead className="bg-stone-50 text-xs font-semibold uppercase tracking-wider text-stone-500">
              <tr>
                <th className="px-6 py-4">Product / Seller</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Rating</th>
                <th className="px-6 py-4">Review Content</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 border-t border-stone-100">
              {paginatedReviews.map((r) => (
                <tr key={r.id} className="hover:bg-stone-50/50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-stone-900">{r.product.name}</div>
                    <div className="text-xs text-stone-400">ID: {r.product.id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-stone-900">{r.user.name}</div>
                    <div className="text-xs text-stone-400">{r.user.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-stone-800">{r.rating}</span>
                      <Star className="h-3.5 w-3.5 fill-emerald-600 text-emerald-600" />
                    </div>
                  </td>
                  <td className="px-6 py-4 max-w-xs">
                    <div className="font-bold text-stone-800 text-xs">{r.title}</div>
                    <p className="text-xs text-stone-500 line-clamp-2 mt-0.5 whitespace-pre-line">{r.comment}</p>
                    {r.images && r.images.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {r.images.map((img: any) => (
                          <div key={img.id} className="h-8 w-8 overflow-hidden rounded border border-stone-100 relative bg-stone-50">
                            <SmartImage src={img.imageUrl} alt="" className="h-full w-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                    {r.sellerReply && (
                      <div className="mt-2 text-[10px] text-stone-500 bg-stone-100 rounded px-2 py-1 italic border-l border-stone-400">
                        Seller: &ldquo;{r.sellerReply}&rdquo;
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {r.isHidden ? (
                      <span className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 border border-red-200">
                        <AlertTriangle className="h-3 w-3" /> Hidden
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded bg-green-50 px-2 py-1 text-xs font-semibold text-green-700 border border-green-200">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleToggleHide(r.id, r.isHidden)}
                      disabled={processingId === r.id}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                        r.isHidden
                          ? "border-emerald-200 hover:bg-emerald-50 text-emerald-700"
                          : "border-red-200 hover:bg-red-50 text-red-700"
                      }`}
                    >
                      {r.isHidden ? (
                        <>
                          <Eye className="h-3.5 w-3.5" /> Make Active
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3.5 w-3.5" /> Hide Review
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-stone-200 px-4 py-3 bg-white sm:px-6 rounded-xl shadow-sm">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="relative inline-flex items-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="relative ml-3 inline-flex items-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-stone-700">
                Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to <span className="font-medium">{Math.min(currentPage * pageSize, reviews.length)}</span> of{" "}
                <span className="font-medium">{reviews.length}</span> results
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm bg-white" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-stone-400 ring-1 ring-inset ring-stone-300 hover:bg-stone-50 disabled:opacity-50"
                >
                  &larr;
                </button>
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  const isCurrent = pNum === currentPage;
                  return (
                    <button
                      key={pNum}
                      onClick={() => setCurrentPage(pNum)}
                      aria-current={isCurrent ? "page" : undefined}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 ${isCurrent ? "z-10 bg-stone-900 text-white" : "text-stone-900 ring-1 ring-inset ring-stone-300 hover:bg-stone-50"}`}
                    >
                      {pNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-stone-400 ring-1 ring-inset ring-stone-300 hover:bg-stone-50 disabled:opacity-50"
                >
                  &rarr;
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
