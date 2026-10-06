"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { PayoutStatus, OrderStatus } from "@prisma/client";
import { updatePayoutStatusAdmin } from "./payouts";
import { createAuditLog } from "./audit";
import { requireSellerProfile } from "@/lib/seller-context";

export interface BulkActionResult {
  success: boolean;
  totalProcessed: number;
  succeeded: string[];
  failed: { id: string; error: string }[];
}

/**
 * Bulk Approve KYC requests for Admins.
 */
export async function bulkApproveKycAdmin(kycIds: string[]): Promise<BulkActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, totalProcessed: 0, succeeded: [], failed: kycIds.map(id => ({ id, error: "Unauthorized" })) };
  }

  const succeeded: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const id of kycIds) {
    try {
      await prisma.$transaction(async (tx) => {
        const kyc = await tx.sellerKYC.findUnique({ where: { id } });
        if (!kyc) throw new Error("KYC profile not found.");

        await tx.sellerKYC.update({
          where: { id },
          data: { status: "APPROVED" },
        });

        await createAuditLog(
          "KYC_APPROVED",
          "SellerKYC",
          id,
          null,
          JSON.stringify({ bulk: true, newStatus: "APPROVED" })
        );
      });
      succeeded.push(id);
    } catch (err: any) {
      failed.push({ id, error: err.message || "Failed to update." });
    }
  }

  return {
    success: failed.length === 0,
    totalProcessed: kycIds.length,
    succeeded,
    failed,
  };
}

/**
 * Bulk Approve payout requests (Marks PROCESSING or PAID) for Admins.
 */
export async function bulkApprovePayoutsAdmin(
  payoutIds: string[],
  status: "PROCESSING" | "PAID",
  bankReference?: string,
  notes?: string
): Promise<BulkActionResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, totalProcessed: 0, succeeded: [], failed: payoutIds.map(id => ({ id, error: "Unauthorized" })) };
  }

  // UTR is strictly mandatory for PAID status
  if (status === "PAID" && (!bankReference || bankReference.trim().length === 0)) {
    return {
      success: false,
      totalProcessed: 0,
      succeeded: [],
      failed: payoutIds.map(id => ({ id, error: "Bank UTR reference is mandatory when marking as PAID." })),
    };
  }

  const succeeded: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const id of payoutIds) {
    try {
      // We reuse the core updatePayoutStatusAdmin which handles ledger entries and reserve balances
      const res = await updatePayoutStatusAdmin(id, status, bankReference || undefined, notes || "Bulk payout update");
      if (res.success) {
        succeeded.push(id);
      } else {
        failed.push({ id, error: res.error || "Failed to update status." });
      }
    } catch (err: any) {
      failed.push({ id, error: err.message || "An unexpected error occurred." });
    }
  }

  return {
    success: failed.length === 0,
    totalProcessed: payoutIds.length,
    succeeded,
    failed,
  };
}

/**
 * Bulk update Order status for Sellers (limited to own orders).
 */
export async function bulkUpdateOrderStatusSeller(
  orderIds: string[],
  status: OrderStatus
): Promise<BulkActionResult> {
  const ctx = await requireSellerProfile();
  if ("error" in ctx) {
    return { success: false, totalProcessed: 0, succeeded: [], failed: orderIds.map(id => ({ id, error: ctx.error })) };
  }
  const seller = ctx.seller;

  const succeeded: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const id of orderIds) {
    try {
      await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({ where: { id } });
        if (!order) throw new Error("Order not found.");
        if (order.sellerId !== seller.id) throw new Error("Forbidden: This order does not belong to you.");

        await tx.order.update({
          where: { id },
          data: { status },
        });

        await createAuditLog(
          "ORDER_STATUS_BULK_UPDATE",
          "Order",
          id,
          null,
          JSON.stringify({ bulk: true, newStatus: status })
        );
      });
      succeeded.push(id);
    } catch (err: any) {
      failed.push({ id, error: err.message || "Failed to update." });
    }
  }

  return {
    success: failed.length === 0,
    totalProcessed: orderIds.length,
    succeeded,
    failed,
  };
}

/**
 * Bulk update product inventory stock values for Sellers.
 */
export async function bulkUpdateInventorySeller(
  updates: { variantId: string; stock: number }[]
): Promise<BulkActionResult> {
  const ctx = await requireSellerProfile();
  if ("error" in ctx) {
    return { success: false, totalProcessed: 0, succeeded: [], failed: updates.map(u => ({ id: u.variantId, error: ctx.error })) };
  }
  const seller = ctx.seller;

  const succeeded: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const item of updates) {
    try {
      await prisma.$transaction(async (tx) => {
        const variant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
          include: { product: true },
        });
        if (!variant) throw new Error("Variant not found.");
        if (variant.product.sellerId !== seller.id) throw new Error("Forbidden: This product does not belong to you.");

        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: item.stock },
        });

        await tx.inventoryTransaction.create({
          data: {
            variantId: item.variantId,
            sellerId: seller.id,
            type: "ADJUSTMENT",
            quantityChange: item.stock - variant.stock,
            quantityBefore: variant.stock,
            quantityAfter: item.stock,
            reason: "Manual bulk inventory update",
            actorUserId: seller.userId,
          },
        });

        await createAuditLog(
          "INVENTORY_BULK_UPDATE",
          "ProductVariant",
          item.variantId,
          null,
          JSON.stringify({ bulk: true, newStock: item.stock })
        );
      });
      succeeded.push(item.variantId);
    } catch (err: any) {
      failed.push({ id: item.variantId, error: err.message || "Failed to update stock." });
    }
  }

  return {
    success: failed.length === 0,
    totalProcessed: updates.length,
    succeeded,
    failed,
  };
}
