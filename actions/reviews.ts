"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { NotificationType } from "@prisma/client";
import { sendInAppNotification } from "@/actions/notifications";
import { sendNotificationEmail } from "@/lib/email";
import fs from "fs/promises";
import path from "path";
import { rateLimit } from "@/lib/rate-limit";
import { createAuditLog } from "@/actions/audit";

/**
 * Get current user's session.
 */
async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * Helper function to save a file locally in public/uploads/reviews
 */
async function saveUploadedFile(file: File): Promise<string> {
  const uploadDir = path.join(process.cwd(), "public", "uploads", "reviews");
  await fs.mkdir(uploadDir, { recursive: true });
  const ext = path.extname(file.name) || ".jpg";
  const fileName = `${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}${ext}`;
  const filePath = path.join(uploadDir, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buffer);
  return `/uploads/reviews/${fileName}`;
}

/**
 * Recalculates product rating statistics and caches them on the Product model.
 */
async function updateProductRatingCache(productId: string) {
  const allReviews = await prisma.review.findMany({
    where: { productId, isHidden: false },
    select: { rating: true },
  });

  const count = allReviews.length;
  const avg = count > 0 ? allReviews.reduce((sum, r) => sum + r.rating, 0) / count : 0;

  await prisma.product.update({
    where: { id: productId },
    data: {
      rating: avg,
      averageRating: avg,
      reviewsCount: count,
    },
  });
}

import type { Review } from "@prisma/client";

/**
 * Create or edit a review. Handled via FormData for file uploads.
 */
export async function createOrUpdateReview(formData: FormData) {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: "Please sign in to submit reviews" };
  }

  const limit = await rateLimit("review", user.id);
  if (!limit.success) {
    return { success: false, error: "Too many review attempts. Please try again in an hour." };
  }

  const reviewId = formData.get("reviewId") ? String(formData.get("reviewId")) : null;
  const productId = String(formData.get("productId"));
  const orderItemId = formData.get("orderItemId") ? String(formData.get("orderItemId")) : null;
  const rating = Number(formData.get("rating"));
  const title = String(formData.get("title")).trim();
  const comment = String(formData.get("comment")).trim();

  if (isNaN(rating) || rating < 1 || rating > 5) {
    return { success: false, error: "Rating must be between 1 and 5 stars" };
  }
  if (!title || !comment) {
    return { success: false, error: "Title and comment are required" };
  }

  try {
    let review: Review;

    // Process files (Max 5 files)
    const uploadedUrls: string[] = [];
    for (let i = 0; i < 5; i++) {
      const file = formData.get(`image${i}`);
      if (file && file instanceof File && file.size > 0) {
        try {
          const url = await saveUploadedFile(file);
          uploadedUrls.push(url);
        } catch (err) {
          console.error(`Failed to save review image ${i}:`, err);
        }
      }
    }

    if (reviewId) {
      // EDIT MODE
      const existing = await prisma.review.findUnique({
        where: { id: reviewId },
      });

      if (!existing || existing.userId !== user.id) {
        return { success: false, error: "Review not found or unauthorized" };
      }

      review = await prisma.review.update({
        where: { id: reviewId },
        data: {
          rating,
          title,
          comment,
        },
      });

      // If new images were uploaded, replace old ones
      if (uploadedUrls.length > 0) {
        await prisma.reviewImage.deleteMany({
          where: { reviewId },
        });
        await prisma.reviewImage.createMany({
          data: uploadedUrls.map((url) => ({
            reviewId,
            imageUrl: url,
          })),
        });
      }
    } else {
      // CREATE MODE
      if (!orderItemId) {
        return { success: false, error: "Order item validation required" };
      }

      // Check order item purchase
      const orderItem = await prisma.orderItem.findUnique({
        where: { id: orderItemId },
        include: { order: true },
      });

      if (!orderItem || orderItem.order.userId !== user.id) {
        return { success: false, error: "You did not purchase this item." };
      }

      if (orderItem.order.status === "CANCELLED") {
        return { success: false, error: "Cannot review a cancelled order." };
      }

      // Customer cannot create multiple reviews for the same order item
      const duplicateCheck = await prisma.review.findUnique({
        where: { orderItemId },
      });

      if (duplicateCheck) {
        return { success: false, error: "You have already reviewed this purchased item." };
      }

      review = await prisma.review.create({
        data: {
          userId: user.id,
          productId,
          orderItemId,
          rating,
          title,
          comment,
          isVerifiedPurchase: true,
        },
      });

      if (uploadedUrls.length > 0) {
        await prisma.reviewImage.createMany({
          data: uploadedUrls.map((url) => ({
            reviewId: review.id,
            imageUrl: url,
          })),
        });
      }

      // Dispatch notifications to seller
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: { seller: { include: { user: true } } },
      });

      if (product && product.seller) {
        const sellerUserId = product.seller.userId;
        // In-app
        await sendInAppNotification(
          sellerUserId,
          NotificationType.REVIEW_RECEIVED,
          "New Review Received",
          `A customer reviewed "${product.name}": ${rating}★ - "${title}"`,
          `/seller/reviews`
        );
        // Mock email
        await sendNotificationEmail(
          product.seller.user.email,
          `New Product Review Received: ${rating} Stars`,
          "SELLER_NEW_REVIEW",
          {
            sellerName: product.seller.user.name,
            productName: product.name,
            rating,
            reviewTitle: title,
            reviewComment: comment,
          }
        );
      }
    }

    // Recalculate cache on Product
    await updateProductRatingCache(productId);

    revalidatePath(`/product/${productId}`);
    revalidatePath("/seller/reviews");
    revalidatePath("/admin/reviews");

    await createAuditLog(reviewId ? "UPDATE_REVIEW" : "CREATE_REVIEW", "Review", review.id, null, { productId, rating });

    return { success: true, reviewId: review.id };
  } catch (error: unknown) {
    console.error("createOrUpdateReview error:", error);
    return { success: false, error: "Failed to save review. Please try again." };
  }
}

/**
 * Seller replies to a product review.
 */
export async function sellerReplyToReview(reviewId: string, replyText: string) {
  const user = await getSessionUser();
  if (!user || user.role !== "SELLER") {
    return { success: false, error: "Seller access required" };
  }

  const trimmedReply = replyText.trim();
  if (!trimmedReply) {
    return { success: false, error: "Reply text cannot be empty" };
  }

  try {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        product: true,
        user: true,
      },
    });

    if (!review) {
      return { success: false, error: "Review not found" };
    }

    // Owner check: Verify product belongs to current seller
    const sellerProfile = await prisma.sellerProfile.findUnique({
      where: { userId: user.id },
    });

    if (!sellerProfile || review.product.sellerId !== sellerProfile.id) {
      return { success: false, error: "Forbidden: You do not own this product." };
    }

    await prisma.review.update({
      where: { id: reviewId },
      data: {
        sellerReply: trimmedReply,
      },
    });

    // Notify customer
    await sendInAppNotification(
      review.userId,
      NotificationType.REVIEW_REPLY,
      "Seller Replied to Your Review",
      `The seller has replied to your review on "${review.product.name}": "${trimmedReply}"`,
      `/account/orders`
    );

    await sendNotificationEmail(
      review.user.email,
      `Seller Replied to Your Review: ${review.product.name}`,
      "CUSTOMER_REVIEW_REPLY",
      {
        customerName: review.user.name,
        productName: review.product.name,
        replyText: trimmedReply,
      }
    );

    revalidatePath(`/product/${review.productId}`);
    revalidatePath("/seller/reviews");

    await createAuditLog("REPLY_TO_REVIEW", "Review", reviewId, null, { replyText });

    return { success: true };
  } catch (error: unknown) {
    console.error("sellerReplyToReview error:", error);
    return { success: false, error: "Failed to submit seller reply" };
  }
}

/**
 * Admin hides or unhides a review for moderation.
 */
export async function moderateReview(reviewId: string, isHidden: boolean) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return { success: false, error: "Admin access required" };
  }

  try {
    const review = await prisma.review.update({
      where: { id: reviewId },
      data: { isHidden },
    });

    // Update Product cache
    await updateProductRatingCache(review.productId);

    revalidatePath(`/product/${review.productId}`);
    revalidatePath("/admin/reviews");
    revalidatePath("/seller/reviews");

    await createAuditLog("MODERATE_REVIEW", "Review", reviewId, null, { isHidden });

    return { success: true };
  } catch (error: unknown) {
    console.error("moderateReview error:", error);
    return { success: false, error: "Failed to moderate review" };
  }
}

/**
 * Fetch all reviews for a product (public).
 */
export async function getReviews(productId: string) {
  try {
    const reviews = await prisma.review.findMany({
      where: { productId, isHidden: false },
      include: {
        images: true,
        user: {
          select: {
            name: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return { success: true, reviews };
  } catch (error) {
    console.error("getReviews error:", error);
    return { success: false, error: "Failed to fetch reviews" };
  }
}
