import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { setMockSessionForTesting } from "@/auth";
import { updateOrderStatus } from "@/actions/orders";
import { bulkUpdateInventorySeller } from "@/actions/bulk";

// Phase C — inventory ledger regression coverage. Like packlogs.test.ts, these actions
// manage their own internal prisma.$transaction calls rather than accepting an injectable
// transaction client, so the ledger.test.ts rollback-transaction trick doesn't apply here.
// Every record this suite creates is deleted in the afterAll cleanup below instead.
//
// The checkout (SALE) ledger path is intentionally NOT covered here — createOrders reads
// a real Cart from the DB rather than accepting cart items as a parameter, so it is more
// realistically exercised end-to-end (via a real browser checkout + direct DB assertions)
// than reconstructed in a unit test. See the Phase A/B/C verification notes.

const createdOrderIds: string[] = [];
const createdSecondSellerUserIds: string[] = [];
const createdInventoryTransactionIds: string[] = [];

afterAll(async () => {
  await prisma.inventoryTransaction.deleteMany({ where: { id: { in: createdInventoryTransactionIds } } });
  await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  for (const userId of createdSecondSellerUserIds) {
    await prisma.sellerProfile.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
  setMockSessionForTesting(null);
});

describe("Inventory ledger — atomic write-alongside-stock-change guarantees", () => {
  it("records a CANCELLATION ledger entry consistent with the stock restored on order cancellation", async () => {
    const sellerUser = await prisma.user.findUnique({ where: { email: "seller@garmenthub.local" } });
    const customerUser = await prisma.user.findUnique({ where: { email: "customer@garmenthub.local" } });
    expect(sellerUser, "Seeded seller user must exist — run the seed script first").toBeTruthy();
    expect(customerUser, "Seeded customer user must exist — run the seed script first").toBeTruthy();

    const sellerProfile = await prisma.sellerProfile.findUnique({ where: { userId: sellerUser!.id } });
    expect(sellerProfile).toBeTruthy();

    const testVariant = await prisma.productVariant.findFirst();
    expect(testVariant, "At least one product variant must exist — run the seed script first").toBeTruthy();

    const stockBeforeOrder = testVariant!.stock;
    const quantity = 2;

    const order = await prisma.order.create({
      data: {
        userId: customerUser!.id,
        sellerId: sellerProfile!.id,
        orderNumber: `VITEST-LEDGER-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        subtotal: 500,
        shippingFee: 0,
        platformFee: 15,
        commissionAmount: 50,
        commissionRate: 0.1,
        totalAmount: 515,
        shippingAddress: "Test Address, India",
        status: "CONFIRMED",
        paymentStatus: "PAID",
        items: {
          create: {
            variantId: testVariant!.id,
            sellerId: sellerProfile!.id,
            quantity,
            price: 250,
            productSnapshot: { name: "Test Product" },
            variantSnapshot: { sku: testVariant!.sku },
          },
        },
      },
    });
    createdOrderIds.push(order.id);

    // Mirror what checkout would already have done: decrement stock for the reserved quantity.
    await prisma.productVariant.update({
      where: { id: testVariant!.id },
      data: { stock: { decrement: quantity } },
    });

    setMockSessionForTesting({ user: { id: sellerUser!.id, role: "SELLER", email: sellerUser!.email, name: sellerUser!.name } });

    const result = await updateOrderStatus(order.id, "CANCELLED");
    expect(result.success).toBe(true);

    const variantAfter = await prisma.productVariant.findUnique({ where: { id: testVariant!.id } });
    expect(variantAfter!.stock).toBe(stockBeforeOrder); // fully restored

    const orderItem = await prisma.orderItem.findFirst({ where: { orderId: order.id } });
    const ledgerEntry = await prisma.inventoryTransaction.findFirst({
      where: { orderId: order.id, type: "CANCELLATION" },
    });
    expect(ledgerEntry).toBeTruthy();
    if (ledgerEntry) createdInventoryTransactionIds.push(ledgerEntry.id);

    expect(ledgerEntry?.variantId).toBe(testVariant!.id);
    expect(ledgerEntry?.orderItemId).toBe(orderItem?.id);
    expect(ledgerEntry?.quantityChange).toBe(quantity);
    expect(ledgerEntry?.quantityBefore).toBe(stockBeforeOrder - quantity);
    expect(ledgerEntry?.quantityAfter).toBe(stockBeforeOrder);
    expect(ledgerEntry?.reference).toBe(`orderitem:${orderItem?.id}:cancellation`);
  });

  it("records an ADJUSTMENT ledger entry for a seller's manual bulk stock update, scoped to their own variants", async () => {
    const sellerUser = await prisma.user.findUnique({ where: { email: "seller@garmenthub.local" } });
    const sellerProfile = await prisma.sellerProfile.findUnique({ where: { userId: sellerUser!.id } });
    expect(sellerProfile).toBeTruthy();

    // Must be a variant this seller actually owns — bulkUpdateInventorySeller enforces
    // product-level ownership, unlike the CANCELLATION test above which assigns sellerId
    // directly on a hand-built Order and so doesn't depend on catalog ownership.
    const testVariant = await prisma.productVariant.findFirst({
      where: { product: { sellerId: sellerProfile!.id } },
      include: { product: true },
    });
    expect(testVariant, "Seeded seller must own at least one product variant — run the seed script first").toBeTruthy();

    const stockBefore = testVariant!.stock;
    const newStock = stockBefore + 7;

    setMockSessionForTesting({ user: { id: sellerUser!.id, role: "SELLER", email: sellerUser!.email, name: sellerUser!.name } });

    const result = await bulkUpdateInventorySeller([{ variantId: testVariant!.id, stock: newStock }]);
    expect(result.succeeded).toEqual([testVariant!.id]);

    const ledgerEntry = await prisma.inventoryTransaction.findFirst({
      where: { variantId: testVariant!.id, type: "ADJUSTMENT", quantityAfter: newStock },
      orderBy: { createdAt: "desc" },
    });
    expect(ledgerEntry).toBeTruthy();
    if (ledgerEntry) createdInventoryTransactionIds.push(ledgerEntry.id);

    expect(ledgerEntry?.quantityChange).toBe(newStock - stockBefore);
    expect(ledgerEntry?.quantityBefore).toBe(stockBefore);
    expect(ledgerEntry?.actorUserId).toBe(sellerUser!.id);

    // Restore original stock so this test is repeatable and doesn't leak state.
    await prisma.productVariant.update({ where: { id: testVariant!.id }, data: { stock: stockBefore } });
  });

  it("rejects a bulk inventory adjustment from a seller who does not own the variant (isolation regression)", async () => {
    const testVariant = await prisma.productVariant.findFirst({ include: { product: true } });
    expect(testVariant).toBeTruthy();

    const otherSellerUser = await prisma.user.create({
      data: {
        email: `vitest-other-seller-${Date.now()}@garmenthub.local`,
        name: "Vitest Other Seller",
        role: "SELLER",
      },
    });
    createdSecondSellerUserIds.push(otherSellerUser.id);

    const otherSellerProfile = await prisma.sellerProfile.create({
      data: {
        userId: otherSellerUser.id,
        storeName: `Vitest Other Store ${Date.now()}`,
        storeSlug: `vitest-other-store-${Date.now()}`,
        pickupAddress: "Nowhere",
        approvalStatus: "APPROVED",
      },
    });
    expect(otherSellerProfile.id).not.toBe(testVariant!.product.sellerId);

    setMockSessionForTesting({ user: { id: otherSellerUser.id, role: "SELLER", email: otherSellerUser.email, name: otherSellerUser.name } });

    const result = await bulkUpdateInventorySeller([{ variantId: testVariant!.id, stock: 999 }]);
    expect(result.succeeded).toHaveLength(0);
    expect(result.failed[0]?.error).toMatch(/does not belong to you/i);

    const noLedgerEntry = await prisma.inventoryTransaction.findFirst({
      where: { variantId: testVariant!.id, quantityAfter: 999 },
    });
    expect(noLedgerEntry).toBeNull();
  });
});
