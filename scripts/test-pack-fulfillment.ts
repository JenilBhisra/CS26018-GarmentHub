// Standalone integration test for the Pack Log / Scan & Pack / Tag Loop fulfillment workflow.
// Run manually via ts-node (see scripts/test-marketplace-integration.ts for the same pattern).
// Uses real seeded users and cleans up every record it creates on exit.
import "./test-database-guard"; // must stay first: points Prisma at TEST_DATABASE_URL
import { prisma } from "../lib/prisma";
import { setMockSessionForTesting } from "../auth";
import { createPackLogFromOrders, bulkMarkReadyToShip, bulkConfirmShipment, removeOrderFromPackLog } from "../actions/packlogs";
import { scanOrderItem, getTmpBins } from "../actions/scan-pack";

function log(msg: string) {
  console.log(msg);
}

function setMockSession(userId: string, role: string, email: string, name: string) {
  setMockSessionForTesting({ user: { id: userId, role, email, name } });
}

function errorOf(result: unknown): string {
  if (result && typeof result === "object" && "error" in result) {
    return String((result as { error: unknown }).error);
  }
  return "(no error message)";
}

async function runTests() {
  log("=== STARTING PACK FULFILLMENT WORKFLOW TESTS ===");

  const sellerUser = await prisma.user.findUnique({ where: { email: "seller@garmenthub.local" } });
  const customerUser = await prisma.user.findUnique({ where: { email: "customer@garmenthub.local" } });
  if (!sellerUser || !customerUser) {
    throw new Error("Seeded test users (seller, customer) not found. Please run the seed script first.");
  }

  const sellerProfile = await prisma.sellerProfile.findUnique({ where: { userId: sellerUser.id } });
  if (!sellerProfile) throw new Error("Seller profile not found for seller@garmenthub.local");

  const testVariant = await prisma.productVariant.findFirst({ include: { product: true } });
  if (!testVariant) throw new Error("No product variant found in the database.");
  log(`- Using Test Product: "${testVariant.product.name}" (SKU: ${testVariant.sku})`);

  const createdOrderIds: string[] = [];
  let createdPackLogId: string | null = null;

  async function createTestOrder(qty: number, sku: string | null = testVariant!.sku) {
    const orderNumber = `TEST-PACK-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const order = await prisma.order.create({
      data: {
        userId: customerUser!.id,
        sellerId: sellerProfile!.id,
        orderNumber,
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
            quantity: qty,
            price: 500,
            productSnapshot: { name: testVariant!.product.name },
            variantSnapshot: { sku: sku ?? testVariant!.sku, size: testVariant!.size },
          },
        },
      },
    });
    createdOrderIds.push(order.id);
    return order;
  }

  try {
    setMockSession(sellerUser.id, "SELLER", sellerUser.email, sellerUser.name);

    // ----------------------------------------------------
    // TEST CASE 1: Pack Orders creates a Pack Log and moves orders to PACKED
    // ----------------------------------------------------
    log("\n--- TEST CASE 1: Pack Orders -> Pack Log creation ---");
    const orderA = await createTestOrder(1);
    const orderB = await createTestOrder(1);

    const packResult = await createPackLogFromOrders([orderA.id, orderB.id]);
    log(`createPackLogFromOrders result: ${JSON.stringify(packResult)}`);
    if (!packResult.success) throw new Error(`Pack Orders failed: ${errorOf(packResult)}`);
    createdPackLogId = packResult.packLogId;

    const packedOrderA = await prisma.order.findUnique({ where: { id: orderA.id } });
    if (packedOrderA?.status !== "PACKED" || packedOrderA.packLogId !== createdPackLogId) {
      throw new Error("Order was not correctly moved to PACKED with a packLogId.");
    }
    log("Validated both orders moved to PACKED and linked to the new Pack Log.");

    // Re-packing an already-packed order must fail (not New status)
    const rePack = await createPackLogFromOrders([orderA.id]);
    if (rePack.success) throw new Error("Allowed packing an order that is already PACKED!");
    log("Blocked re-packing an already-packed order successfully.");

    // ----------------------------------------------------
    // TEST CASE 2: Scan & Pack — over-scan and wrong-SKU protection
    // ----------------------------------------------------
    log("\n--- TEST CASE 2: Scan & Pack protections ---");
    const sku = testVariant.sku!;

    const scan1 = await scanOrderItem(createdPackLogId, sku, "TAGLOOP-A");
    log(`Scan 1 result: ${JSON.stringify(scan1)}`);
    if (!scan1.success) throw new Error(`First scan failed: ${scan1.error}`);

    const scan2 = await scanOrderItem(createdPackLogId, sku, "TAGLOOP-B");
    log(`Scan 2 result: ${JSON.stringify(scan2)}`);
    if (!scan2.success) throw new Error(`Second scan failed: ${scan2.error}`);

    // Both units of this SKU in the batch are now scanned — a third scan must be rejected (over-scan guard)
    const overScan = await scanOrderItem(createdPackLogId, sku, "TAGLOOP-C");
    if (overScan.success) throw new Error("Over-scan guard failed: allowed scanning more units than ordered!");
    log(`Blocked over-scan successfully: ${overScan.error}`);

    // Wrong/unknown SKU must be rejected
    const wrongSku = await scanOrderItem(createdPackLogId, "NONEXISTENT-SKU-XYZ");
    if (wrongSku.success) throw new Error("Allowed scanning a SKU that isn't part of this pack log!");
    log(`Blocked wrong SKU scan successfully: ${wrongSku.error}`);

    // Duplicate Tag Loop number across different items must be rejected
    const orderC = await createTestOrder(1);
    const rePackWithC = await createPackLogFromOrders([orderC.id]);
    if (!rePackWithC.success) throw new Error(`Pack Orders for order C failed: ${errorOf(rePackWithC)}`);
    const dupTagLoop = await scanOrderItem(rePackWithC.packLogId, sku, "TAGLOOP-A");
    if (dupTagLoop.success) throw new Error("Allowed reusing a Tag Loop number already used on another item!");
    log(`Blocked duplicate Tag Loop number successfully: ${dupTagLoop.error}`);

    const bins = await getTmpBins(createdPackLogId);
    log(`Tmp Bins after scanning: ${JSON.stringify(bins)}`);
    if (!bins.success || bins.scannedCount !== 2 || bins.totalCount !== 2) {
      throw new Error("Tmp Bins scanned/total counts are incorrect after scanning.");
    }
    log("Validated Tmp Bins scanned/total counts successfully.");

    // ----------------------------------------------------
    // TEST CASE 3: Dispatch Orders (bulk) -> READY_TO_SHIP, with partial-success isolation
    // ----------------------------------------------------
    log("\n--- TEST CASE 3: Dispatch Orders bulk partial-success ---");
    const dispatchResult = await bulkMarkReadyToShip([orderA.id, orderB.id, "nonexistent-order-id"]);
    log(`bulkMarkReadyToShip result: ${JSON.stringify(dispatchResult)}`);
    if (dispatchResult.succeeded.length !== 2 || dispatchResult.failed.length !== 1) {
      throw new Error("Bulk dispatch did not correctly isolate the failing order from the succeeding ones.");
    }
    log("Validated bulk partial-success isolation: 2 succeeded, 1 failed independently.");

    const readyOrderA = await prisma.order.findUnique({ where: { id: orderA.id } });
    if (readyOrderA?.status !== "READY_TO_SHIP") throw new Error("Order A was not moved to READY_TO_SHIP.");
    log("Validated Order A is READY_TO_SHIP.");

    // ----------------------------------------------------
    // TEST CASE 4: Confirm Shipment (bulk) -> SHIPPED, and Pack Log closes out
    // ----------------------------------------------------
    log("\n--- TEST CASE 4: Confirm Shipment closes the Pack Log ---");
    const shipResult = await bulkConfirmShipment([
      { orderId: orderA.id, courierName: "Delhivery", trackingNumber: "AWB-TEST-A" },
      { orderId: orderB.id, courierName: "Delhivery", trackingNumber: "AWB-TEST-B" },
    ]);
    log(`bulkConfirmShipment result: ${JSON.stringify(shipResult)}`);
    if (shipResult.succeeded.length !== 2) throw new Error("Bulk confirm shipment did not succeed for both orders.");

    const shippedOrderA = await prisma.order.findUnique({ where: { id: orderA.id } });
    if (shippedOrderA?.status !== "SHIPPED") throw new Error("Order A was not moved to SHIPPED.");

    const packLogAfter = await prisma.packLog.findUnique({ where: { id: createdPackLogId } });
    if (packLogAfter?.status !== "DISPATCHED") {
      throw new Error(`Pack Log did not close out to DISPATCHED once all its orders shipped. Got: ${packLogAfter?.status}`);
    }
    log("Validated Pack Log automatically closed to DISPATCHED once every order in it shipped.");

    // ----------------------------------------------------
    // TEST CASE 5: Remove from Pack Log only allowed while still PACKED
    // ----------------------------------------------------
    log("\n--- TEST CASE 5: Remove-from-pack-log restriction ---");
    const removeShipped = await removeOrderFromPackLog(createdPackLogId, orderA.id);
    if (removeShipped.success) throw new Error("Allowed removing an already-shipped order from its pack log!");
    log(`Blocked removing a non-PACKED order successfully: ${removeShipped.error}`);

    log("\n=== ALL PACK FULFILLMENT TESTS PASSED SUCCESSFULLY ===");
  } finally {
    log("\n--- CLEANING UP TEST RECORDS ---");
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    if (createdPackLogId) {
      await prisma.packLog.deleteMany({ where: { id: createdPackLogId } }).catch(() => {});
    }
    await prisma.packLog.deleteMany({ where: { name: { contains: "-" }, sellerId: sellerProfile!.id, orderCount: 0 } }).catch(() => {});
    setMockSessionForTesting(null);
    log("Cleanup complete.");
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n!!! TEST FAILED:", err);
    process.exit(1);
  });
