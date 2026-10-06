"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireSellerProfile } from "@/lib/seller-context";

function itemSku(variantSnapshot: unknown): string {
  if (variantSnapshot && typeof variantSnapshot === "object" && "sku" in variantSnapshot) {
    return String((variantSnapshot as { sku?: unknown }).sku ?? "").trim();
  }
  return "";
}

async function assertOwnedOpenPackLog(packLogId: string, sellerId: string) {
  const packLog = await prisma.packLog.findUnique({ where: { id: packLogId } });
  if (!packLog || packLog.sellerId !== sellerId) {
    throw new Error("Pack log not found.");
  }
  return packLog;
}

/**
 * Scan (or manually enter) one unit's SKU during Scan & Pack. Matches against the
 * frozen SKU on an unscanned OrderItem belonging to this pack log — prevents scanning
 * more units of a SKU than were actually ordered in this batch, and enforces the
 * Tag Loop number is unique per physical tag (never reused across items).
 */
export async function scanOrderItem(packLogId: string, skuCode: string, tagLoopNumber?: string) {
  const ctx = await requireSellerProfile();
  if ("error" in ctx) return { success: false, error: ctx.error };
  const { seller } = ctx;

  const trimmedSku = skuCode.trim();
  if (!trimmedSku) {
    return { success: false, error: "Enter or scan a SKU code." };
  }

  try {
    await assertOwnedOpenPackLog(packLogId, seller.id);

    const result = await prisma.$transaction(async (tx) => {
      const items = await tx.orderItem.findMany({
        where: { order: { packLogId } },
      });

      const candidate = items.find(
        (it) => !it.scannedAt && itemSku(it.variantSnapshot).toLowerCase() === trimmedSku.toLowerCase()
      );

      if (!candidate) {
        const anyForSku = items.some((it) => itemSku(it.variantSnapshot).toLowerCase() === trimmedSku.toLowerCase());
        throw new Error(
          anyForSku
            ? `All units of SKU "${trimmedSku}" in this batch are already scanned.`
            : `SKU "${trimmedSku}" is not part of this pack log.`
        );
      }

      const bins = await computeTmpBinsFromItems(items);
      const bin = bins.find((b) => b.sku.toLowerCase() === trimmedSku.toLowerCase());

      try {
        const updated = await tx.orderItem.update({
          where: { id: candidate.id },
          data: {
            scannedAt: new Date(),
            binLabel: bin?.binLabel ?? null,
            tagLoopNumber: tagLoopNumber?.trim() || null,
          },
        });
        return updated;
      } catch (err: unknown) {
        if (err && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002") {
          throw new Error(`Tag Loop number "${tagLoopNumber}" has already been used on another item.`);
        }
        throw err;
      }
    });

    revalidatePath(`/seller/pack-logs/${packLogId}/scan`);
    return { success: true, orderItemId: result.id, binLabel: result.binLabel };
  } catch (error) {
    console.error("scanOrderItem error:", error);
    const msg = error instanceof Error ? error.message : "Failed to record scan.";
    return { success: false, error: msg };
  }
}

interface TmpBinRow {
  binLabel: string;
  sku: string;
  productName: string;
  scanned: number;
  max: number;
  remaining: number;
}

async function computeTmpBinsFromItems(
  items: { id: string; scannedAt: Date | null; variantSnapshot: unknown; productSnapshot: unknown; quantity: number }[]
): Promise<TmpBinRow[]> {
  const bySku = new Map<string, { productName: string; scanned: number; max: number }>();

  for (const item of items) {
    const sku = itemSku(item.variantSnapshot) || "UNKNOWN";
    const name =
      item.productSnapshot && typeof item.productSnapshot === "object" && "name" in item.productSnapshot
        ? String((item.productSnapshot as { name?: unknown }).name ?? "")
        : "";

    const entry = bySku.get(sku) ?? { productName: name, scanned: 0, max: 0 };
    entry.max += item.quantity;
    if (item.scannedAt) entry.scanned += item.quantity;
    bySku.set(sku, entry);
  }

  const sortedSkus = Array.from(bySku.keys()).sort((a, b) => a.localeCompare(b));

  return sortedSkus.map((sku, idx) => {
    const entry = bySku.get(sku)!;
    return {
      binLabel: `B${String(idx + 1).padStart(2, "0")}`,
      sku,
      productName: entry.productName,
      scanned: entry.scanned,
      max: entry.max,
      remaining: entry.max - entry.scanned,
    };
  });
}

export async function getTmpBins(packLogId: string) {
  const ctx = await requireSellerProfile();
  if ("error" in ctx) return { success: false as const, error: ctx.error };

  try {
    await assertOwnedOpenPackLog(packLogId, ctx.seller.id);
    const items = await prisma.orderItem.findMany({ where: { order: { packLogId } } });
    const bins = await computeTmpBinsFromItems(items);
    const scannedCount = items.filter((i) => i.scannedAt).length;

    return { success: true as const, bins, scannedCount, totalCount: items.length };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to load bins.";
    return { success: false as const, error: msg };
  }
}
