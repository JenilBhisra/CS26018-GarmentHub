"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { getActivePromotions } from "@/actions/promotions";
import { trackCartAdd } from "@/actions/analytics";
import { applyPromotionToItem, validateAndComputeCouponDiscount, type CartItemForEngine } from "@/lib/promotions-engine";
import type { ActivePromotion } from "@/lib/promotions-engine";
import { serializeDecimals } from "@/lib/serialize";

/**
 * Get current user's session.
 */
async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * Retrieves the user's cart and items including variant and product relations.
 * Also computes promotion-adjusted prices and validates any applied coupon.
 */
export async function getCart() {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: "Please sign in to view your bag" };
  }

  try {
    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    seller: true,
                    category: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!cart) {
      return { success: true, cart: null, promotionPrices: {}, couponInfo: null };
    }

    // Server-side promotion calculation
    let activePromotions: ActivePromotion[] = [];
    try {
      activePromotions = await getActivePromotions();
    } catch {
      // Non-fatal: proceed without promotions
    }

    const promotionPrices: Record<string, number> = {}; // variantId -> effective price
    const cartItemsForEngine: CartItemForEngine[] = [];

    for (const item of cart.items) {
      const engineItem: CartItemForEngine = {
        variantId: item.variantId,
        productId: item.variant.productId,
        sellerId: item.variant.product.sellerId,
        categoryId: item.variant.product.categoryId,
        sellingPrice: Number(item.variant.sellingPrice),
        quantity: item.quantity,
      };
      cartItemsForEngine.push(engineItem);

      const effectivePrice = applyPromotionToItem(engineItem, activePromotions);
      promotionPrices[item.variantId] = effectivePrice;
    }

    // Coupon validation (preview only — full validation happens at checkout)
    let couponInfo: {
      code: string;
      description: string | null;
      valid: boolean;
      error?: string;
      totalDiscount: number;
    } | null = null;

    if (cart.appliedCouponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: cart.appliedCouponCode },
      });

      if (coupon) {
        // Build per-seller subtotals with promotion prices applied
        const perSellerSubtotals: Record<string, number> = {};
        for (const item of cartItemsForEngine) {
          const price = promotionPrices[item.variantId] ?? item.sellingPrice;
          perSellerSubtotals[item.sellerId] = (perSellerSubtotals[item.sellerId] || 0) + price * item.quantity;
        }

        const userUsageCount = await prisma.couponUsage.count({
          where: { couponId: coupon.id, userId: user.id },
        });

        const result = validateAndComputeCouponDiscount(
          {
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
          },
          user.id,
          userUsageCount,
          Object.entries(perSellerSubtotals).map(([sellerId, subtotal]) => ({ sellerId, subtotal })),
          cartItemsForEngine
        );

        couponInfo = {
          code: coupon.code,
          description: coupon.description,
          valid: result.valid,
          error: result.error,
          totalDiscount: result.totalDiscount,
        };
      } else {
        // Code no longer valid — clear it
        await prisma.cart.update({
          where: { id: cart.id },
          data: { appliedCouponCode: null },
        });
      }
    }

    return { success: true, cart: serializeDecimals(cart), promotionPrices, couponInfo };
  } catch (error: unknown) {
    console.error("getCart error:", error);
    return { success: false, error: "Failed to fetch cart." };
  }
}

/**
 * Get total quantity of items in the user's cart.
 */
export async function getCartCount() {
  const user = await getSessionUser();
  if (!user) return 0;

  try {
    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
      include: {
        items: true,
      },
    });

    if (!cart) return 0;
    return cart.items.reduce((sum, item) => sum + item.quantity, 0);
  } catch (error) {
    console.error("getCartCount error:", error);
    return 0;
  }
}

/**
 * Adds an item to the cart. Validates that the product is ACTIVE and has sufficient stock.
 */
export async function addToCart(variantId: string, quantity: number) {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: "Please sign in to add items to your bag" };
  }

  if (quantity <= 0) {
    return { success: false, error: "Quantity must be at least 1." };
  }

  try {
    // 1. Fetch variant and product status/stock
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: true,
      },
    });

    if (!variant) {
      return { success: false, error: "Product variant not found" };
    }

    // Rule: Only ACTIVE products can be added to cart. Draft/pending/rejected products cannot be purchased.
    if (variant.product.status !== "ACTIVE") {
      return { success: false, error: "This product is not active or available for purchase" };
    }

    // 2. Fetch or create cart
    let cart = await prisma.cart.findUnique({
      where: { userId: user.id },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId: user.id },
      });
    }

    // 3. Check if variant already in cart
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        variantId,
      },
    });

    const targetQuantity = existingItem
      ? existingItem.quantity + quantity
      : quantity;

    // Rule: Stock checks
    if (variant.stock < targetQuantity) {
      return {
        success: false,
        error: `Insufficient stock. Only ${variant.stock} units available.`,
      };
    }

    if (existingItem) {
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: targetQuantity },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          variantId,
          quantity,
        },
      });
    }
    
    await trackCartAdd(variant.productId, quantity);

    revalidatePath("/cart");
    return { success: true };
  } catch (error: unknown) {
    console.error("addToCart error:", error);
    return { success: false, error: "Failed to add item to bag" };
  }
}

/**
 * Updates the quantity of a cart item.
 */
export async function updateCartItemQuantity(cartItemId: string, quantity: number) {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  if (quantity <= 0) {
    // Delete item if quantity is 0 or less
    return await removeFromCart(cartItemId);
  }

  try {
    const item = await prisma.cartItem.findUnique({
      where: { id: cartItemId },
      include: {
        cart: true,
        variant: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!item) {
      return { success: false, error: "Cart item not found" };
    }

    // Owner check
    if (item.cart.userId !== user.id) {
      return { success: false, error: "Forbidden" };
    }

    // Rule: Only ACTIVE products
    if (item.variant.product.status !== "ACTIVE") {
      return { success: false, error: "This product is no longer active for purchase" };
    }

    // Stock check
    if (item.variant.stock < quantity) {
      return {
        success: false,
        error: `Only ${item.variant.stock} units are in stock.`,
      };
    }

    await prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity },
    });

    revalidatePath("/cart");
    return { success: true };
  } catch (error: unknown) {
    console.error("updateCartItemQuantity error:", error);
    return { success: false, error: "Failed to update quantity" };
  }
}

/**
 * Removes an item from the cart.
 */
export async function removeFromCart(cartItemId: string) {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const item = await prisma.cartItem.findUnique({
      where: { id: cartItemId },
      include: { cart: true },
    });

    if (!item) {
      return { success: false, error: "Cart item not found" };
    }

    if (item.cart.userId !== user.id) {
      return { success: false, error: "Forbidden" };
    }

    await prisma.cartItem.delete({
      where: { id: cartItemId },
    });

    revalidatePath("/cart");
    return { success: true };
  } catch (error: unknown) {
    console.error("removeFromCart error:", error);
    return { success: false, error: "Failed to remove item" };
  }
}
