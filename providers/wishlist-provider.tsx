"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getWishlist, toggleWishlist as apiToggleWishlist, removeFromWishlist as apiRemoveFromWishlist, moveToCart as apiMoveToCart } from "@/actions/wishlist";
import { useCart } from "@/providers/cart-provider";
import { toast } from "sonner";

interface WishlistContextType {
  wishlistItems: any[];
  wishlistCount: number;
  loading: boolean;
  refreshWishlist: () => Promise<void>;
  toggleWishlistItem: (productId: string) => Promise<{ success: boolean; isAdded?: boolean }>;
  removeFromWishlist: (productId: string) => Promise<{ success: boolean }>;
  moveWishlistItemToCart: (productId: string, variantId: string) => Promise<{ success: boolean }>;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();
  const { refreshCart } = useCart();
  const [wishlistItems, setWishlistItems] = useState<any[]>([]);
  const [wishlistCount, setWishlistCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);

  const refreshWishlist = useCallback(async () => {
    if (status !== "authenticated") {
      setWishlistItems([]);
      setWishlistCount(0);
      return;
    }

    setLoading(true);
    try {
      const res = await getWishlist();
      if (res.success && res.items) {
        setWishlistItems(res.items);
        setWishlistCount(res.items.length);
      } else {
        setWishlistItems([]);
        setWishlistCount(0);
      }
    } catch (err) {
      console.error("refreshWishlist error:", err);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (status === "authenticated") {
        refreshWishlist();
      } else if (status === "unauthenticated") {
        setWishlistItems([]);
        setWishlistCount(0);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [status, refreshWishlist]);

  const toggleWishlistItem = async (productId: string) => {
    if (status !== "authenticated") {
      toast.error("Please sign in to manage your wishlist.");
      router.push("/login");
      return { success: false };
    }

    setLoading(true);
    try {
      const res = await apiToggleWishlist(productId);
      if (res.success) {
        if (res.isAdded) {
          toast.success("Added to wishlist!");
        } else {
          toast.success("Removed from wishlist.");
        }
        await refreshWishlist();
        return { success: true, isAdded: res.isAdded };
      } else {
        if (res.unauthorized) {
          router.push("/login");
        } else {
          toast.error(res.error || "Failed to toggle wishlist");
        }
        return { success: false };
      }
    } catch (err) {
      console.error("toggleWishlistItem error:", err);
      toast.error("An error occurred.");
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const removeFromWishlist = async (productId: string) => {
    setLoading(true);
    try {
      const res = await apiRemoveFromWishlist(productId);
      if (res.success) {
        toast.success("Removed from wishlist.");
        await refreshWishlist();
        return { success: true };
      } else {
        toast.error(res.error || "Failed to remove from wishlist");
        return { success: false };
      }
    } catch (err) {
      console.error("removeFromWishlist error:", err);
      toast.error("An error occurred.");
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const moveWishlistItemToCart = async (productId: string, variantId: string) => {
    setLoading(true);
    try {
      const res = await apiMoveToCart(productId, variantId);
      if (res.success) {
        toast.success("Moved item to bag!");
        await refreshWishlist();
        await refreshCart();
        return { success: true };
      } else {
        toast.error(res.error || "Failed to move item to bag");
        return { success: false };
      }
    } catch (err) {
      console.error("moveWishlistItemToCart error:", err);
      toast.error("An error occurred.");
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlistItems,
        wishlistCount,
        loading,
        refreshWishlist,
        toggleWishlistItem,
        removeFromWishlist,
        moveWishlistItemToCart,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}
