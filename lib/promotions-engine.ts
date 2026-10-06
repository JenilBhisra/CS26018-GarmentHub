/**
 * Promotions Engine — Phase 12
 *
 * Pure server-side discount calculation. All discount logic lives here.
 * Frontend receives only the calculated values, never raw discount rules.
 */

import type { CouponDiscountType } from "@prisma/client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ActivePromotion {
  id: string;
  type: string; // PromotionType
  discountType: CouponDiscountType;
  discountValue: number;
  sellerId?: string | null;
  categoryId?: string | null;
  categorySlug?: string | null;
  productIds: string[]; // product ids in PromotionProduct relation
}

export interface CartItemForEngine {
  variantId: string;
  productId: string;
  sellerId: string;
  categoryId: string;
  sellingPrice: number;
  quantity: number;
}

export interface CouponForEngine {
  id: string;
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minimumOrderAmount: number;
  maximumDiscount: number | null;
  sellerId: string | null;
  categoryId: string | null;
  productId: string | null;
  usageLimit: number | null;
  perUserLimit: number;
  usageCount: number;
  startDate: Date;
  endDate: Date;
  status: string;
}

export interface PerSellerSubtotal {
  sellerId: string;
  subtotal: number; // after promotions, before coupon
}

export interface CouponDiscountPerSeller {
  sellerId: string;
  discount: number;
}

export interface CouponValidationResult {
  valid: boolean;
  error?: string;
  totalDiscount: number;
  perSellerDiscounts: CouponDiscountPerSeller[];
}

// ─── Promotion Engine ─────────────────────────────────────────────────────────

/**
 * Apply active promotions to a single cart item's price.
 * Returns the effective unit price after promotion discount.
 *
 * Priority: Product-specific > Category-specific > Seller-specific > Sitewide
 * Only the highest applicable discount is applied (not stacked).
 */
export function applyPromotionToItem(
  item: CartItemForEngine,
  promotions: ActivePromotion[]
): number {
  let bestDiscount = 0;

  // Promotions passed here are already APPROVED and ACTIVE (filtered at query time)
  const activePromos = promotions;

  for (const promo of activePromos) {
    let applicable = false;

    if (promo.type === "PRODUCT_DISCOUNT") {
      applicable = promo.productIds.includes(item.productId);
    } else if (promo.type === "CATEGORY_DISCOUNT") {
      applicable = promo.categoryId === item.categoryId;
    } else if (promo.type === "SELLER_SPECIFIC") {
      applicable = promo.sellerId === item.sellerId;
    } else if (promo.type === "SITEWIDE") {
      applicable = true;
    }

    if (!applicable) continue;

    let discountPerUnit = 0;
    if (promo.discountType === "PERCENTAGE") {
      discountPerUnit = (item.sellingPrice * promo.discountValue) / 100;
    } else {
      discountPerUnit = promo.discountValue;
    }

    discountPerUnit = Math.min(discountPerUnit, item.sellingPrice);
    if (discountPerUnit > bestDiscount) {
      bestDiscount = discountPerUnit;
    }
  }

  return Math.max(0, item.sellingPrice - bestDiscount);
}

// ─── Coupon Validation ────────────────────────────────────────────────────────

/**
 * Validate a coupon and calculate discount per seller split order.
 * All validation is server-side.
 *
 * Returns:
 *  - valid: true/false
 *  - error: human-readable message if invalid
 *  - totalDiscount: total discount amount across all seller orders
 *  - perSellerDiscounts: discount amount per sellerId for proportional split
 */
export function validateAndComputeCouponDiscount(
  coupon: CouponForEngine,
  userId: string,
  userUsageCount: number,
  perSellerSubtotals: PerSellerSubtotal[],
  cartItems: CartItemForEngine[]
): CouponValidationResult {
  const now = new Date();

  // Status checks
  if (coupon.status !== "ACTIVE") {
    return { valid: false, error: "This coupon is inactive.", totalDiscount: 0, perSellerDiscounts: [] };
  }
  if (now < coupon.startDate) {
    return { valid: false, error: "This coupon is not valid yet.", totalDiscount: 0, perSellerDiscounts: [] };
  }
  if (now > coupon.endDate) {
    return { valid: false, error: "This coupon has expired.", totalDiscount: 0, perSellerDiscounts: [] };
  }

  // Usage limit checks
  if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit) {
    return { valid: false, error: "This coupon has reached its usage limit.", totalDiscount: 0, perSellerDiscounts: [] };
  }
  if (userUsageCount >= coupon.perUserLimit) {
    return { valid: false, error: "You have already used this coupon the maximum number of times.", totalDiscount: 0, perSellerDiscounts: [] };
  }

  // Minimum order amount check
  const totalCartSubtotal = perSellerSubtotals.reduce((s, p) => s + p.subtotal, 0);
  if (totalCartSubtotal < coupon.minimumOrderAmount) {
    return {
      valid: false,
      error: `Minimum order amount for this coupon is ₹${coupon.minimumOrderAmount.toLocaleString("en-IN")}.`,
      totalDiscount: 0,
      perSellerDiscounts: [],
    };
  }

  // Determine which seller subtotals the coupon applies to
  const eligibleSellerSubtotals = getEligibleSubtotals(coupon, perSellerSubtotals, cartItems);
  const eligibleSubtotal = eligibleSellerSubtotals.reduce((s, p) => s + p.subtotal, 0);

  if (eligibleSubtotal === 0) {
    return {
      valid: false,
      error: "This coupon does not apply to any items in your cart.",
      totalDiscount: 0,
      perSellerDiscounts: [],
    };
  }

  // Calculate raw discount
  let rawDiscount = 0;
  if (coupon.discountType === "PERCENTAGE") {
    rawDiscount = (eligibleSubtotal * coupon.discountValue) / 100;
    if (coupon.maximumDiscount !== null) {
      rawDiscount = Math.min(rawDiscount, coupon.maximumDiscount);
    }
  } else {
    rawDiscount = coupon.discountValue;
  }

  // Clamp discount to eligible subtotal
  rawDiscount = Math.min(rawDiscount, eligibleSubtotal);
  rawDiscount = Math.round(rawDiscount * 100) / 100; // 2 decimal places

  // Distribute discount proportionally across eligible seller orders
  const perSellerDiscounts: CouponDiscountPerSeller[] = distributeDiscountProportionally(
    rawDiscount,
    eligibleSellerSubtotals
  );

  return {
    valid: true,
    totalDiscount: rawDiscount,
    perSellerDiscounts,
  };
}

/**
 * Filter which seller subtotals a coupon applies to based on its target (seller, category, product).
 */
function getEligibleSubtotals(
  coupon: CouponForEngine,
  perSellerSubtotals: PerSellerSubtotal[],
  cartItems: CartItemForEngine[]
): PerSellerSubtotal[] {
  // Sitewide coupon — all sellers eligible
  if (!coupon.sellerId && !coupon.categoryId && !coupon.productId) {
    return perSellerSubtotals;
  }

  // Build eligible subtotals: sum only applicable cart items per seller
  const sellerEligibleSubtotals: Record<string, number> = {};

  for (const item of cartItems) {
    let eligible = false;

    if (coupon.productId) {
      eligible = item.productId === coupon.productId;
    } else if (coupon.categoryId) {
      eligible = item.categoryId === coupon.categoryId;
    } else if (coupon.sellerId) {
      eligible = item.sellerId === coupon.sellerId;
    }

    if (eligible) {
      sellerEligibleSubtotals[item.sellerId] =
        (sellerEligibleSubtotals[item.sellerId] || 0) + item.sellingPrice * item.quantity;
    }
  }

  return Object.entries(sellerEligibleSubtotals).map(([sellerId, subtotal]) => ({
    sellerId,
    subtotal,
  }));
}

/**
 * Proportionally distribute a total discount across seller split orders.
 */
function distributeDiscountProportionally(
  totalDiscount: number,
  sellerSubtotals: PerSellerSubtotal[]
): CouponDiscountPerSeller[] {
  const total = sellerSubtotals.reduce((s, p) => s + p.subtotal, 0);
  if (total === 0) return [];

  let remaining = totalDiscount;
  const result: CouponDiscountPerSeller[] = [];

  sellerSubtotals.forEach((s, idx) => {
    if (idx === sellerSubtotals.length - 1) {
      // Give remaining to last seller to avoid rounding errors
      result.push({ sellerId: s.sellerId, discount: Math.round(remaining * 100) / 100 });
    } else {
      const proportional = Math.round((totalDiscount * (s.subtotal / total)) * 100) / 100;
      result.push({ sellerId: s.sellerId, discount: proportional });
      remaining -= proportional;
    }
  });

  return result;
}
