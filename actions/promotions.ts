"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import type {
  CouponDiscountType,
  PromotionType,
  PromotionStatus,
  ApprovalStatus,
} from "@prisma/client";
import { sendInAppNotification } from "@/actions/notifications";
import type { ActivePromotion, CouponForEngine } from "@/lib/promotions-engine";
import { rateLimit } from "@/lib/rate-limit";
import { createAuditLog } from "@/actions/audit";
import { requireSellerProfile } from "@/lib/seller-context";

// ─── Session Helper ───────────────────────────────────────────────────────────

async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}

// ─── Helper: Fetch Active Approved Promotions ─────────────────────────────────

/**
 * Returns all promotions that are currently active, approved, and within date range.
 * Used by cart and checkout for server-side price calculations.
 */
export async function getActivePromotions(): Promise<ActivePromotion[]> {
  const now = new Date();
  const promotions = await prisma.promotion.findMany({
    where: {
      status: "ACTIVE",
      approvalStatus: "APPROVED",
      startDate: { lte: now },
      endDate: { gte: now },
    },
    include: {
      products: { select: { productId: true } },
      category: { select: { id: true, slug: true } },
    },
  });

  return promotions.map((p) => ({
    id: p.id,
    type: p.type,
    discountType: p.discountType,
    discountValue: Number(p.discountValue),
    sellerId: p.sellerId,
    categoryId: p.categoryId,
    categorySlug: p.category?.slug ?? null,
    productIds: p.products.map((pp) => pp.productId),
  }));
}

// ─── Coupon: Apply to Cart ────────────────────────────────────────────────────

export async function applyCouponToCart(code: string) {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "Please sign in." };

  const trimmedCode = code.trim().toUpperCase();
  if (!trimmedCode) return { success: false, error: "Please enter a coupon code." };

  const limit = await rateLimit("coupon_apply", user.id);
  if (!limit.success) {
    return { success: false, error: "Too many coupon attempts. Please wait a minute." };
  }

  // Check if coupon exists (basic existence check; full validation happens on checkout)
  const coupon = await prisma.coupon.findUnique({
    where: { code: trimmedCode },
  });

  if (!coupon) return { success: false, error: "Invalid coupon code." };
  if (coupon.status !== "ACTIVE") return { success: false, error: "This coupon is inactive." };

  const now = new Date();
  if (now > coupon.endDate) return { success: false, error: "This coupon has expired." };
  if (now < coupon.startDate) return { success: false, error: "This coupon is not valid yet." };

  // Save coupon code to cart
  await prisma.cart.update({
    where: { userId: user.id },
    data: { appliedCouponCode: trimmedCode },
  });

  await createAuditLog("APPLY_COUPON", "Cart", user.id, null, { code: trimmedCode });

  revalidatePath("/cart");
  revalidatePath("/checkout");

  return { success: true, couponCode: trimmedCode, couponDescription: coupon.description };
}

export async function removeCouponFromCart() {
  const user = await getSessionUser();
  if (!user) return { success: false, error: "Please sign in." };

  await prisma.cart.updateMany({
    where: { userId: user.id },
    data: { appliedCouponCode: null },
  });

  revalidatePath("/cart");
  revalidatePath("/checkout");

  return { success: true };
}

// ─── Coupon: Fetch for Engine (used by checkout) ──────────────────────────────

export async function getCouponForEngine(code: string): Promise<CouponForEngine | null> {
  const coupon = await prisma.coupon.findUnique({
    where: { code: code.trim().toUpperCase() },
  });
  if (!coupon) return null;
  return {
    id: coupon.id,
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: Number(coupon.discountValue),
    minimumOrderAmount: Number(coupon.minimumOrderAmount),
    maximumDiscount: coupon.maximumDiscount ? Number(coupon.maximumDiscount) : null,
    sellerId: coupon.sellerId,
    categoryId: coupon.categoryId,
    productId: coupon.productId,
    usageLimit: coupon.usageLimit,
    perUserLimit: coupon.perUserLimit,
    usageCount: coupon.usageCount,
    startDate: coupon.startDate,
    endDate: coupon.endDate,
    status: coupon.status,
  };
}

// ─── Admin: Coupon CRUD ───────────────────────────────────────────────────────

export async function adminCreateCoupon(data: {
  code: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minimumOrderAmount?: number;
  maximumDiscount?: number;
  usageLimit?: number;
  perUserLimit?: number;
  startDate: string;
  endDate: string;
  sellerId?: string;
  categoryId?: string;
  productId?: string;
}) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return { success: false, error: "Admin access required." };

  const code = data.code.trim().toUpperCase();
  if (!code) return { success: false, error: "Coupon code is required." };

  const existing = await prisma.coupon.findUnique({ where: { code } });
  if (existing) return { success: false, error: "This coupon code is already in use." };

  if (data.discountType === "PERCENTAGE" && (data.discountValue < 1 || data.discountValue > 100)) {
    return { success: false, error: "Percentage discount must be between 1 and 100." };
  }
  if (data.discountType === "FIXED_AMOUNT" && data.discountValue <= 0) {
    return { success: false, error: "Fixed discount must be greater than 0." };
  }

  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  if (startDate >= endDate) return { success: false, error: "Start date must be before end date." };

  await prisma.coupon.create({
    data: {
      code,
      description: data.description ?? null,
      discountType: data.discountType,
      discountValue: data.discountValue,
      minimumOrderAmount: data.minimumOrderAmount ?? 0,
      maximumDiscount: data.maximumDiscount ?? null,
      usageLimit: data.usageLimit ?? null,
      perUserLimit: data.perUserLimit ?? 1,
      startDate,
      endDate,
      status: "ACTIVE",
      sellerId: data.sellerId ?? null,
      categoryId: data.categoryId ?? null,
      productId: data.productId ?? null,
      createdByAdminId: user.id,
    },
  });

  await createAuditLog("CREATE_COUPON", "Coupon", null, null, { code, discountType: data.discountType, discountValue: data.discountValue });

  revalidatePath("/admin/coupons");
  return { success: true };
}

export async function adminGetCoupons() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return { success: false, error: "Admin access required.", coupons: [] };

  const coupons = await prisma.coupon.findMany({
    include: {
      seller: { select: { storeName: true } },
      category: { select: { name: true } },
      product: { select: { name: true } },
      _count: { select: { usages: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return { success: true, coupons };
}

export async function adminUpdateCouponStatus(couponId: string, status: "ACTIVE" | "INACTIVE") {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return { success: false, error: "Admin access required." };

  await prisma.coupon.update({ where: { id: couponId }, data: { status } });

  await createAuditLog("UPDATE_COUPON_STATUS", "Coupon", couponId, null, { status });

  revalidatePath("/admin/coupons");
  return { success: true };
}

export async function adminDeleteCoupon(couponId: string) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return { success: false, error: "Admin access required." };

  await prisma.coupon.delete({ where: { id: couponId } });

  await createAuditLog("DELETE_COUPON", "Coupon", couponId, null, null);

  revalidatePath("/admin/coupons");
  return { success: true };
}

// ─── Admin: Promotion Management ──────────────────────────────────────────────

export async function adminCreatePromotion(data: {
  name: string;
  description?: string;
  type: PromotionType;
  discountType: CouponDiscountType;
  discountValue: number;
  startDate: string;
  endDate: string;
  sellerId?: string;
  categoryId?: string;
  productIds?: string[];
}) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return { success: false, error: "Admin access required." };

  if (data.discountType === "PERCENTAGE" && (data.discountValue < 1 || data.discountValue > 100)) {
    return { success: false, error: "Percentage discount must be between 1 and 100." };
  }
  if (data.discountType === "FIXED_AMOUNT" && data.discountValue <= 0) {
    return { success: false, error: "Fixed discount must be greater than 0." };
  }

  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  if (startDate >= endDate) return { success: false, error: "Start date must be before end date." };

  const now = new Date();
  const promoStatus: PromotionStatus = now >= startDate && now <= endDate ? "ACTIVE" : "SCHEDULED";

  const promotion = await prisma.promotion.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      type: data.type,
      discountType: data.discountType,
      discountValue: data.discountValue,
      startDate,
      endDate,
      status: promoStatus,
      approvalStatus: "APPROVED", // Admin promotions are immediately approved
      createdByAdmin: true,
      sellerId: data.sellerId ?? null,
      categoryId: data.categoryId ?? null,
      products: data.productIds && data.productIds.length > 0
        ? { create: data.productIds.map((pid) => ({ productId: pid })) }
        : undefined,
    },
  });

  await createAuditLog("CREATE_PROMOTION", "Promotion", promotion.id, null, { name: data.name, type: data.type });

  revalidatePath("/admin/promotions");
  revalidatePath("/");
  return { success: true, promotionId: promotion.id };
}

export async function adminGetAllPromotions() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return { success: false, error: "Admin access required.", promotions: [] };

  const promotions = await prisma.promotion.findMany({
    include: {
      seller: { select: { storeName: true } },
      category: { select: { name: true } },
      products: { include: { product: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return { success: true, promotions };
}

export async function adminModeratePromotion(
  promotionId: string,
  approvalStatus: ApprovalStatus,
  rejectionReason?: string
) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return { success: false, error: "Admin access required." };

  const promotion = await prisma.promotion.findUnique({
    where: { id: promotionId },
    include: { seller: { include: { user: true } } },
  });

  if (!promotion) return { success: false, error: "Promotion not found." };

  const now = new Date();
  let newStatus: PromotionStatus = promotion.status;
  if (approvalStatus === "APPROVED") {
    newStatus = now >= promotion.startDate && now <= promotion.endDate ? "ACTIVE" : "SCHEDULED";
  } else {
    newStatus = "INACTIVE";
  }

  await prisma.promotion.update({
    where: { id: promotionId },
    data: {
      approvalStatus,
      status: newStatus,
      rejectionReason: rejectionReason ?? null,
    },
  });

  // Notify the seller
  if (promotion.seller) {
    const notifType =
      approvalStatus === "APPROVED" ? "PROMOTION_APPROVED" : "PROMOTION_REJECTED";
    await sendInAppNotification(
      promotion.seller.userId,
      notifType,
      approvalStatus === "APPROVED" ? "Promotion Approved" : "Promotion Rejected",
      approvalStatus === "APPROVED"
        ? `Your promotion "${promotion.name}" has been approved and is now live.`
        : `Your promotion "${promotion.name}" was rejected. ${rejectionReason ? `Reason: ${rejectionReason}` : ""}`,
      "/seller/promotions"
    );
  }

  await createAuditLog("MODERATE_PROMOTION", "Promotion", promotionId, { status: promotion.status }, { approvalStatus });

  revalidatePath("/admin/promotions");
  revalidatePath("/seller/promotions");
  return { success: true };
}

// ─── Seller: Promotion CRUD ───────────────────────────────────────────────────

export async function sellerCreatePromotion(data: {
  name: string;
  description?: string;
  type: "PRODUCT_DISCOUNT" | "CATEGORY_DISCOUNT";
  discountType: CouponDiscountType;
  discountValue: number;
  startDate: string;
  endDate: string;
  categoryId?: string;
  productIds?: string[];
}) {
  const user = await getSessionUser();
  if (!user || user.role !== "SELLER") return { success: false, error: "Seller access required." };

  const sellerProfile = await prisma.sellerProfile.findUnique({
    where: { userId: user.id },
    include: { kyc: true },
  });

  if (!sellerProfile || sellerProfile.approvalStatus !== "APPROVED") {
    return { success: false, error: "Your seller account must be approved to create promotions." };
  }

  if (data.discountType === "PERCENTAGE" && (data.discountValue < 1 || data.discountValue > 100)) {
    return { success: false, error: "Percentage discount must be between 1 and 100." };
  }
  if (data.discountType === "FIXED_AMOUNT" && data.discountValue <= 0) {
    return { success: false, error: "Fixed discount must be greater than 0." };
  }

  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  if (startDate >= endDate) return { success: false, error: "Start date must be before end date." };

  // Validate that product IDs belong to this seller
  if (data.productIds && data.productIds.length > 0) {
    const owned = await prisma.product.count({
      where: { id: { in: data.productIds }, sellerId: sellerProfile.id },
    });
    if (owned !== data.productIds.length) {
      return { success: false, error: "You can only create promotions for your own products." };
    }
  }

  const promotion = await prisma.promotion.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      type: data.type,
      discountType: data.discountType,
      discountValue: data.discountValue,
      startDate,
      endDate,
      status: "DRAFT", // Seller promotions always start as DRAFT/PENDING
      approvalStatus: "PENDING", // Admin must approve
      createdByAdmin: false,
      sellerId: sellerProfile.id,
      categoryId: data.categoryId ?? null,
      products: data.productIds && data.productIds.length > 0
        ? { create: data.productIds.map((pid) => ({ productId: pid })) }
        : undefined,
    },
  });

  await createAuditLog("CREATE_PROMOTION", "Promotion", promotion.id, null, { name: data.name, type: data.type });

  revalidatePath("/seller/promotions");
  return { success: true, promotionId: promotion.id };
}

export async function sellerGetPromotions() {
  const ctx = await requireSellerProfile();
  if ("error" in ctx) return { success: false, error: ctx.error, promotions: [] };
  const sellerProfile = ctx.seller;

  const promotions = await prisma.promotion.findMany({
    where: { sellerId: sellerProfile.id },
    include: {
      category: { select: { name: true } },
      products: { include: { product: { select: { name: true, id: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return { success: true, promotions };
}

export async function sellerGetOwnProducts() {
  const ctx = await requireSellerProfile();
  if ("error" in ctx) return { success: false, products: [] };
  const sellerProfile = ctx.seller;

  const products = await prisma.product.findMany({
    where: { sellerId: sellerProfile.id, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return { success: true, products };
}

export async function adminGetAllCategories() {
  const user = await getSessionUser();
  if (!user) return { success: false, categories: [] };

  const categories = await prisma.category.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });
  return { success: true, categories };
}

export async function adminGetAllSellers() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return { success: false, sellers: [] };

  const sellers = await prisma.sellerProfile.findMany({
    where: { approvalStatus: "APPROVED" },
    select: { id: true, storeName: true },
    orderBy: { storeName: "asc" },
  });
  return { success: true, sellers };
}

export async function adminGetAllProducts() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return { success: false, products: [] };

  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, seller: { select: { storeName: true } } },
    orderBy: { name: "asc" },
  });
  return { success: true, products };
}
