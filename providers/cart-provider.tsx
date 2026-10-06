"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { getCart, addToCart as apiAddToCart, updateCartItemQuantity as apiUpdateQuantity, removeFromCart as apiRemoveFromCart } from "@/actions/cart";
import { toast } from "sonner";
import type { Cart, CartItem, ProductVariant, Product, SellerProfile } from "@prisma/client";

export type CartItemWithRelations = CartItem & {
  variant: ProductVariant & {
    product: Product & {
      seller: SellerProfile;
    };
  };
};

export type CartWithRelations = Cart & {
  items: CartItemWithRelations[];
};

export interface CouponInfo {
  code: string;
  description: string | null;
  valid: boolean;
  error?: string;
  totalDiscount: number;
}

interface CartContextType {
  cart: CartWithRelations | null;
  cartItemsCount: number;
  loading: boolean;
  promotionPrices: Record<string, number>; // variantId -> effective price after promotions
  couponInfo: CouponInfo | null;
  refreshCart: () => Promise<void>;
  addToCart: (variantId: string, quantity: number) => Promise<{ success: boolean; error?: string }>;
  updateQuantity: (cartItemId: string, quantity: number) => Promise<{ success: boolean; error?: string }>;
  removeFromCart: (cartItemId: string) => Promise<{ success: boolean; error?: string }>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [cart, setCart] = useState<CartWithRelations | null>(null);
  const [cartItemsCount, setCartItemsCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [promotionPrices, setPromotionPrices] = useState<Record<string, number>>({});
  const [couponInfo, setCouponInfo] = useState<CouponInfo | null>(null);

  const refreshCart = useCallback(async () => {
    if (status !== "authenticated") {
      setCart(null);
      setCartItemsCount(0);
      setPromotionPrices({});
      setCouponInfo(null);
      return;
    }

    setLoading(true);
    try {
      const res = await getCart();
      if (res.success && res.cart) {
        setCart(res.cart as unknown as CartWithRelations);
        const count = (res.cart as unknown as CartWithRelations).items.reduce(
          (sum: number, it: CartItemWithRelations) => sum + it.quantity,
          0
        );
        setCartItemsCount(count);
        setPromotionPrices((res.promotionPrices as Record<string, number>) || {});
        setCouponInfo((res.couponInfo as CouponInfo | null) || null);
      } else {
        setCart(null);
        setCartItemsCount(0);
        setPromotionPrices({});
        setCouponInfo(null);
      }
    } catch (err) {
      console.error("refreshCart error:", err);
    } finally {
      setLoading(false);
    }
  }, [status]);

  // Refreshes whenever authenticated status changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (status === "authenticated") {
        refreshCart();
      } else if (status === "unauthenticated") {
        setCart(null);
        setCartItemsCount(0);
        setPromotionPrices({});
        setCouponInfo(null);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [status, refreshCart]);

  const addToCart = async (variantId: string, quantity: number) => {
    if (status !== "authenticated") {
      toast.error("Please sign in to add items to your bag.");
      return { success: false, error: "Unauthorized" };
    }

    let result: { success: boolean; error?: string } = { success: false, error: "Something went wrong" };
    setLoading(true);
    try {
      const res = await apiAddToCart(variantId, quantity);
      if (res.success) {
        toast.success("Added to bag!");
        await refreshCart();
        result = { success: true };
      } else {
        toast.error(res.error || "Failed to add to bag.");
        result = { success: false, error: res.error };
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred.");
    } finally {
      setLoading(false);
    }
    return result;
  };

  const updateQuantity = async (cartItemId: string, quantity: number) => {
    let result: { success: boolean; error?: string } = { success: false, error: "Something went wrong" };
    setLoading(true);
    try {
      const res = await apiUpdateQuantity(cartItemId, quantity);
      if (res.success) {
        if (quantity <= 0) {
          toast.success("Removed from bag.");
        } else {
          toast.success("Updated quantity.");
        }
        await refreshCart();
        result = { success: true };
      } else {
        toast.error(res.error || "Failed to update.");
        result = { success: false, error: res.error };
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred.");
    } finally {
      setLoading(false);
    }
    return result;
  };

  const removeFromCart = async (cartItemId: string) => {
    let result: { success: boolean; error?: string } = { success: false, error: "Something went wrong" };
    setLoading(true);
    try {
      const res = await apiRemoveFromCart(cartItemId);
      if (res.success) {
        toast.success("Removed from bag.");
        await refreshCart();
        result = { success: true };
      } else {
        toast.error(res.error || "Failed to remove.");
        result = { success: false, error: res.error };
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred.");
    } finally {
      setLoading(false);
    }
    return result;
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        cartItemsCount,
        loading,
        promotionPrices,
        couponInfo,
        refreshCart,
        addToCart,
        updateQuantity,
        removeFromCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
