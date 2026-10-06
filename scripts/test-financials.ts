import "./test-database-guard"; // must stay first: points Prisma at TEST_DATABASE_URL
import { prisma } from "../lib/prisma";
import { handleOrderDeliveredWallet, releasePendingBalances, ensureSellerWallet } from "../actions/wallets";
import { requestPayout, updatePayoutStatusAdmin } from "../actions/payouts";
import { requestReturn, finalizeRefundAdmin } from "../actions/returns";
import { setMockSessionForTesting } from "../auth";
import { Prisma } from "@prisma/client";
import { executeGlobalSearch } from "../actions/search";
import { bulkApproveKycAdmin, bulkApprovePayoutsAdmin } from "../actions/bulk";

const Decimal = Prisma.Decimal;

async function runTests() {
  console.log("----------------------------------------------------------------");
  console.log("             GARMENTHUB FINANCIAL INTEGRITY TESTS               ");
  console.log("----------------------------------------------------------------");

  let testSellerId = "";
  let testCustomerId = "";
  let testAdminId = "";

  try {
    // 1. Setup/Lookup test users
    console.log("1. Setting up database test mock users...");
    let admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          email: "admin.test@garmenthub.com",
          name: "Test Admin",
          role: "ADMIN",
        },
      });
    }
    testAdminId = admin.id;

    let sellerUser = await prisma.user.findFirst({ where: { role: "SELLER" } });
    if (!sellerUser) {
      sellerUser = await prisma.user.create({
        data: {
          email: "seller.test@garmenthub.com",
          name: "Test Seller User",
          role: "SELLER",
        },
      });
    }

    let seller = await prisma.sellerProfile.findFirst({ where: { userId: sellerUser.id } });
    if (!seller) {
      seller = await prisma.sellerProfile.create({
        data: {
          userId: sellerUser.id,
          storeName: "Test Store",
          storeSlug: `test-store-${Date.now()}`,
          pickupAddress: "123 Test Street",
          approvalStatus: "APPROVED",
          commissionRate: 0.10, // 10%
          bankAccountHolder: "Test Holder",
          bankAccountNumber: "1234567890",
          bankIFSC: "TEST0001234",
          bankName: "Test Bank",
        },
      });
    } else {
      // Ensure test store is approved and bank accounts are configured for payouts
      await prisma.sellerProfile.update({
        where: { id: seller.id },
        data: {
          approvalStatus: "APPROVED",
          bankAccountHolder: "Test Holder",
          bankAccountNumber: "1234567890",
          bankIFSC: "TEST0001234",
          bankName: "Test Bank",
        },
      });
    }
    testSellerId = seller.id;

    // Ensure KYC is approved
    let kyc = await prisma.sellerKYC.findUnique({ where: { sellerId: seller.id } });
    if (!kyc) {
      await prisma.sellerKYC.create({
        data: {
          sellerId: seller.id,
          status: "APPROVED",
          panNumber: "ABCDE1234F",
          gstNumber: "22AAAAA0000A1Z5",
        },
      });
    } else if (kyc.status !== "APPROVED") {
      await prisma.sellerKYC.update({
        where: { id: kyc.id },
        data: { status: "APPROVED" },
      });
    }

    let customer = await prisma.user.findFirst({ where: { role: "CUSTOMER" } });
    if (!customer) {
      customer = await prisma.user.create({
        data: {
          email: "customer.test@garmenthub.com",
          name: "Test Customer",
          role: "CUSTOMER",
        },
      });
    }
    testCustomerId = customer.id;

    // Reset wallet for test
    console.log("Resetting seller wallet for testing...");
    const wallet = await ensureSellerWallet(testSellerId);
    await prisma.sellerWallet.update({
      where: { id: wallet.id },
      data: {
        availableBalance: new Decimal(0),
        withdrawableBalance: new Decimal(0),
        pendingBalance: new Decimal(0),
        negativeBalance: new Decimal(0),
        reserveBalance: new Decimal(0),
        totalEarned: new Decimal(0),
        totalPaid: new Decimal(0),
        totalRefunded: new Decimal(0),
      },
    });

    // Delete past records to have clean isolated tests
    await prisma.disputeNote.deleteMany();
    await prisma.dispute.deleteMany();
    await prisma.walletAdjustment.deleteMany();
    await prisma.walletTransaction.deleteMany();
    await prisma.ledgerEntry.deleteMany();
    await prisma.payoutRequest.deleteMany();
    await prisma.returnRequest.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.commission.deleteMany();
    await prisma.paymentTransaction.deleteMany();
    await prisma.shipment.deleteMany();
    await prisma.order.deleteMany();

    // Check if there is a variant to use for order items
    const testVariant = await prisma.productVariant.findFirst();
    console.log("Mock setup completed.");

    // 2. Test Earning Flow
    console.log("\n2. Testing Order Earning Ledger Flow...");
    // Create test order
    const orderNumber = `TEST-ORD-${Date.now()}`;
    const testOrder = await prisma.order.create({
      data: {
        userId: testCustomerId,
        sellerId: testSellerId,
        orderNumber,
        subtotal: new Decimal(100),
        shippingFee: new Decimal(15),
        platformFee: new Decimal(5),
        commissionAmount: new Decimal(10), // 10% of 100
        discountAmount: new Decimal(0),
        totalAmount: new Decimal(120), // subtotal + shipping + platformFee
        status: "DELIVERED",
        paymentStatus: "PAID",
        paymentMethod: "COD",
        shippingAddress: "123 Test Road",
      },
    });

    if (testVariant) {
      await prisma.orderItem.create({
        data: {
          order: { connect: { id: testOrder.id } },
          variant: { connect: { id: testVariant.id } },
          sellerId: testSellerId,
          quantity: 1,
          price: new Decimal(100),
          productSnapshot: {},
          variantSnapshot: {},
        },
      });
    }

    // Trigger earning wallet & ledger
    const earnRes = await handleOrderDeliveredWallet(testOrder.id);
    if (!earnRes.success) throw new Error("Order earning failed.");
    console.log("✔ Earning processed successfully. Seller Earning: ₹" + earnRes.sellerEarning?.toString());

    // Verify wallet pending balance is credited
    const wEarning = await prisma.sellerWallet.findUnique({ where: { sellerId: testSellerId } });
    if (!wEarning?.pendingBalance.equals(new Decimal(90))) {
      throw new Error(`Wallet pending balance mismatch: expected 90, got ${wEarning?.pendingBalance.toString()}`);
    }
    console.log("✔ Wallet pending balance holds correct funds (₹90.00).");

    // Verify double-entry ledger entries exist and balance
    const earnEntries = await prisma.ledgerEntry.findMany({
      where: { reference: { startsWith: `earning_order_${testOrder.id}` } },
    });
    if (earnEntries.length === 0) {
      throw new Error("No ledger entries found for the order earning.");
    }
    let sumDebits = new Decimal(0);
    let sumCredits = new Decimal(0);
    for (const ent of earnEntries) {
      sumDebits = sumDebits.plus(ent.debit);
      sumCredits = sumCredits.plus(ent.credit);
    }
    if (!sumDebits.equals(sumCredits) || !sumDebits.equals(new Decimal(120))) {
      throw new Error(`Earning ledger unbalanced: debits=${sumDebits.toString()}, credits=${sumCredits.toString()}`);
    }
    console.log(`✔ Double-entry ledger entries created and balanced perfectly at ₹${sumDebits.toString()}.`);

    // 3. Test Duplicate Order Delivery Protection
    console.log("\n3. Testing Duplicate Order Delivery Protection...");
    const duplicateRes = await handleOrderDeliveredWallet(testOrder.id);
    if (!duplicateRes.success || duplicateRes.message !== "Earning was already processed for this order.") {
      throw new Error("Duplicate delivery check failed: " + JSON.stringify(duplicateRes));
    }
    console.log("✔ Duplicate delivery correctly blocked and handled (idempotent).");

    const wDup = await prisma.sellerWallet.findUnique({ where: { sellerId: testSellerId } });
    if (!wDup?.pendingBalance.equals(new Decimal(90))) {
      throw new Error("Duplicate delivery modified wallet balances!");
    }
    console.log("✔ Wallet balances verified untouched (remained at ₹90.00).");

    // 4. Test Balance Release Flow
    console.log("\n4. Testing Balance Release Flow...");
    // Update the pending release transaction maturity time to allow release
    await prisma.walletTransaction.updateMany({
      where: { sellerWalletId: wallet.id, type: "EARNING" },
      data: { releaseAt: new Date(Date.now() - 10000) },
    });

    const releaseRes = await releasePendingBalances(testSellerId);
    if (!releaseRes.success || releaseRes.count === 0) {
      throw new Error("Earning release failed: " + (releaseRes as any).error);
    }
    console.log(`✔ Released ${releaseRes.count} matured earning transaction of ₹90`);

    // Verify wallet balance moved to withdrawable
    const wReleased = await prisma.sellerWallet.findUnique({ where: { sellerId: testSellerId } });
    if (!wReleased?.pendingBalance.isZero() || !wReleased?.withdrawableBalance.equals(new Decimal(90))) {
      throw new Error(`Balance release wallet mismatch: pending=${wReleased?.pendingBalance.toString()}, withdrawable=${wReleased?.withdrawableBalance.toString()}`);
    }
    console.log("✔ Wallet pending balance zeroed, withdrawable balance credited (₹90.00).");

    // 5. Test Duplicate Release Protection
    console.log("\n5. Testing Duplicate Release Protection...");
    const dupReleaseRes = await releasePendingBalances(testSellerId);
    if (dupReleaseRes.success && dupReleaseRes.count === 0) {
      console.log("✔ Duplicate release correctly skipped (idempotent).");
    } else {
      throw new Error("Duplicate release processed transactions again!");
    }

    // 6. Test Payout holds & approvals
    console.log("\n6. Testing Payout Flow & Protections...");
    // Set seller session to request payout
    setMockSessionForTesting({
      user: {
        id: sellerUser.id,
        role: "SELLER",
      },
    });

    const payoutReqRes = (await requestPayout(40)) as any;
    if (!payoutReqRes.success || !payoutReqRes.payoutId) {
      throw new Error("Payout request failed: " + payoutReqRes.error);
    }
    console.log("✔ Payout request submitted: ₹40.00 held in reserve.");

    // Verify balances
    const wRequested = await prisma.sellerWallet.findUnique({ where: { sellerId: testSellerId } });
    if (!wRequested?.withdrawableBalance.equals(new Decimal(50)) || !wRequested?.reserveBalance.equals(new Decimal(40))) {
      throw new Error("Balances not updated correctly after payout request: withdrawable=" + wRequested?.withdrawableBalance.toString() + ", reserve=" + wRequested?.reserveBalance.toString());
    }
    console.log("✔ Wallet balances verified: Withdrawable ₹50.00, Reserve ₹40.00.");

    // Admin approves payout status (Marks PAID)
    setMockSessionForTesting({
      user: {
        id: admin.id,
        role: "ADMIN",
      },
    });

    const payoutApproveRes = await updatePayoutStatusAdmin(payoutReqRes.payoutId, "PAID", "UTR123456");
    if (!payoutApproveRes.success) {
      throw new Error("Payout approval failed: " + payoutApproveRes.error);
    }
    console.log("✔ Payout approved and marked as PAID (UTR123456).");

    // Verify balances
    const wPaid = await prisma.sellerWallet.findUnique({ where: { sellerId: testSellerId } });
    if (!wPaid?.reserveBalance.isZero() || !wPaid?.withdrawableBalance.equals(new Decimal(50)) || !wPaid?.totalPaid.equals(new Decimal(40))) {
      throw new Error("Payout balances mismatch: reserve=" + wPaid?.reserveBalance.toString() + ", withdrawable=" + wPaid?.withdrawableBalance.toString() + ", totalPaid=" + wPaid?.totalPaid.toString());
    }
    console.log("✔ Wallet balances verified: Withdrawable ₹50.00, Reserve ₹0.00, Total Paid ₹40.00.");

    // 7. Test Refund & Wallet Deductions
    console.log("\n7. Testing Refund Flow & Deductions...");

    // SCENARIO 7.1: Seller Fault Refund
    console.log("   --> Scenario 7.1: Testing Seller Fault Return...");
    // Mock customer session
    setMockSessionForTesting({
      user: {
        id: customer.id,
        role: "CUSTOMER",
      },
    });

    // Create return request (Damaged item -> Seller Fault)
    const returnReqRes1 = await requestReturn(testOrder.id, "Damaged item");
    if (!returnReqRes1.success) {
      throw new Error("Return request 1 failed: " + returnReqRes1.error);
    }
    const returnReq1 = await prisma.returnRequest.findUnique({
      where: { orderId: testOrder.id },
    });
    if (!returnReq1 || returnReq1.reasonCategory !== "SELLER_FAULT" || returnReq1.shippingResponsibility !== "SELLER") {
      throw new Error("Return request 1 classification failed: " + JSON.stringify(returnReq1));
    }
    console.log("   ✔ Reason classification correct: SELLER_FAULT / SELLER");

    // Verify calculated fees
    // Weight = 0.5kg (default), Zone = NATIONAL. base ₹40 * 1.5 multiplier = ₹60 return shipping.
    if (!returnReq1.returnShippingFee.equals(new Decimal(60))) {
      throw new Error("Expected return shipping fee 60, got: " + returnReq1.returnShippingFee.toString());
    }
    // Customer refund: Product (100) + Original Ship (15) = ₹115
    // Seller deduct: Product (100) + Original Ship (15) + Return Ship (60) = ₹175
    if (!returnReq1.customerRefundAmount.equals(new Decimal(115)) || !returnReq1.sellerDeductionAmount.equals(new Decimal(175))) {
      throw new Error(`Deductions calculation mismatch: customerRefund=${returnReq1.customerRefundAmount}, sellerDeduction=${returnReq1.sellerDeductionAmount}`);
    }
    console.log("   ✔ Calculated fees correct: Customer Refund = ₹115.00, Seller Deduction = ₹175.00.");

    // Admin finalizes refund
    setMockSessionForTesting({
      user: {
        id: admin.id,
        role: "ADMIN",
      },
    });
    const finalizeRes1 = await finalizeRefundAdmin(returnReq1.id, "Seller fault verified");
    if (!finalizeRes1.success) {
      throw new Error("Finalize refund 1 failed: " + finalizeRes1.error);
    }
    console.log("   ✔ Refund finalized successfully.");

    // Verify wallet went negative
    const wRefunded1 = await prisma.sellerWallet.findUnique({ where: { sellerId: testSellerId } });
    // Withdrawable was 50. Deducted 175. withdrawable = 0, negative = 175 - 50 = 125.
    if (!wRefunded1?.withdrawableBalance.isZero() || !wRefunded1?.negativeBalance.equals(new Decimal(125))) {
      throw new Error(`Refund 1 wallet mismatch: withdrawable=${wRefunded1?.withdrawableBalance}, negative=${wRefunded1?.negativeBalance}`);
    }
    console.log("   ✔ Wallet negative balance driven to ₹125.00 (debt).");

    // Verify platform commission remains intact
    const platformRevLedger1 = await prisma.ledgerEntry.aggregate({
      _sum: { debit: true, credit: true },
      where: { accountName: "PLATFORM_REVENUE" },
    });
    const totalRev1 = (platformRevLedger1._sum.credit || new Decimal(0)).minus(platformRevLedger1._sum.debit || new Decimal(0));
    if (!totalRev1.equals(new Decimal(10))) {
      throw new Error(`Expected platform commission to remain ₹10.00, but got ₹${totalRev1.toString()}`);
    }
    console.log("   ✔ Verified platform commission remains intact at ₹10.00.");

    // Verify ledger remains perfectly balanced
    const globalLedger1 = await prisma.ledgerEntry.aggregate({
      _sum: { debit: true, credit: true },
    });
    if (!globalLedger1._sum.debit?.equals(globalLedger1._sum.credit || new Decimal(0))) {
      throw new Error(`Ledger unbalanced: debits=${globalLedger1._sum.debit}, credits=${globalLedger1._sum.credit}`);
    }
    console.log("   ✔ Verified ledger remains perfectly balanced.");


    // 8. Test Negative Balance Recovery
    console.log("\n8. Testing Negative Balance Recovery...");
    // Create a new order to release earning and recover negative balance (subtotal 150)
    const orderNumber2 = `TEST-ORD-2-${Date.now()}`;
    const testOrder2 = await prisma.order.create({
      data: {
        userId: testCustomerId,
        sellerId: testSellerId,
        orderNumber: orderNumber2,
        subtotal: new Decimal(150),
        shippingFee: new Decimal(0),
        platformFee: new Decimal(0),
        commissionAmount: new Decimal(15), // 10% of 150
        discountAmount: new Decimal(0),
        totalAmount: new Decimal(150),
        status: "DELIVERED",
        paymentStatus: "PAID",
        paymentMethod: "COD",
        shippingAddress: "123 Test Road",
      },
    });

    if (testVariant) {
      await prisma.orderItem.create({
        data: {
          order: { connect: { id: testOrder2.id } },
          variant: { connect: { id: testVariant.id } },
          sellerId: testSellerId,
          quantity: 1,
          price: new Decimal(150),
          productSnapshot: {},
          variantSnapshot: {},
        },
      });
    }

    // Earning is ₹135. Pending balance gets +₹135.
    const earnRes2 = await handleOrderDeliveredWallet(testOrder2.id);
    if (!earnRes2.success) throw new Error("Order 2 earning failed.");
    console.log("✔ Order 2 earning processed (₹135.00).");

    // Force maturity
    await prisma.walletTransaction.updateMany({
      where: { reference: `earning_order_${testOrder2.id}` },
      data: { releaseAt: new Date(Date.now() - 10000) },
    });

    // Release balance and verify negative balance is offset
    const relRes2 = await releasePendingBalances(testSellerId);
    if (!relRes2.success) throw new Error("Release 2 failed.");
    console.log("✔ Released matured earning. Offsetting negative balance...");

    const wRecovered = await prisma.sellerWallet.findUnique({ where: { sellerId: testSellerId } });
    // Expected: Negative balance was 125. Earning release is 135. 
    // Negative balance becomes 0. Withdrawable balance becomes 135 - 125 = 10.
    if (!wRecovered?.negativeBalance.isZero() || !wRecovered?.withdrawableBalance.equals(new Decimal(10))) {
      throw new Error(`Recovery mismatch: negative=${wRecovered?.negativeBalance.toString()}, withdrawable=${wRecovered?.withdrawableBalance.toString()}`);
    }
    console.log("✔ Negative balance recovered to ₹0.00. Withdrawable balance updated to ₹10.00.");


    // SCENARIO 7.2: Customer Fault Refund
    console.log("\n7.2 Testing Customer Fault Return...");
    // Create Order 3
    const orderNumber3 = `TEST-ORD-3-${Date.now()}`;
    const testOrder3 = await prisma.order.create({
      data: {
        userId: testCustomerId,
        sellerId: testSellerId,
        orderNumber: orderNumber3,
        subtotal: new Decimal(100),
        shippingFee: new Decimal(15),
        platformFee: new Decimal(5),
        commissionAmount: new Decimal(10),
        discountAmount: new Decimal(0),
        totalAmount: new Decimal(120),
        status: "DELIVERED",
        paymentStatus: "PAID",
        paymentMethod: "COD",
        shippingAddress: "123 Test Road",
      },
    });
    if (testVariant) {
      await prisma.orderItem.create({
        data: {
          order: { connect: { id: testOrder3.id } },
          variant: { connect: { id: testVariant.id } },
          sellerId: testSellerId,
          quantity: 1,
          price: new Decimal(100),
          productSnapshot: {},
          variantSnapshot: {},
        },
      });
    }

    // Process Earning (₹90)
    await handleOrderDeliveredWallet(testOrder3.id);
    // Force maturity
    await prisma.walletTransaction.updateMany({
      where: { reference: `earning_order_${testOrder3.id}` },
      data: { releaseAt: new Date(Date.now() - 10000) },
    });
    // Release (withdrawable becomes 10 + 90 = 100)
    await releasePendingBalances(testSellerId);

    // Mock customer session
    setMockSessionForTesting({
      user: {
        id: customer.id,
        role: "CUSTOMER",
      },
    });

    // Create return request (Changed mind -> Customer Fault)
    const returnReqRes2 = await requestReturn(testOrder3.id, "Changed mind");
    if (!returnReqRes2.success) {
      throw new Error("Return request 2 failed: " + returnReqRes2.error);
    }
    const returnReq2 = await prisma.returnRequest.findUnique({
      where: { orderId: testOrder3.id },
    });
    if (!returnReq2 || returnReq2.reasonCategory !== "CUSTOMER_FAULT" || returnReq2.shippingResponsibility !== "CUSTOMER") {
      throw new Error("Return request 2 classification failed: " + JSON.stringify(returnReq2));
    }
    console.log("   ✔ Reason classification correct: CUSTOMER_FAULT / CUSTOMER");

    // Verify calculated fees
    // Weight = 0.5kg, Zone = NATIONAL -> ₹60 return shipping.
    // Customer refund: Product (100) - Return Shipping (60) = ₹40
    // Seller deduct: Product (100)
    if (!returnReq2.customerRefundAmount.equals(new Decimal(40)) || !returnReq2.sellerDeductionAmount.equals(new Decimal(100))) {
      throw new Error(`Deductions calculation mismatch: customerRefund=${returnReq2.customerRefundAmount}, sellerDeduction=${returnReq2.sellerDeductionAmount}`);
    }
    console.log("   ✔ Calculated fees correct: Customer Refund = ₹40.00, Seller Deduction = ₹100.00 (Customer bears ₹60.00 return shipping).");

    // Admin approves
    setMockSessionForTesting({
      user: {
        id: admin.id,
        role: "ADMIN",
      },
    });
    const finalizeRes2 = await finalizeRefundAdmin(returnReq2.id, "Customer fault verified");
    if (!finalizeRes2.success) {
      throw new Error("Finalize refund 2 failed: " + finalizeRes2.error);
    }

    // Verify wallet deduction (withdrawable was 100, deducted 100 -> withdrawable = 0)
    const wRefunded2 = await prisma.sellerWallet.findUnique({ where: { sellerId: testSellerId } });
    if (!wRefunded2?.withdrawableBalance.isZero() || !wRefunded2?.negativeBalance.isZero()) {
      throw new Error(`Refund 2 wallet mismatch: withdrawable=${wRefunded2?.withdrawableBalance}, negative=${wRefunded2?.negativeBalance}`);
    }
    console.log("   ✔ Wallet withdrawable balance zeroed (no negative balance created).");

    // Verify ledger remains balanced
    const globalLedger2 = await prisma.ledgerEntry.aggregate({
      _sum: { debit: true, credit: true },
    });
    if (!globalLedger2._sum.debit?.equals(globalLedger2._sum.credit || new Decimal(0))) {
      throw new Error(`Ledger unbalanced: debits=${globalLedger2._sum.debit}, credits=${globalLedger2._sum.credit}`);
    }
    console.log("   ✔ Verified ledger remains perfectly balanced.");


    // SCENARIO 7.3: Platform Fault Refund
    console.log("\n7.3 Testing Platform Fault Return...");
    // Create Order 4
    const orderNumber4 = `TEST-ORD-4-${Date.now()}`;
    const testOrder4 = await prisma.order.create({
      data: {
        userId: testCustomerId,
        sellerId: testSellerId,
        orderNumber: orderNumber4,
        subtotal: new Decimal(100),
        shippingFee: new Decimal(15),
        platformFee: new Decimal(5),
        commissionAmount: new Decimal(10),
        discountAmount: new Decimal(0),
        totalAmount: new Decimal(120),
        status: "DELIVERED",
        paymentStatus: "PAID",
        paymentMethod: "COD",
        shippingAddress: "123 Test Road",
      },
    });
    if (testVariant) {
      await prisma.orderItem.create({
        data: {
          order: { connect: { id: testOrder4.id } },
          variant: { connect: { id: testVariant.id } },
          sellerId: testSellerId,
          quantity: 1,
          price: new Decimal(100),
          productSnapshot: {},
          variantSnapshot: {},
        },
      });
    }

    // Process Earning (₹90)
    await handleOrderDeliveredWallet(testOrder4.id);
    // Force maturity
    await prisma.walletTransaction.updateMany({
      where: { reference: `earning_order_${testOrder4.id}` },
      data: { releaseAt: new Date(Date.now() - 10000) },
    });
    // Release (withdrawable becomes 0 + 90 = 90)
    await releasePendingBalances(testSellerId);

    // Mock customer session
    setMockSessionForTesting({
      user: {
        id: customer.id,
        role: "CUSTOMER",
      },
    });

    // Create return request (System pricing bug -> Platform Fault)
    const returnReqRes3 = await requestReturn(testOrder4.id, "System pricing bug");
    if (!returnReqRes3.success) {
      throw new Error("Return request 3 failed: " + returnReqRes3.error);
    }
    const returnReq3 = await prisma.returnRequest.findUnique({
      where: { orderId: testOrder4.id },
    });
    if (!returnReq3 || returnReq3.reasonCategory !== "PLATFORM_FAULT" || returnReq3.shippingResponsibility !== "PLATFORM") {
      throw new Error("Return request 3 classification failed: " + JSON.stringify(returnReq3));
    }
    console.log("   ✔ Reason classification correct: PLATFORM_FAULT / PLATFORM");

    // Verify calculated fees
    // Weight = 0.5kg, Zone = NATIONAL -> ₹60 return shipping.
    // Customer refund: Product (100) + Original Shipping (15) = ₹115
    // Seller deduct: 0
    if (!returnReq3.customerRefundAmount.equals(new Decimal(115)) || !returnReq3.sellerDeductionAmount.isZero()) {
      throw new Error(`Deductions calculation mismatch: customerRefund=${returnReq3.customerRefundAmount}, sellerDeduction=${returnReq3.sellerDeductionAmount}`);
    }
    console.log("   ✔ Calculated fees correct: Customer Refund = ₹115.00, Seller Deduction = ₹0.00 (Platform bears ₹175.00 total expense).");

    // Admin approves
    setMockSessionForTesting({
      user: {
        id: admin.id,
        role: "ADMIN",
      },
    });
    const finalizeRes3 = await finalizeRefundAdmin(returnReq3.id, "Platform bug verified");
    if (!finalizeRes3.success) {
      throw new Error("Finalize refund 3 failed: " + finalizeRes3.error);
    }

    // Verify wallet deduction (seller was NOT debited, withdrawable remains ₹90)
    const wRefunded3 = await prisma.sellerWallet.findUnique({ where: { sellerId: testSellerId } });
    if (!wRefunded3?.withdrawableBalance.equals(new Decimal(90))) {
      throw new Error(`Refund 3 wallet mismatch: expected 90, got withdrawable=${wRefunded3?.withdrawableBalance}`);
    }
    console.log("   ✔ Wallet balance verified untouched (remained at ₹90.00).");

    // Verify ledger remains balanced
    const globalLedger3 = await prisma.ledgerEntry.aggregate({
      _sum: { debit: true, credit: true },
    });
    if (!globalLedger3._sum.debit?.equals(globalLedger3._sum.credit || new Decimal(0))) {
      throw new Error(`Ledger unbalanced: debits=${globalLedger3._sum.debit}, credits=${globalLedger3._sum.credit}`);
    }
    console.log("   ✔ Verified ledger remains perfectly balanced.");


    // 9. Concurrency Protection Simulation
    console.log("\n9. Testing Concurrency Protections...");
    // Simulate concurrent releases by running releasePendingBalances twice in parallel
    // Create another matured earning first
    const orderNumber5 = `TEST-ORD-5-${Date.now()}`;
    const testOrder5 = await prisma.order.create({
      data: {
        userId: testCustomerId,
        sellerId: testSellerId,
        orderNumber: orderNumber5,
        subtotal: new Decimal(50),
        shippingFee: new Decimal(0),
        platformFee: new Decimal(0),
        commissionAmount: new Decimal(5),
        discountAmount: new Decimal(0),
        totalAmount: new Decimal(50),
        status: "DELIVERED",
        paymentStatus: "PAID",
        paymentMethod: "COD",
        shippingAddress: "123 Test Road",
      },
    });
    if (testVariant) {
      await prisma.orderItem.create({
        data: {
          order: { connect: { id: testOrder5.id } },
          variant: { connect: { id: testVariant.id } },
          sellerId: testSellerId,
          quantity: 1,
          price: new Decimal(50),
          productSnapshot: {},
          variantSnapshot: {},
        },
      });
    }
    await handleOrderDeliveredWallet(testOrder5.id);
    await prisma.walletTransaction.updateMany({
      where: { reference: `earning_order_${testOrder5.id}` },
      data: { releaseAt: new Date(Date.now() - 10000) },
    });

    console.log("Triggering concurrent releases in parallel...");
    const [c1, c2] = await Promise.all([
      releasePendingBalances(testSellerId),
      releasePendingBalances(testSellerId),
    ]);
    const totalReleased = (c1.count || 0) + (c2.count || 0);
    if (totalReleased === 1) {
      console.log("✔ Concurrent releases correctly isolated. Released exactly once.");
    } else {
      throw new Error(`Concurrency leak! Released ${totalReleased} times instead of 1.`);
    }

    // 10. Test Role-Safe Universal Global Search
    console.log("\n10. Testing Universal Global Search (Role-Safe)...");
    
    // Set admin session
    setMockSessionForTesting({
      user: {
        id: admin.id,
        role: "ADMIN",
      },
    });
    
    // Search testOrder order number as ADMIN
    const searchResAdmin = await executeGlobalSearch(testOrder.orderNumber);
    if (searchResAdmin.length === 0 || searchResAdmin[0].id !== testOrder.id) {
      throw new Error("Admin search failed to find testOrder.");
    }
    console.log("✔ Admin successfully searched and matched order number.");

    // Set seller session
    setMockSessionForTesting({
      user: {
        id: sellerUser.id,
        role: "SELLER",
      },
    });

    // Search own order number as SELLER
    const searchResSeller = await executeGlobalSearch(testOrder.orderNumber);
    if (searchResSeller.length === 0 || searchResSeller[0].id !== testOrder.id) {
      throw new Error("Seller search failed to find their own order.");
    }
    console.log("✔ Seller successfully searched and matched their own order.");

    // Create a dummy order belonging to another seller
    const otherSellerUser = await prisma.user.create({
      data: {
        email: `seller-other-${Date.now()}@test.com`,
        name: "Other Seller",
        role: "SELLER",
      },
    });
    const otherSeller = await prisma.sellerProfile.create({
      data: {
        userId: otherSellerUser.id,
        storeName: "Other Store",
        storeSlug: `other-store-${Date.now()}`,
        pickupAddress: "456 Main Street",
        approvalStatus: "APPROVED",
        bankName: "Other Bank",
      },
    });
    const otherOrder = await prisma.order.create({
      data: {
        userId: testCustomerId,
        sellerId: otherSeller.id,
        orderNumber: `OTHER-ORD-${Date.now()}`,
        subtotal: new Decimal(200),
        shippingFee: new Decimal(0),
        platformFee: new Decimal(0),
        commissionAmount: new Decimal(0),
        discountAmount: new Decimal(0),
        totalAmount: new Decimal(200),
        status: "DELIVERED",
        paymentStatus: "PAID",
        paymentMethod: "COD",
        shippingAddress: "123 Test Road",
      },
    });

    // Search other seller's order number as SELLER (should leak nothing)
    const searchResOther = await executeGlobalSearch(otherOrder.orderNumber);
    if (searchResOther.length > 0) {
      throw new Error("Security leak! Seller was able to search and view another merchant's order.");
    }
    console.log("✔ Security isolation verified: Seller cannot search or view other merchant data.");


    // 11. Test Bulk Payout Approvals & KYC
    console.log("\n11. Testing Bulk Payout & KYC Approvals...");
    
    // Set admin session
    setMockSessionForTesting({
      user: {
        id: admin.id,
        role: "ADMIN",
      },
    });

    // Bulk KYC Approve
    await prisma.sellerKYC.deleteMany({ where: { sellerId: otherSeller.id } });
    const pendingKyc = await prisma.sellerKYC.create({
      data: {
        sellerId: otherSeller.id,
        status: "PENDING_REVIEW",
      },
    });
    const kycRes = await bulkApproveKycAdmin([pendingKyc.id]);
    if (!kycRes.success || kycRes.succeeded.length !== 1) {
      throw new Error("Bulk KYC approval failed.");
    }
    console.log("✔ Bulk KYC approval successful.");

    // Create 2 mock pending payouts for testing bulk approvals
    const payout1 = await prisma.payoutRequest.create({
      data: {
        sellerId: testSellerId,
        amount: new Decimal(10),
        reference: `payout_bulk_1_${Date.now()}`,
        status: "PENDING",
      },
    });
    const payout2 = await prisma.payoutRequest.create({
      data: {
        sellerId: testSellerId,
        amount: new Decimal(15),
        reference: `payout_bulk_2_${Date.now()}`,
        status: "PENDING",
      },
    });

    // Process payout without bankReference (paid should fail)
    const payoutFailRes = await bulkApprovePayoutsAdmin([payout1.id, payout2.id], "PAID", "");
    if (payoutFailRes.success || payoutFailRes.failed.length !== 2) {
      throw new Error("Bulk PAID payouts allowed without bank reference!");
    }
    console.log("✔ Bulk PAID payout without UTR correctly rejected.");

    // Process payout with bank reference
    const payoutSuccessRes = await bulkApprovePayoutsAdmin([payout1.id, payout2.id], "PAID", "UTR-BULK-100");
    if (!payoutSuccessRes.success || payoutSuccessRes.succeeded.length !== 2) {
      throw new Error("Bulk PAID payout with UTR failed: " + JSON.stringify(payoutSuccessRes));
    }
    console.log("✔ Bulk PAID payout with UTR successfully dished out.");


    // 12. Test Audit Logging Stream
    console.log("\n12. Testing Audit Logs Integration...");
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        userId: admin.id,
        action: { in: ["KYC_APPROVED", "PAYOUT_STATUS_UPDATE"] },
      },
    });
    if (auditLogs.length === 0) {
      throw new Error("Audit logs not recorded for bulk operations actions.");
    }
    console.log(`✔ Audit logs correctly recorded: found ${auditLogs.length} bulk operations audit logs.`);

    console.log("\n----------------------------------------------------------------");
    console.log("              ALL FINANCIAL & PLATFORM TESTS COMPLETED          ");
    console.log("----------------------------------------------------------------");
  } catch (err: any) {
    console.error("\n❌ TEST FAILED: ", err);
    process.exit(1);
  }
}

runTests();
