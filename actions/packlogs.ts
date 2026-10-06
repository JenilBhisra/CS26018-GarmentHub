"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "./audit";
import { addCourierDetails } from "./shipping";
import type { BulkActionResult } from "./bulk";
import { requireSellerProfile } from "@/lib/seller-context";

/**
 * "Pack Orders" — bundles selected New orders (PENDING/CONFIRMED) into one Pack Log
 * and moves them to PACKED. All-or-nothing: partial batches would leave a Pack Log
 * whose order/qty totals don't match what the seller actually selected.
 */
export async function createPackLogFromOrders(orderIds: string[]): Promise<
  { success: true; packLogId: string; name: string } | { success: false; error: string }
> {
  const ctx = await requireSellerProfile();
  if ("error" in ctx) return { success: false, error: ctx.error };
  const { seller } = ctx;

  if (orderIds.length === 0) {
    return { success: false, error: "Select at least one order to pack." };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const orders = await tx.order.findMany({
        where: { id: { in: orderIds } },
        include: { items: true },
      });

      if (orders.length !== orderIds.length) {
        throw new Error("One or more selected orders could not be found.");
      }
      for (const order of orders) {
        if (order.sellerId !== seller.id) {
          throw new Error(`Order #${order.orderNumber} does not belong to you.`);
        }
        if (order.status !== "PENDING" && order.status !== "CONFIRMED") {
          throw new Error(`Order #${order.orderNumber} is not in New status and cannot be packed.`);
        }
      }

      const totalQty = orders.reduce(
        (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
        0
      );

      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date();
      dayEnd.setHours(23, 59, 59, 999);
      const todaysCount = await tx.packLog.count({
        where: { sellerId: seller.id, createdAt: { gte: dayStart, lte: dayEnd } },
      });
      const dateStr = new Date().toISOString().slice(0, 10);
      const name = `${dateStr}-${todaysCount + 1}`;

      const packLog = await tx.packLog.create({
        data: {
          name,
          sellerId: seller.id,
          status: "OPEN",
          totalQty,
          orderCount: orders.length,
        },
      });

      await tx.order.updateMany({
        where: { id: { in: orderIds } },
        data: { status: "PACKED", packLogId: packLog.id },
      });

      await createAuditLog(
        "PACK_LOG_CREATED",
        "PackLog",
        packLog.id,
        null,
        JSON.stringify({ orderIds, name, totalQty })
      );

      return packLog;
    });

    revalidatePath("/seller/orders");
    revalidatePath("/seller/pack-logs");

    return { success: true, packLogId: result.id, name: result.name };
  } catch (error) {
    console.error("createPackLogFromOrders error:", error);
    const msg = error instanceof Error ? error.message : "Failed to create pack log.";
    return { success: false, error: msg };
  }
}

export async function getPackLogs() {
  const ctx = await requireSellerProfile();
  if ("error" in ctx) return { success: false as const, error: ctx.error };

  const packLogs = await prisma.packLog.findMany({
    where: { sellerId: ctx.seller.id },
    orderBy: { createdAt: "desc" },
  });

  return { success: true as const, packLogs };
}

export async function getPackLogDetail(packLogId: string) {
  const ctx = await requireSellerProfile();
  if ("error" in ctx) return { success: false as const, error: ctx.error };

  const packLog = await prisma.packLog.findUnique({
    where: { id: packLogId },
    include: {
      orders: {
        include: { items: true, user: true, shipment: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!packLog || packLog.sellerId !== ctx.seller.id) {
    return { success: false as const, error: "Pack log not found." };
  }

  return { success: true as const, packLog };
}

/**
 * Only orders still in PACKED (i.e. not yet scanned/dispatched) can be pulled back out
 * of a batch — mirrors OMS Guru's own restriction on removing orders from a pack log.
 */
export async function removeOrderFromPackLog(packLogId: string, orderId: string) {
  const ctx = await requireSellerProfile();
  if ("error" in ctx) return { success: false, error: ctx.error };

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.sellerId !== ctx.seller.id || order.packLogId !== packLogId) {
        throw new Error("Order not found in this pack log.");
      }
      if (order.status !== "PACKED") {
        throw new Error("Only orders still in Packed status can be removed from a pack log.");
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: "CONFIRMED", packLogId: null },
      });

      const remaining = await tx.order.count({ where: { packLogId } });
      const remainingQty = await tx.orderItem.aggregate({
        where: { order: { packLogId } },
        _sum: { quantity: true },
      });
      await tx.packLog.update({
        where: { id: packLogId },
        data: { orderCount: remaining, totalQty: remainingQty._sum.quantity ?? 0 },
      });
    });

    revalidatePath(`/seller/pack-logs/${packLogId}`);
    revalidatePath("/seller/orders");
    return { success: true };
  } catch (error) {
    console.error("removeOrderFromPackLog error:", error);
    const msg = error instanceof Error ? error.message : "Failed to remove order from pack log.";
    return { success: false, error: msg };
  }
}

/**
 * "Dispatch Orders" — Packed -> Ready to Ship. Pure status transition per order,
 * same partial-success shape as the rest of actions/bulk.ts.
 */
export async function bulkMarkReadyToShip(orderIds: string[]): Promise<BulkActionResult> {
  const ctx = await requireSellerProfile();
  if ("error" in ctx) {
    return { success: false, totalProcessed: 0, succeeded: [], failed: orderIds.map((id) => ({ id, error: ctx.error })) };
  }
  const { seller } = ctx;

  const succeeded: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const id of orderIds) {
    try {
      await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({ where: { id } });
        if (!order) throw new Error("Order not found.");
        if (order.sellerId !== seller.id) throw new Error("Forbidden: This order does not belong to you.");
        if (order.status !== "PACKED") throw new Error("Order must be in Packed status to dispatch.");

        await tx.order.update({ where: { id }, data: { status: "READY_TO_SHIP" } });

        await createAuditLog(
          "ORDER_READY_TO_SHIP",
          "Order",
          id,
          null,
          JSON.stringify({ bulk: true })
        );
      });
      succeeded.push(id);
    } catch (err) {
      failed.push({ id, error: err instanceof Error ? err.message : "Failed to update." });
    }
  }

  revalidatePath("/seller/orders");

  return { success: failed.length === 0, totalProcessed: orderIds.length, succeeded, failed };
}

/**
 * "Confirm Shipment" — Ready to Ship -> Shipped, one courier/AWB entry per order.
 * Reuses the existing single-order addCourierDetails so notification/shipment-record
 * logic isn't duplicated; this just adds bulk iteration + partial-success reporting
 * and closes the Pack Log once every order in it has moved past Ready to Ship.
 */
export async function bulkConfirmShipment(
  entries: { orderId: string; courierName: string; trackingNumber: string; trackingUrl?: string; estimatedDeliveryDate?: string }[]
): Promise<BulkActionResult> {
  const ctx = await requireSellerProfile();
  if ("error" in ctx) {
    return { success: false, totalProcessed: 0, succeeded: [], failed: entries.map((e) => ({ id: e.orderId, error: ctx.error })) };
  }

  const succeeded: string[] = [];
  const failed: { id: string; error: string }[] = [];
  const touchedPackLogIds = new Set<string>();

  for (const entry of entries) {
    try {
      const order = await prisma.order.findUnique({ where: { id: entry.orderId } });
      if (!order) throw new Error("Order not found.");
      if (order.status !== "READY_TO_SHIP") {
        throw new Error("Order must be in Ready to Ship status to confirm shipment.");
      }
      if (order.packLogId) touchedPackLogIds.add(order.packLogId);

      const res = await addCourierDetails(
        entry.orderId,
        entry.courierName,
        entry.trackingNumber,
        entry.trackingUrl,
        entry.estimatedDeliveryDate
      );
      if (!res.success) throw new Error(res.error || "Failed to confirm shipment.");
      succeeded.push(entry.orderId);
    } catch (err) {
      failed.push({ id: entry.orderId, error: err instanceof Error ? err.message : "Failed to confirm shipment." });
    }
  }

  // Close out any Pack Logs where every order has now moved past Ready to Ship.
  for (const packLogId of touchedPackLogIds) {
    const stillOpen = await prisma.order.count({
      where: { packLogId, status: { in: ["PACKED", "READY_TO_SHIP"] } },
    });
    if (stillOpen === 0) {
      await prisma.packLog.update({ where: { id: packLogId }, data: { status: "DISPATCHED" } }).catch(() => {});
    }
  }

  revalidatePath("/seller/orders");
  revalidatePath("/seller/pack-logs");

  return { success: failed.length === 0, totalProcessed: entries.length, succeeded, failed };
}
