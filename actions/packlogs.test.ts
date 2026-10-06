import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { setMockSessionForTesting } from "@/auth";
import { createPackLogFromOrders, bulkMarkReadyToShip, bulkConfirmShipment, removeOrderFromPackLog } from "@/actions/packlogs";
import { scanOrderItem, getTmpBins } from "@/actions/scan-pack";

// Uses real seeded users/data (see prisma/seed.ts) since createPackLogFromOrders and friends
// manage their own internal prisma.$transaction calls rather than accepting an injectable
// transaction client (matching the existing bulkUpdateOrderStatusSeller/markOrderPacked
// pattern in this codebase) — so the ledger.test.ts rollback-transaction trick doesn't apply
// here. Every record this suite creates is deleted in the afterAll cleanup below instead.
const createdOrderIds: string[] = [];
const createdPackLogIds: string[] = [];

afterAll(async () => {
  await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
  await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
  await prisma.packLog.deleteMany({ where: { id: { in: createdPackLogIds } } });
  setMockSessionForTesting(null);
});

describe("Pack Log / Scan & Pack / Tag Loop fulfillment workflow", () => {
  it("packs, scans, dispatches and ships orders with correct guardrails", async () => {
    const sellerUser = await prisma.user.findUnique({ where: { email: "seller@garmenthub.local" } });
    const customerUser = await prisma.user.findUnique({ where: { email: "customer@garmenthub.local" } });
    expect(sellerUser, "Seeded seller user must exist — run the seed script first").toBeTruthy();
    expect(customerUser, "Seeded customer user must exist — run the seed script first").toBeTruthy();

    const sellerProfile = await prisma.sellerProfile.findUnique({ where: { userId: sellerUser!.id } });
    expect(sellerProfile).toBeTruthy();

    const testVariant = await prisma.productVariant.findFirst({ include: { product: true } });
    expect(testVariant, "At least one product variant must exist — run the seed script first").toBeTruthy();

    async function createTestOrder(sku: string) {
      const order = await prisma.order.create({
        data: {
          userId: customerUser!.id,
          sellerId: sellerProfile!.id,
          orderNumber: `VITEST-PACK-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
          subtotal: 500,
          shippingFee: 0,
          platformFee: 15,
          commissionAmount: 50,
          commissionRate: 0.1,
          totalAmount: 515,
          shippingAddress: "Test Address, India",
          shippingState: "Karnataka",
          shippingCity: "Bengaluru",
          shippingPincode: "560034",
          status: "PENDING",
          paymentStatus: "PENDING",
          items: {
            create: {
              variantId: testVariant!.id,
              sellerId: sellerProfile!.id,
              quantity: 1,
              price: 500,
              productSnapshot: { name: testVariant!.product.name },
              variantSnapshot: { sku, size: testVariant!.size },
            },
          },
        },
      });
      createdOrderIds.push(order.id);
      return order;
    }

    setMockSessionForTesting({ user: { id: sellerUser!.id, role: "SELLER", email: sellerUser!.email, name: sellerUser!.name } });

    const sku = testVariant!.sku!;
    const orderA = await createTestOrder(sku);
    const orderB = await createTestOrder(sku);

    // 1. Pack Orders creates a Pack Log and moves both orders to PACKED
    const packResult = await createPackLogFromOrders([orderA.id, orderB.id]);
    expect(packResult.success).toBe(true);
    if (!packResult.success) throw new Error("unreachable");
    createdPackLogIds.push(packResult.packLogId);

    const packedOrderA = await prisma.order.findUnique({ where: { id: orderA.id } });
    expect(packedOrderA?.status).toBe("PACKED");
    expect(packedOrderA?.packLogId).toBe(packResult.packLogId);

    // Re-packing an already-packed order must fail (not New status)
    const rePack = await createPackLogFromOrders([orderA.id]);
    expect(rePack.success).toBe(false);

    // 2. Scan & Pack — both units get scanned with distinct Tag Loop numbers
    const scan1 = await scanOrderItem(packResult.packLogId, sku, "VITEST-TAGLOOP-A");
    expect(scan1.success).toBe(true);
    const scan2 = await scanOrderItem(packResult.packLogId, sku, "VITEST-TAGLOOP-B");
    expect(scan2.success).toBe(true);

    // Over-scan guard: a third scan of a fully-scanned SKU must be rejected
    const overScan = await scanOrderItem(packResult.packLogId, sku, "VITEST-TAGLOOP-C");
    expect(overScan.success).toBe(false);

    // Wrong/unknown SKU must be rejected
    const wrongSku = await scanOrderItem(packResult.packLogId, "NONEXISTENT-SKU-XYZ");
    expect(wrongSku.success).toBe(false);

    // Duplicate Tag Loop number across a different pack log's item must be rejected
    const orderC = await createTestOrder(sku);
    const packC = await createPackLogFromOrders([orderC.id]);
    expect(packC.success).toBe(true);
    if (!packC.success) throw new Error("unreachable");
    createdPackLogIds.push(packC.packLogId);

    const dupTagLoop = await scanOrderItem(packC.packLogId, sku, "VITEST-TAGLOOP-A");
    expect(dupTagLoop.success).toBe(false);

    const bins = await getTmpBins(packResult.packLogId);
    expect(bins.success).toBe(true);
    if (bins.success) {
      expect(bins.scannedCount).toBe(2);
      expect(bins.totalCount).toBe(2);
    }

    // 3. Dispatch Orders (bulk) — Packed -> Ready to Ship, with partial-success isolation
    const dispatchResult = await bulkMarkReadyToShip([orderA.id, orderB.id, "nonexistent-order-id"]);
    expect(dispatchResult.succeeded).toHaveLength(2);
    expect(dispatchResult.failed).toHaveLength(1);

    const readyOrderA = await prisma.order.findUnique({ where: { id: orderA.id } });
    expect(readyOrderA?.status).toBe("READY_TO_SHIP");

    // 4. Confirm Shipment (bulk) — Ready to Ship -> Shipped, and the Pack Log auto-closes
    const shipResult = await bulkConfirmShipment([
      { orderId: orderA.id, courierName: "Delhivery", trackingNumber: "AWB-VITEST-A" },
      { orderId: orderB.id, courierName: "Delhivery", trackingNumber: "AWB-VITEST-B" },
    ]);
    expect(shipResult.succeeded).toHaveLength(2);

    const shippedOrderA = await prisma.order.findUnique({ where: { id: orderA.id } });
    expect(shippedOrderA?.status).toBe("SHIPPED");

    const packLogAfter = await prisma.packLog.findUnique({ where: { id: packResult.packLogId } });
    expect(packLogAfter?.status).toBe("DISPATCHED");

    // 5. Removing an order from its pack log is only allowed while still PACKED
    const removeShipped = await removeOrderFromPackLog(packResult.packLogId, orderA.id);
    expect(removeShipped.success).toBe(false);
  });
});
