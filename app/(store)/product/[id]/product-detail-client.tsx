"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/set-state-in-effect */

import { SmartImage } from "@/components/site/smart-image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Heart, Truck, RotateCcw, ShieldCheck, Star, MapPin, Film, MessageSquare, Plus, Edit, X, Upload } from "lucide-react";
import { CustomerLayout } from "@/components/site/layout";
import { ProductCard } from "@/components/site/product-card";
import type { Product } from "@/lib/mock-data";
import { useCart } from "@/providers/cart-provider";
import { useWishlist } from "@/providers/wishlist-provider";
import { toast } from "sonner";
import { createOrUpdateReview } from "@/actions/reviews";
import { askQuestion } from "@/actions/qa";

export default function ProductDetailClient({
  product,
  similar,
  recommended,
  initialReviews = [],
  initialQuestions = [],
  isWishlisted = false,
  unreviewedOrderItemId = null,
  userReviews = [],
  sessionUser = null,
}: {
  product: Product;
  similar: Product[];
  recommended: Product[];
  initialReviews?: any[];
  initialQuestions?: any[];
  isWishlisted?: boolean;
  unreviewedOrderItemId?: string | null;
  userReviews?: any[];
  sessionUser?: any;
}) {
  const [activeImg, setActiveImg] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  
  const { addToCart } = useCart();
  const { toggleWishlistItem } = useWishlist();
  const router = useRouter();
  
  const [isWish, setIsWish] = useState(isWishlisted);
  const [reviews] = useState(initialReviews);
  const [questions] = useState(initialQuestions);
  const [unreviewedId, setUnreviewedId] = useState(unreviewedOrderItemId);

  const searchParams = useSearchParams();
  const writeReviewParam = searchParams?.get("writeReview");
  const orderItemIdParam = searchParams?.get("orderItemId");

  // Form States
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<any | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewHoverRating, setReviewHoverRating] = useState<number>(0);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewFiles, setReviewFiles] = useState<File[]>([]);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Q&A States
  const [newQuestionText, setNewQuestionText] = useState("");
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false);

  useEffect(() => {
    if (writeReviewParam === "true" && orderItemIdParam) {
      const existing = userReviews.find((r: any) => r.orderItemId === orderItemIdParam);
      if (existing) {
        setEditingReview(existing);
        setReviewRating(existing.rating);
        setReviewTitle(existing.title);
        setReviewComment(existing.comment);
        setReviewFiles([]);
        setIsReviewOpen(true);
      } else if (unreviewedId === orderItemIdParam) {
        setEditingReview(null);
        setReviewRating(5);
        setReviewTitle("");
        setReviewComment("");
        setReviewFiles([]);
        setIsReviewOpen(true);
      }
    }
  }, [writeReviewParam, orderItemIdParam, userReviews, unreviewedId]);

  const matchingVariant = product.variants?.find((v) => {
    const sizeMatches = !product.sizes?.length || v.size === size;
    const colorMatches = !product.colors?.length || v.color === color;
    return sizeMatches && colorMatches;
  });

  const isOutOfStock = matchingVariant
    ? matchingVariant.stock <= 0
    : (product.variants?.every((v) => v.stock <= 0) ?? false);

  const handleAddToBag = async () => {
    if (product.sizes?.length && !size) {
      toast.error("Please select a size");
      return;
    }
    if (product.colors?.length && !color) {
      toast.error("Please select a color");
      return;
    }
    if (!matchingVariant) {
      toast.error("Selected combination is not available");
      return;
    }
    await addToCart(matchingVariant.id, 1);
  };

  const handleBuyNow = async () => {
    if (product.sizes?.length && !size) {
      toast.error("Please select a size");
      return;
    }
    if (product.colors?.length && !color) {
      toast.error("Please select a color");
      return;
    }
    if (!matchingVariant) {
      toast.error("Selected combination is not available");
      return;
    }
    const res = await addToCart(matchingVariant.id, 1);
    if (res.success) {
      router.push("/checkout");
    }
  };

  const handleToggleWish = async () => {
    const res = await toggleWishlistItem(product.id);
    if (res.success) {
      setIsWish(res.isAdded ?? false);
    }
  };

  const handleContactSeller = async () => {
    if (!sessionUser) {
      toast.error("Please sign in to contact the seller.");
      router.push("/login");
      return;
    }

    try {
      const { getOrCreateConversation } = await import("@/actions/chat");
      const targetSellerId = product.sellerProfileId;
      if (!targetSellerId) {
        toast.error("Seller profile not found.");
        return;
      }
      
      const convType = sessionUser.role === "B2B_VENDOR" ? "B2B_RFQ" : "CUSTOMER_SELLER";
      const conv = await getOrCreateConversation(convType as any, targetSellerId, product.id);
      
      if (sessionUser.role === "ADMIN") {
        router.push(`/admin/messages?id=${conv.id}`);
      } else if (sessionUser.role === "SELLER") {
        router.push(`/seller/messages?id=${conv.id}`);
      } else if (sessionUser.role === "B2B_VENDOR") {
        router.push(`/b2b/messages?id=${conv.id}`);
      } else {
        router.push(`/account/messages?id=${conv.id}`);
      }
      toast.success("Conversation started!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to start conversation.");
    }
  };

  // Review Submissions
  const handleReviewFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length + reviewFiles.length > 5) {
      toast.error("You can upload a maximum of 5 images.");
      return;
    }
    setReviewFiles([...reviewFiles, ...selectedFiles]);
  };

  const removeReviewFile = (index: number) => {
    setReviewFiles(reviewFiles.filter((_, i) => i !== index));
  };

  const handleOpenEditReview = (rev: any) => {
    setEditingReview(rev);
    setReviewRating(rev.rating);
    setReviewTitle(rev.title);
    setReviewComment(rev.comment);
    setReviewFiles([]);
    setIsReviewOpen(true);
  };

  const handleOpenAddReview = () => {
    setEditingReview(null);
    setReviewRating(5);
    setReviewTitle("");
    setReviewComment("");
    setReviewFiles([]);
    setIsReviewOpen(true);
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTitle.trim() || !reviewComment.trim()) {
      toast.error("Please fill out both the title and comment fields.");
      return;
    }

    setIsSubmittingReview(true);
    try {
      const formData = new FormData();
      formData.append("productId", product.id);
      formData.append("rating", String(reviewRating));
      formData.append("title", reviewTitle);
      formData.append("comment", reviewComment);

      if (editingReview) {
        formData.append("reviewId", editingReview.id);
      } else if (unreviewedId) {
        formData.append("orderItemId", unreviewedId);
      }

      reviewFiles.forEach((file, idx) => {
        formData.append(`image${idx}`, file);
      });

      const res = await createOrUpdateReview(formData);
      if (res.success) {
        toast.success(editingReview ? "Review updated!" : "Review submitted successfully!");
        setIsReviewOpen(false);
        setEditingReview(null);
        setReviewFiles([]);
        
        // Refresh local review state
        if (!editingReview) {
          setUnreviewedId(null);
        }
        router.refresh();
      } else {
        toast.error(res.error || "Failed to save review.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred while uploading images.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Q&A Submission
  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionUser) {
      toast.error("Please sign in to ask a question.");
      router.push("/login");
      return;
    }
    if (!newQuestionText.trim()) {
      toast.error("Question cannot be empty.");
      return;
    }

    setIsSubmittingQuestion(true);
    try {
      const res = await askQuestion(product.id, newQuestionText);
      if (res.success) {
        toast.success("Question submitted! It will appear once approved if moderated.");
        setNewQuestionText("");
        router.refresh();
      } else {
        toast.error(res.error || "Failed to submit question.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred.");
    } finally {
      setIsSubmittingQuestion(false);
    }
  };

  // Calculate stats
  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) : 0;
  
  const ratingDistribution = [0, 0, 0, 0, 0]; // count of 5,4,3,2,1 star
  reviews.forEach((r) => {
    if (r.rating >= 1 && r.rating <= 5) {
      ratingDistribution[5 - r.rating]++;
    }
  });

  const discount = product.mrp > 0 ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;
  const images = product.images && product.images.length > 0 ? product.images : [product.image];

  return (
    <CustomerLayout>
      <div className="container-page pt-6 text-xs text-muted-foreground">
        <Link href="/">Home</Link> / <Link href={`/category/${product.category}`} className="capitalize">{product.category}</Link> / <span className="text-foreground">{product.name}</span>
      </div>

      <div className="container-page mt-4 grid gap-8 lg:grid-cols-2">
        {/* Gallery */}
        <div className="grid gap-3 sm:grid-cols-[80px_1fr]">
          <div className="order-2 flex gap-2 overflow-x-auto sm:order-1 sm:flex-col">
            {images.map((src, i) => (
              <button key={i} onClick={() => setActiveImg(i)} className={`aspect-[4/5] w-16 shrink-0 overflow-hidden rounded border ${activeImg === i ? "border-foreground" : "border-border"}`}>
                <SmartImage src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
            {product.videoUrl && (
              <button onClick={() => setActiveImg(images.length)} className={`aspect-[4/5] w-16 shrink-0 rounded border flex flex-col items-center justify-center bg-stone-50 text-stone-500 hover:text-stone-900 transition-colors ${activeImg === images.length ? "border-foreground" : "border-border"}`}>
                <Film className="h-5 w-5" />
                <span className="text-[8px] uppercase tracking-wider mt-1">Video</span>
              </button>
            )}
          </div>
          <div className="order-1 aspect-[4/5] overflow-hidden rounded-md bg-muted sm:order-2 flex items-center justify-center">
            {product.videoUrl && activeImg === images.length ? (
              <video src={product.videoUrl} controls className="h-full w-full object-contain bg-black" />
            ) : (
              <SmartImage src={images[activeImg]} alt={product.name} className="h-full w-full object-cover" />
            )}
          </div>
        </div>

        {/* Info */}
        <div>
          <div className="text-sm text-muted-foreground">{product.brand}</div>
          <h1 className="mt-1 font-display text-3xl">{product.name}</h1>
          
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="flex items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 text-success font-medium">
              <Star className="h-3 w-3 fill-current" /> {avgRating > 0 ? avgRating.toFixed(1) : product.rating.toFixed(1)}
            </span>
            <span className="text-muted-foreground">{totalReviews > 0 ? totalReviews : product.reviews} reviews</span>
          </div>

          <div className="mt-5 flex items-baseline gap-3">
            <span className="text-2xl font-medium">₹{Number(product.price).toLocaleString("en-IN")}</span>
            {discount > 0 && (
              <>
                <span className="text-sm text-muted-foreground line-through">₹{Number(product.mrp).toLocaleString("en-IN")}</span>
                <span className="text-sm font-medium text-discount">{discount}% off</span>
              </>
            )}
          </div>
          <div className="text-xs text-muted-foreground">Inclusive of all taxes</div>

          {product.colors && product.colors.length > 0 && (
            <div className="mt-6">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider">Color</div>
              <div className="flex gap-2">
                {product.colors.map((c) => (
                  <button key={c} onClick={() => setColor(c)} className={`h-8 w-8 rounded-full border-2 ${color === c ? "border-foreground" : "border-border"}`} style={{ background: c }} />
                ))}
              </div>
            </div>
          )}

          {product.sizes && product.sizes.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-medium uppercase tracking-wider">Size</span>
                <button className="text-muted-foreground hover:text-foreground">Size guide</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((s) => (
                  <button key={s} onClick={() => setSize(s)} className={`h-10 min-w-12 rounded-md border px-3 text-sm ${size === s ? "border-foreground bg-foreground text-background" : "border-input hover:border-foreground"}`}>{s}</button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            {isOutOfStock ? (
              <button disabled className="flex-1 rounded-md bg-muted py-3 text-sm font-medium text-muted-foreground cursor-not-allowed">Out of stock</button>
            ) : (
              <>
                <button onClick={handleAddToBag} className="flex-1 rounded-md bg-foreground py-3 text-sm font-medium text-background hover:opacity-90">Add to bag</button>
                <button onClick={handleBuyNow} className="flex-1 rounded-md bg-accent py-3 text-center text-sm font-medium text-accent-foreground hover:opacity-90">Buy now</button>
              </>
            )}
            
            <button
              onClick={handleToggleWish}
              aria-label="Wishlist"
              className={`grid h-12 w-12 place-items-center rounded-md border border-input hover:border-foreground transition-colors ${
                isWish ? "bg-red-50 text-red-500 border-red-200" : "text-muted-foreground"
              }`}
            >
              <Heart className={`h-5 w-5 ${isWish ? "fill-current" : ""}`} />
            </button>
          </div>

          {/* Delivery */}
          <div className="mt-6 rounded-md border border-border p-4 text-sm">
            <div className="font-medium">Delivery</div>
            <div className="mt-2 flex items-center gap-2 text-muted-foreground">
              <Truck className="h-4 w-4" /> Estimated delivery in 3–5 days
            </div>
            <div className="mt-1 flex items-center gap-2 text-muted-foreground">
              <RotateCcw className="h-4 w-4" /> Free 7-day returns
            </div>
            <div className="mt-1 flex items-center gap-2 text-muted-foreground">
              <ShieldCheck className="h-4 w-4" /> Verified seller
            </div>
          </div>

          {/* Seller */}
          <div className="mt-4 flex items-center justify-between rounded-md border border-border p-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Sold by</div>
              <div className="font-medium">{product.store}</div>
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {product.storeLocation}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleContactSeller}
                className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm hover:border-foreground hover:bg-stone-50 transition cursor-pointer"
              >
                <MessageSquare className="h-4 w-4" /> Contact Seller
              </button>
              <button className="rounded-md border border-input px-3 py-1.5 text-sm hover:border-foreground">Visit store</button>
            </div>
          </div>

          {/* Details */}
          <details open className="mt-6 border-t border-border pt-4 text-sm">
            <summary className="cursor-pointer font-medium">Product details</summary>
            <p className="mt-2 text-muted-foreground">
              {product.description || "Crafted in small batches with premium fabrics. Garment-washed for a soft hand-feel. Designed in India. Composition: 100% breathable fibres. Machine wash cold, line dry."}
            </p>
          </details>
        </div>
      </div>

      {/* Reviews Section */}
      <section className="container-page mt-16 border-t border-border pt-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h2 className="font-display text-2xl">Customer Reviews</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Ratings breakdown based on verified customer submissions.</p>
          </div>
          
          {/* Write/Edit Review Button */}
          {unreviewedId ? (
            <button
              onClick={handleOpenAddReview}
              className="inline-flex items-center gap-1.5 rounded-lg bg-foreground text-background px-4 py-2.5 text-sm font-medium hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Write a Review
            </button>
          ) : userReviews.length > 0 ? (
            <button
              onClick={() => handleOpenEditReview(userReviews[0])}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input px-4 py-2.5 text-sm font-medium text-foreground hover:border-foreground"
            >
              <Edit className="h-4 w-4" /> Edit My Review
            </button>
          ) : null}
        </div>

        <div className="grid gap-8 md:grid-cols-[250px_1fr]">
          {/* Rating Summary Bar */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border p-5 text-center bg-muted/10">
              <div className="text-4xl font-bold font-display">
                {avgRating > 0 ? avgRating.toFixed(1) : "0.0"}
              </div>
              <div className="flex justify-center gap-0.5 my-2 text-success">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${i < Math.round(avgRating) ? "fill-current" : "opacity-30"}`}
                  />
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                Based on {totalReviews} {totalReviews === 1 ? "review" : "reviews"}
              </div>
            </div>

            {/* Distribution */}
            <div className="space-y-2 text-xs">
              {ratingDistribution.map((count, index) => {
                const starVal = 5 - index;
                const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                return (
                  <div key={starVal} className="flex items-center gap-2">
                    <span className="w-8 shrink-0">{starVal} star</span>
                    <div className="h-2 w-full rounded bg-muted overflow-hidden">
                      <div className="h-full bg-success" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right text-muted-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reviews List */}
          <div className="space-y-6">
            {reviews.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground text-sm">
                No reviews yet. {unreviewedId && "Be the first to review this product!"}
              </div>
            ) : (
              reviews.map((r) => (
                <div key={r.id} className="rounded-xl border border-border p-5 bg-background shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-muted font-bold text-xs uppercase">
                        {r.user.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{r.user.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(r.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {r.isVerifiedPurchase && (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Verified Purchase
                        </span>
                      )}
                      <div className="flex text-success gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${i < r.rating ? "fill-current" : "opacity-30"}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-foreground">{r.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line leading-relaxed">
                      {r.comment}
                    </p>
                  </div>

                  {/* Review Photos */}
                  {r.images && r.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {r.images.map((img: any) => (
                        <div key={img.id} className="h-16 w-16 overflow-hidden rounded border border-border relative bg-muted">
                          <img
                            src={img.imageUrl}
                            alt=""
                            className="h-full w-full object-cover hover:scale-110 transition duration-300 cursor-pointer"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Seller Reply */}
                  {r.sellerReply && (
                    <div className="bg-stone-50 border-l-2 border-stone-400 rounded p-4 text-xs mt-3">
                      <div className="font-semibold text-stone-700 uppercase tracking-wider mb-1">
                        Seller Response:
                      </div>
                      <p className="text-stone-600 whitespace-pre-line leading-relaxed">{r.sellerReply}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Q&A Section */}
      <section className="container-page mt-16 border-t border-border pt-12">
        <h2 className="font-display text-2xl mb-1">Product Questions & Answers</h2>
        <p className="text-sm text-muted-foreground mb-6">Have doubts? Ask the seller directly.</p>

        <div className="grid gap-8 lg:grid-cols-[1fr_350px]">
          {/* Questions List */}
          <div className="space-y-6">
            {questions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground text-sm">
                No questions asked yet. Have queries? Submit them in the side form.
              </div>
            ) : (
              questions.map((q) => (
                <div key={q.id} className="rounded-xl border border-border p-5 bg-background shadow-sm space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-stone-900 text-white font-display text-xs font-bold">Q</span>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground whitespace-pre-line leading-relaxed">{q.question}</p>
                      <div className="text-[10px] text-muted-foreground">
                        Asked by {q.user.name} on {new Date(q.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                      </div>
                    </div>
                  </div>

                  {q.answers && q.answers.length > 0 ? (
                    q.answers.map((ans: any) => (
                      <div key={ans.id} className="flex items-start gap-3 pl-4 border-l-2 border-accent">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-accent text-accent-foreground font-display text-xs font-bold">A</span>
                        <div className="space-y-1">
                          <p className="text-sm text-stone-700 whitespace-pre-line leading-relaxed">{ans.answer}</p>
                          <div className="text-[10px] text-muted-foreground">
                            Answered by <span className="font-medium text-foreground">{ans.seller.storeName}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-muted-foreground italic pl-9">
                      Awaiting seller response.
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Ask Question Form */}
          <div className="rounded-xl border border-border p-5 bg-muted/5 h-fit space-y-4">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Ask a Question
            </h3>
            
            {sessionUser ? (
              <form onSubmit={handleQuestionSubmit} className="space-y-3">
                <textarea
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  placeholder="Ask about sizing, materials, or delivery expectations..."
                  rows={4}
                  className="w-full rounded-lg border border-input p-3 text-sm outline-none bg-background focus:border-foreground"
                />
                <button
                  type="submit"
                  disabled={isSubmittingQuestion}
                  className="w-full rounded-lg bg-foreground text-background py-2 text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
                >
                  {isSubmittingQuestion ? "Submitting..." : "Post Question"}
                </button>
              </form>
            ) : (
              <div className="text-center py-4 space-y-3">
                <p className="text-xs text-muted-foreground">You must be logged in to ask questions.</p>
                <Link
                  href="/login"
                  className="inline-block rounded-lg bg-foreground text-background px-4 py-1.5 text-xs font-medium hover:opacity-90"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Review Modal Form */}
      {isReviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsReviewOpen(false)}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="font-display text-xl mb-4">
              {editingReview ? "Edit My Review" : "Write a Review"}
            </h3>

            <form onSubmit={handleReviewSubmit} className="space-y-4">
              {/* Star Rating picker */}
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                  Rating
                </label>
                <div className="flex gap-1 text-2xl text-success">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const value = i + 1;
                    const isActive = reviewHoverRating ? value <= reviewHoverRating : value <= reviewRating;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setReviewRating(value)}
                        onMouseEnter={() => setReviewHoverRating(value)}
                        onMouseLeave={() => setReviewHoverRating(0)}
                        className="hover:scale-110 transition duration-150"
                      >
                        <Star className={`h-6 w-6 ${isActive ? "fill-current" : "opacity-30"}`} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                  Title Summary
                </label>
                <input
                  type="text"
                  required
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  placeholder="e.g. Beautiful fabric, perfect fit!"
                  className="w-full rounded-lg border border-input p-2.5 text-sm outline-none bg-background focus:border-foreground"
                />
              </div>

              {/* Comments */}
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                  Review Comment
                </label>
                <textarea
                  required
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share details about materials, fitting, colors, or shipping..."
                  rows={4}
                  className="w-full rounded-lg border border-input p-3 text-sm outline-none bg-background focus:border-foreground"
                />
              </div>

              {/* Photos upload (Max 5) */}
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                  Review Images (Optional - Max 5)
                </label>
                <div className="grid grid-cols-5 gap-2 mt-2">
                  {reviewFiles.map((file, idx) => (
                    <div key={idx} className="aspect-square rounded border relative overflow-hidden bg-muted flex items-center justify-center">
                      <img
                        src={URL.createObjectURL(file)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeReviewFile(idx)}
                        className="absolute right-0.5 top-0.5 rounded-full bg-red-600 text-white p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}

                  {reviewFiles.length < 5 && (
                    <label className="aspect-square rounded border border-dashed hover:border-foreground flex flex-col items-center justify-center cursor-pointer bg-muted/10 text-muted-foreground hover:text-foreground">
                      <Upload className="h-4 w-4" />
                      <span className="text-[8px] mt-1 uppercase font-bold tracking-wider">Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleReviewFileChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmittingReview}
                className="w-full rounded-lg bg-foreground text-background py-3 text-sm font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {isSubmittingReview ? "Submitting..." : editingReview ? "Update Review" : "Submit Review"}
              </button>
            </form>
          </div>
        </div>
      )}

      {similar.length > 0 && (
        <section className="container-page mt-16">
          <h2 className="mb-5 font-display text-2xl">Similar products</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-4">
            {similar.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {recommended.length > 0 && (
        <section className="container-page mt-16">
          <h2 className="mb-5 font-display text-2xl">You may also like</h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-4">
            {recommended.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </CustomerLayout>
  );
}
