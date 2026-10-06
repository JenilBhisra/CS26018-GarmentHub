"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { addToCart } from "@/actions/cart";
import { trackWishlistSync } from "@/actions/analytics";

/**
 * Get current user's session.
 */
async function getSessionUser() {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * Retrieves the user's wishlist items with product relations.
 */
export async function getWishlist() {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: "Please sign in to view your wishlist" };
  }

  try {
    const items = await prisma.wishlist.findMany({
      where: { userId: user.id },
      include: {
        product: {
          include: {
            seller: true,
            category: true,
            variants: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, items };
  } catch (error: unknown) {
    console.error("getWishlist error:", error);
    return { success: false, error: "Failed to fetch wishlist." };
  }
}

/**
 * Toggles a product in the user's wishlist.
 * If user is not authenticated, returns { success: false, unauthorized: true }.
 */
export async function toggleWishlist(productId: string) {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, unauthorized: true, error: "Please sign in to modify wishlist" };
  }

  try {
    const existing = await prisma.wishlist.findUnique({
      where: {
        userId_productId: {
          userId: user.id,
          productId,
        },
      },
    });

    if (existing) {
      await prisma.wishlist.delete({
        where: {
          userId_productId: {
            userId: user.id,
            productId,
          },
        },
      });
      await trackWishlistSync(productId);
      revalidatePath("/account/wishlist");
      revalidatePath(`/product/${productId}`);
      return { success: true, isAdded: false };
    } else {
      await prisma.wishlist.create({
        data: {
          userId: user.id,
          productId,
        },
      });
      await trackWishlistSync(productId);
      revalidatePath("/account/wishlist");
      revalidatePath(`/product/${productId}`);
      return { success: true, isAdded: true };
    }
  } catch (error: unknown) {
    console.error("toggleWishlist error:", error);
    return { success: false, error: "Failed to update wishlist" };
  }
}

/**
 * Removes an item from the wishlist directly.
 */
export async function removeFromWishlist(productId: string) {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await prisma.wishlist.delete({
      where: {
        userId_productId: {
          userId: user.id,
          productId,
        },
      },
    });
    await trackWishlistSync(productId);
    revalidatePath("/account/wishlist");
    revalidatePath(`/product/${productId}`);
    return { success: true };
  } catch (error: unknown) {
    console.error("removeFromWishlist error:", error);
    return { success: false, error: "Failed to remove from wishlist" };
  }
}

/**
 * Get total count of wishlisted items.
 */
export async function getWishlistCount() {
  const user = await getSessionUser();
  if (!user) return 0;

  try {
    return await prisma.wishlist.count({
      where: { userId: user.id },
    });
  } catch (error) {
    console.error("getWishlistCount error:", error);
    return 0;
  }
}

/**
 * Moves an item from wishlist to cart.
 */
export async function moveToCart(productId: string, variantId: string) {
  const user = await getSessionUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // 1. Add to cart
    const cartRes = await addToCart(variantId, 1);
    if (!cartRes.success) {
      return { success: false, error: cartRes.error || "Failed to add to bag" };
    }

    // 2. Remove from wishlist
    await prisma.wishlist.delete({
      where: {
        userId_productId: {
          userId: user.id,
          productId,
        },
      },
    });
    await trackWishlistSync(productId);

    revalidatePath("/account/wishlist");
    revalidatePath("/cart");
    revalidatePath(`/product/${productId}`);
    return { success: true };
  } catch (error: unknown) {
    console.error("moveToCart error:", error);
    return { success: false, error: "Failed to move item to bag" };
  }
}
