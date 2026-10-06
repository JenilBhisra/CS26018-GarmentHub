import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { setMockSessionForTesting } from "@/auth";
import { updateProduct } from "@/actions/products";

// Phase C.1 — closes the Product Edit -> Inventory Ledger gap. Like the other action
// test suites in this codebase, updateProduct manages its own internal prisma.$transaction
// rather than accepting an injectable transaction client, so the ledger.test.ts
// rollback-transaction trick doesn't apply here. State mutated by these tests is restored
// explicitly instead.

const createdInventoryTransactionIds: string[] = [];
const restoreStock: { variantId: string; stock: number }[] = [];

afterAll(async () => {
  await prisma.inventoryTransaction.deleteMany({ where: { id: { in: createdInventoryTransactionIds } } });
  for (const { variantId, stock } of restoreStock) {
    await prisma.productVariant.update({ where: { id: variantId }, data: { stock } }).catch(() => {});
  }
  setMockSessionForTesting(null);
});

function buildUpdateFormData(product: {
  name: string;
  categoryId: string;
  brand: string;
  description: string | null;
}, variants: { id: string; sku: string | null; size: string | null; color: string | null; sellingPrice: unknown; stock: number }[]) {
  const fd = new FormData();
  fd.set("name", product.name);
  fd.set("categoryId", product.categoryId);
  fd.set("brand", product.brand);
  fd.set("description", product.description || "");
  fd.set("status", "DRAFT");
  fd.set(
    "variants",
    JSON.stringify(
      variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        size: v.size,
        color: v.color,
        price: Number(v.sellingPrice),
        stock: v.stock,
        images: [],
      }))
    )
  );
  return fd;
}

describe("Product Edit -> Inventory Ledger", () => {
  it("records an ADJUSTMENT ledger entry when stock increases via product edit", async () => {
    const sellerUser = await prisma.user.findUnique({ where: { email: "seller@garmenthub.local" } });
    const sellerProfile = await prisma.sellerProfile.findUnique({ where: { userId: sellerUser!.id } });
    const variant = await prisma.productVariant.findFirst({
      where: { product: { sellerId: sellerProfile!.id } },
      include: { product: true },
    });
    expect(variant, "Seeded seller must own at least one product variant").toBeTruthy();
    restoreStock.push({ variantId: variant!.id, stock: variant!.stock });

    const stockBefore = variant!.stock;
    const newStock = stockBefore + 20;

    setMockSessionForTesting({ user: { id: sellerUser!.id, role: "SELLER", email: sellerUser!.email, name: sellerUser!.name } });

    const fd = buildUpdateFormData(variant!.product, [{ ...variant!, stock: newStock }]);
    const result = await updateProduct(variant!.productId, fd);
    expect(result.success, JSON.stringify(result)).toBe(true);

    const updatedVariant = await prisma.productVariant.findUnique({ where: { id: variant!.id } });
    expect(updatedVariant!.stock).toBe(newStock);

    const ledgerEntry = await prisma.inventoryTransaction.findFirst({
      where: { variantId: variant!.id, type: "ADJUSTMENT", quantityAfter: newStock },
      orderBy: { createdAt: "desc" },
    });
    expect(ledgerEntry).toBeTruthy();
    if (ledgerEntry) createdInventoryTransactionIds.push(ledgerEntry.id);
    expect(ledgerEntry?.quantityChange).toBe(20);
    expect(ledgerEntry?.quantityBefore).toBe(stockBefore);
    expect(ledgerEntry?.actorUserId).toBe(sellerUser!.id);
  });

  it("records an ADJUSTMENT ledger entry when stock decreases via product edit", async () => {
    const sellerUser = await prisma.user.findUnique({ where: { email: "seller@garmenthub.local" } });
    const sellerProfile = await prisma.sellerProfile.findUnique({ where: { userId: sellerUser!.id } });
    const variant = await prisma.productVariant.findFirst({
      where: { product: { sellerId: sellerProfile!.id }, stock: { gte: 10 } },
      include: { product: true },
    });
    expect(variant, "Seeded seller must own a variant with stock >= 10").toBeTruthy();
    restoreStock.push({ variantId: variant!.id, stock: variant!.stock });

    const stockBefore = variant!.stock;
    const newStock = stockBefore - 10;

    setMockSessionForTesting({ user: { id: sellerUser!.id, role: "SELLER", email: sellerUser!.email, name: sellerUser!.name } });

    const fd = buildUpdateFormData(variant!.product, [{ ...variant!, stock: newStock }]);
    const result = await updateProduct(variant!.productId, fd);
    expect(result.success, JSON.stringify(result)).toBe(true);

    const ledgerEntry = await prisma.inventoryTransaction.findFirst({
      where: { variantId: variant!.id, type: "ADJUSTMENT", quantityAfter: newStock },
      orderBy: { createdAt: "desc" },
    });
    expect(ledgerEntry).toBeTruthy();
    if (ledgerEntry) createdInventoryTransactionIds.push(ledgerEntry.id);
    expect(ledgerEntry?.quantityChange).toBe(-10);
    expect(ledgerEntry?.quantityBefore).toBe(stockBefore);
  });

  it("does NOT create a ledger entry when stock is submitted unchanged", async () => {
    const sellerUser = await prisma.user.findUnique({ where: { email: "seller@garmenthub.local" } });
    const sellerProfile = await prisma.sellerProfile.findUnique({ where: { userId: sellerUser!.id } });
    const variant = await prisma.productVariant.findFirst({
      where: { product: { sellerId: sellerProfile!.id } },
      include: { product: true },
    });
    expect(variant).toBeTruthy();

    setMockSessionForTesting({ user: { id: sellerUser!.id, role: "SELLER", email: sellerUser!.email, name: sellerUser!.name } });

    const beforeCount = await prisma.inventoryTransaction.count({ where: { variantId: variant!.id } });

    const fd = buildUpdateFormData(variant!.product, [{ ...variant!, stock: variant!.stock }]);
    const result = await updateProduct(variant!.productId, fd);
    expect(result.success, JSON.stringify(result)).toBe(true);

    const afterCount = await prisma.inventoryTransaction.count({ where: { variantId: variant!.id } });
    expect(afterCount).toBe(beforeCount);
  });

  it("rejects an attempt to edit a variant belonging to a different seller's product (isolation regression)", async () => {
    const sellerUser = await prisma.user.findUnique({ where: { email: "seller@garmenthub.local" } });
    const sellerProfile = await prisma.sellerProfile.findUnique({ where: { userId: sellerUser!.id } });
    const ownVariant = await prisma.productVariant.findFirst({
      where: { product: { sellerId: sellerProfile!.id } },
      include: { product: true },
    });
    expect(ownVariant).toBeTruthy();

    // A variant that belongs to a DIFFERENT product/seller entirely.
    const foreignVariant = await prisma.productVariant.findFirst({
      where: { productId: { not: ownVariant!.productId } },
      include: { product: true },
    });
    expect(foreignVariant, "Need a second seller's product variant in seed data").toBeTruthy();
    expect(foreignVariant!.product.sellerId).not.toBe(sellerProfile!.id);

    const foreignStockBefore = foreignVariant!.stock;

    setMockSessionForTesting({ user: { id: sellerUser!.id, role: "SELLER", email: sellerUser!.email, name: sellerUser!.name } });

    // Submit an edit to the seller's OWN product, but smuggle in the foreign variant's id.
    const fd = buildUpdateFormData(ownVariant!.product, [{ ...foreignVariant!, id: foreignVariant!.id, stock: foreignVariant!.stock + 999 }]);
    const result = await updateProduct(ownVariant!.productId, fd);
    expect(result.success).toBe(false);

    const foreignVariantAfter = await prisma.productVariant.findUnique({ where: { id: foreignVariant!.id } });
    expect(foreignVariantAfter!.stock).toBe(foreignStockBefore);

    const noLedgerEntry = await prisma.inventoryTransaction.findFirst({
      where: { variantId: foreignVariant!.id, quantityAfter: foreignStockBefore + 999 },
    });
    expect(noLedgerEntry).toBeNull();
  });
});
