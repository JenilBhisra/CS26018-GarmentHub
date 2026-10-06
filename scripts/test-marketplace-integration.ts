// Standalone integration test for the wallet/payout/returns/disputes engine.
// Run manually via ts-node (see scripts/test-financials.ts for the same pattern).
// Moved out of app/api/test-marketplace — that route was a live, unauthenticated
// production endpoint that deleted core transactional tables on every request.
import "./test-database-guard"; // must stay first: points Prisma at TEST_DATABASE_URL
import { prisma } from "../lib/prisma";
import { setMockSessionForTesting } from "../auth";
import { ensureSellerWallet, handleOrderDeliveredWallet, releasePendingBalances, adjustWalletAdmin, reconcilePlatformFinancials } from "../actions/wallets";
import { requestPayout, updatePayoutStatusAdmin } from "../actions/payouts";
import { requestReturn, finalizeRefundAdmin, seedReturnReasonRules } from "../actions/returns";
import { createDispute, addDisputeNote, updateDisputeAdmin } from "../actions/disputes";

function log(msg: string) {
  console.log(msg);
}

function setMockSession(userId: string, role: string, email: string, name: string) {
  setMockSessionForTesting({
    user: { id: userId, role, email, name },
  });
}

async function runCleanup(adminUser: { id: string; email: string; name: string }) {
  log("\n--- CLEANING UP DATABASE RECORDS ---");
  setMockSession(adminUser.id, "ADMIN", adminUser.email, adminUser.name);

  await prisma.ledgerEntry.deleteMany().catch(console.error);
  await prisma.disputeNote.deleteMany().catch(console.error);
  await prisma.dispute.deleteMany().catch(console.error);
  await prisma.payoutRequest.deleteMany().catch(console.error);
  await prisma.returnRequest.deleteMany().catch(console.error);
  await prisma.orderItem.deleteMany().catch(console.error);
  await prisma.shipment.deleteMany().catch(console.error);
  await prisma.order.deleteMany().catch(console.error);
  await prisma.walletTransaction.deleteMany().catch(console.error);
  await prisma.walletAdjustment.deleteMany().catch(console.error);
  await prisma.backgroundJob.deleteMany().catch(console.error);

  await prisma.sellerWallet.updateMany({
    data: {
      availableBalance: 0,
      withdrawableBalance: 0,
      pendingBalance: 0,
      negativeBalance: 0,
      reserveBalance: 0,
      totalEarned: 0,
      totalPaid: 0,
      totalRefunded: 0,
    },
  }).catch(console.error);

  log("Database transaction tables completely cleaned and wallets reset.");
}

async function runTests() {
  log("=== STARTING MARKETPLACE INTEGRATION TESTS ===");

  const adminUser = await prisma.user.findUnique({ where: { email: "admin@garmenthub.local" } });
  const sellerUser = await prisma.user.findUnique({ where: { email: "seller@garmenthub.local" } });
  const customerUser = await prisma.user.findUnique({ where: { email: "customer@garmenthub.local" } });

  if (!adminUser || !sellerUser || !customerUser) {
    throw new Error("Seeded test users (admin, seller, customer) not found in the database. Please run the seed script first.");
  }

  log(`- Admin User ID: ${adminUser.id}`);
  log(`- Seller User ID: ${sellerUser.id}`);
  log(`- Customer User ID: ${customerUser.id}`);

  const sellerProfile = await prisma.sellerProfile.findUnique({ where: { userId: sellerUser.id } });
  if (!sellerProfile) {
    throw new Error("Seller profile not found for seller@garmenthub.local");
  }
  log(`- Seller Profile ID: ${sellerProfile.id}`);

  const testVariant = await prisma.productVariant.findFirst({ include: { product: true } });
  if (!testVariant) {
    throw new Error("No product variant found in the database.");
  }
  log(`- Using Test Product: "${testVariant.product.name}" (SKU: ${testVariant.sku})`);

  let wallet = await ensureSellerWallet(sellerProfile.id);
  log(`- Test Seller Wallet ID: ${wallet.id}`);

  let initialWalletState: any = null;
  const createdOrderIds: string[] = [];
  const createdPayoutReqIds: string[] = [];
  const createdDisputeIds: string[] = [];

  try {
    await runCleanup(adminUser);

    initialWalletState = await prisma.sellerWallet.findUnique({ where: { id: wallet.id } });
    if (!initialWalletState) {
      throw new Error("Wallet not found after running initial database cleanup");
    }

    log("Seeding Return Reason Rules for testing...");
    setMockSession(adminUser.id, "ADMIN", adminUser.email, adminUser.name);
    const seedRes = await seedReturnReasonRules();
    log(`Seeded return rules result: ${JSON.stringify(seedRes)}`);

    // ----------------------------------------------------
    // TEST CASE 2: Order Earnings Credit & Pending Balance
    // ----------------------------------------------------
    log("\n--- TEST CASE 2: Order Earnings & Pending Balance ---");

    const orderNumber1 = `TEST-ORD-${Date.now()}`;
    const testOrder1 = await prisma.order.create({
      data: {
        userId: customerUser.id,
        sellerId: sellerProfile.id,
        orderNumber: orderNumber1,
        subtotal: 1000,
        shippingFee: 50,
        platformFee: 20,
        commissionAmount: 100,
        commissionRate: 0.10,
        discountAmount: 100,
        totalAmount: 970,
        shippingAddress: "Test Address, India",
        status: "DELIVERED",
        paymentStatus: "PAID",
        items: {
          create: {
            variantId: testVariant.id,
            sellerId: sellerProfile.id,
            quantity: 1,
            price: 1000,
            productSnapshot: JSON.stringify({ name: testVariant.product.name }),
            variantSnapshot: JSON.stringify({ sku: testVariant.sku, size: testVariant.size }),
          },
        },
      },
    });
    createdOrderIds.push(testOrder1.id);
    log(`Created delivered Order #${orderNumber1}`);

    const earningResult = await handleOrderDeliveredWallet(testOrder1.id);
    log(`handleOrderDeliveredWallet result: ${JSON.stringify(earningResult)}`);
    if (!earningResult.success || Number(earningResult.sellerEarning) !== 800) {
      throw new Error(`Earnings calculation incorrect. Expected 800, got ${earningResult.sellerEarning}`);
    }

    let currentWallet = await prisma.sellerWallet.findUnique({ where: { id: wallet.id } });
    if (!currentWallet) throw new Error("Wallet not found");
    log(`Wallet Pending Balance: ₹${currentWallet.pendingBalance} (Expected: ${Number(initialWalletState.pendingBalance) + 800})`);
    if (Number(currentWallet.pendingBalance) !== Number(initialWalletState.pendingBalance) + 800) {
      throw new Error("Pending balance did not update correctly.");
    }

    const refKey1 = `earning_order_${testOrder1.id}`;
    const earnTxn = await prisma.walletTransaction.findUnique({ where: { reference: refKey1 } });
    if (!earnTxn || Number(earnTxn.amount) !== 800 || earnTxn.type !== "EARNING") {
      throw new Error("Earning transaction record missing or incorrect.");
    }
    log("Validated Earning transaction and reference key.");

    const job = await prisma.backgroundJob.findFirst({
      where: { queue: "wallet", status: "PENDING", payload: { contains: earnTxn.id } },
    });
    if (!job) {
      throw new Error("Maturation background job was not queued.");
    }
    log(`Validated Maturation BackgroundJob queued at: ${job.runAt}`);

    const earnAgain = await handleOrderDeliveredWallet(testOrder1.id);
    log(`Triggering handleOrderDeliveredWallet again result: ${JSON.stringify(earnAgain)}`);
    const postIdempotencyWallet = await prisma.sellerWallet.findUnique({ where: { id: wallet.id } });
    if (!postIdempotencyWallet || !postIdempotencyWallet.pendingBalance.equals(currentWallet.pendingBalance)) {
      throw new Error("Idempotency guard failed: duplicate trigger changed pending balance.");
    }
    log("Validated Earning Idempotency successfully.");

    // ----------------------------------------------------
    // TEST CASE 3: Maturity Auto-Release & Maturation logic
    // ----------------------------------------------------
    log("\n--- TEST CASE 3: Maturity Auto-Release ---");

    const earlyRelease = await releasePendingBalances(sellerProfile.id);
    log(`Early release result: ${JSON.stringify(earlyRelease)}`);
    if (!earlyRelease.success || earlyRelease.count > 0) {
      throw new Error("Earning released before hold period matured!");
    }

    await prisma.walletTransaction.update({
      where: { id: earnTxn.id },
      data: { releaseAt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    log("Updated transaction releaseAt date to yesterday to mock maturity.");

    const maturityRelease = await releasePendingBalances(sellerProfile.id);
    log(`Matured release result: ${JSON.stringify(maturityRelease)}`);
    if (!maturityRelease.success || maturityRelease.count !== 1) {
      throw new Error(`Expected 1 transaction to release, but released ${maturityRelease.count}`);
    }

    currentWallet = await prisma.sellerWallet.findUnique({ where: { id: wallet.id } });
    if (!currentWallet) throw new Error("Wallet not found");
    log("Post-release Wallet Balances:");
    log(`- Pending Balance: ₹${currentWallet.pendingBalance} (Expected: ${initialWalletState.pendingBalance})`);
    log(`- Withdrawable Balance: ₹${currentWallet.withdrawableBalance}`);
    if (!currentWallet.pendingBalance.equals(initialWalletState.pendingBalance)) {
      throw new Error("Pending balance was not decremented.");
    }

    const releaseLedger = await prisma.walletTransaction.findUnique({ where: { reference: `release_txn_${earnTxn.id}` } });
    if (!releaseLedger || releaseLedger.type !== "RELEASE" || Number(releaseLedger.amount) !== 800) {
      throw new Error("Release ledger transaction not found or incorrect.");
    }
    log("Validated RELEASE ledger transaction record.");

    // ----------------------------------------------------
    // TEST CASE 4: Admin Adjustment & Negative Balance Handling
    // ----------------------------------------------------
    log("\n--- TEST CASE 4: Admin Adjustment & Negative Balance ---");

    setMockSession(adminUser.id, "ADMIN", adminUser.email, adminUser.name);

    const debitAmount = Number(currentWallet.withdrawableBalance) + 500;
    log(`Applying manual DEBIT of ₹${debitAmount} which exceeds withdrawable balance...`);
    const adjustResult = await adjustWalletAdmin(sellerProfile.id, debitAmount, "MANUAL_DEBIT", "Test negative balance setup");
    if (!adjustResult.success) {
      throw new Error("Admin manual adjustment failed.");
    }

    currentWallet = await prisma.sellerWallet.findUnique({ where: { id: wallet.id } });
    if (!currentWallet) throw new Error("Wallet not found");
    log("Post-debit Wallet Balances:");
    log(`- Withdrawable Balance: ₹${currentWallet.withdrawableBalance} (Expected: 0)`);
    log(`- Negative Debt Balance: ₹${currentWallet.negativeBalance} (Expected: 500)`);

    if (Number(currentWallet.withdrawableBalance) !== 0 || Number(currentWallet.negativeBalance) !== 500) {
      throw new Error("Negative balance calculation was incorrect.");
    }

    const orderNumber2 = `TEST-ORD-${Date.now() + 1}`;
    const testOrder2 = await prisma.order.create({
      data: {
        userId: customerUser.id,
        sellerId: sellerProfile.id,
        orderNumber: orderNumber2,
        subtotal: 1200,
        shippingFee: 50,
        platformFee: 20,
        commissionAmount: 120,
        commissionRate: 0.10,
        discountAmount: 200,
        totalAmount: 1070,
        shippingAddress: "Test Address, India",
        status: "DELIVERED",
        paymentStatus: "PAID",
        items: {
          create: {
            variantId: testVariant.id,
            sellerId: sellerProfile.id,
            quantity: 1,
            price: 1200,
            productSnapshot: JSON.stringify({ name: testVariant.product.name }),
            variantSnapshot: JSON.stringify({ sku: testVariant.sku, size: testVariant.size }),
          },
        },
      },
    });
    createdOrderIds.push(testOrder2.id);

    await handleOrderDeliveredWallet(testOrder2.id);
    const earnTxn2 = await prisma.walletTransaction.findUnique({ where: { reference: `earning_order_${testOrder2.id}` } });
    if (!earnTxn2) throw new Error("Second earning transaction not found");

    await prisma.walletTransaction.update({ where: { id: earnTxn2.id }, data: { releaseAt: new Date(Date.now() - 1000) } });

    log("Releasing matured earning of ₹880 against negative debt of ₹500...");
    await releasePendingBalances(sellerProfile.id);

    currentWallet = await prisma.sellerWallet.findUnique({ where: { id: wallet.id } });
    if (!currentWallet) throw new Error("Wallet not found");
    log("Balances after negative recovery:");
    log(`- Negative Balance: ₹${currentWallet.negativeBalance} (Expected: 0)`);
    log(`- Withdrawable Balance: ₹${currentWallet.withdrawableBalance} (Expected: 380)`);

    if (Number(currentWallet.negativeBalance) !== 0 || Number(currentWallet.withdrawableBalance) !== 380) {
      throw new Error("Negative debt recovery offset failed.");
    }
    log("Validated Negative balance recovery successfully.");

    // ----------------------------------------------------
    // TEST CASE 5: Payout Request & Payout Protections
    // ----------------------------------------------------
    log("\n--- TEST CASE 5: Payout Request & Protection ---");

    setMockSession(sellerUser.id, "SELLER", sellerUser.email, sellerUser.name);

    await prisma.sellerProfile.update({
      where: { id: sellerProfile.id },
      data: {
        approvalStatus: "APPROVED",
        bankAccountHolder: "Test Seller",
        bankAccountNumber: "99990123456789",
        bankIFSC: "UTIB0000123",
        bankName: "Axis Bank",
      },
    });

    await prisma.sellerKYC.upsert({
      where: { sellerId: sellerProfile.id },
      update: { status: "APPROVED" },
      create: { sellerId: sellerProfile.id, status: "APPROVED" },
    });
    log("Mocked seller KYC and bank details to APPROVED.");

    const payoutReq = await requestPayout(200);
    log(`requestPayout result: ${JSON.stringify(payoutReq)}`);
    if (!payoutReq.success || !(payoutReq as any).payoutId) {
      throw new Error("Payout request failed.");
    }
    const payoutId = (payoutReq as any).payoutId;
    createdPayoutReqIds.push(payoutId);

    currentWallet = await prisma.sellerWallet.findUnique({ where: { id: wallet.id } });
    if (!currentWallet) throw new Error("Wallet not found");
    log("Post-request Balances:");
    log(`- Withdrawable Balance: ₹${currentWallet.withdrawableBalance} (Expected: 180)`);
    log(`- Reserve Balance: ₹${currentWallet.reserveBalance} (Expected: 200)`);
    if (Number(currentWallet.withdrawableBalance) !== 180 || Number(currentWallet.reserveBalance) !== 200) {
      throw new Error("Withdrawal amount reserve movement incorrect.");
    }

    await prisma.sellerKYC.update({ where: { sellerId: sellerProfile.id }, data: { status: "REJECTED" } });
    log("Temporarily set KYC status to REJECTED to verify protection block...");
    const blockedPayout = await requestPayout(50);
    log(`Blocked payout request output: ${JSON.stringify(blockedPayout)}`);
    if (blockedPayout.success) {
      throw new Error("Payout request allowed while KYC is rejected!");
    }
    log("Verified KYC protection block successfully.");

    await prisma.sellerKYC.update({ where: { sellerId: sellerProfile.id }, data: { status: "APPROVED" } });

    // ----------------------------------------------------
    // TEST CASE 6: Payout Processing (Admin)
    // ----------------------------------------------------
    log("\n--- TEST CASE 6: Payout Processing (Admin) ---");

    setMockSession(adminUser.id, "ADMIN", adminUser.email, adminUser.name);

    log("Attempting payout update to PAID without UTR reference...");
    const missingUtrResult = await updatePayoutStatusAdmin(payoutId, "PAID");
    log(`updatePayoutStatusAdmin (missing UTR) result: ${JSON.stringify(missingUtrResult)}`);
    if (missingUtrResult.success) {
      throw new Error("Allowed payout status PAID without mandatory bank UTR.");
    }
    log("Blocked update without UTR reference successfully.");

    const processResult = await updatePayoutStatusAdmin(payoutId, "PAID", "UTR-TEST-12345");
    log(`Payout payout update result: ${JSON.stringify(processResult)}`);
    if (!processResult.success) {
      throw new Error("Admin payout processing failed.");
    }

    currentWallet = await prisma.sellerWallet.findUnique({ where: { id: wallet.id } });
    if (!currentWallet) throw new Error("Wallet not found");
    log("Post-approval Wallet Balances:");
    log(`- Reserve Balance: ₹${currentWallet.reserveBalance} (Expected: 0)`);
    log(`- Total Paid: ₹${currentWallet.totalPaid} (Increased by 200)`);

    if (Number(currentWallet.reserveBalance) !== 0 || Number(currentWallet.totalPaid) < 200) {
      throw new Error("Reserve depletion or total paid increment calculation incorrect.");
    }
    log("Payout fully settled with bank reference.");

    // ----------------------------------------------------
    // TEST CASE 7: Returns & Refund Validation
    // ----------------------------------------------------
    log("\n--- TEST CASE 7: Returns & Refund Validation ---");

    const orderNumber3 = `TEST-ORD-${Date.now() + 2}`;
    const testOrder3 = await prisma.order.create({
      data: {
        userId: customerUser.id,
        sellerId: sellerProfile.id,
        orderNumber: orderNumber3,
        subtotal: 500,
        shippingFee: 50,
        platformFee: 10,
        commissionAmount: 50,
        commissionRate: 0.10,
        discountAmount: 0,
        totalAmount: 560,
        shippingAddress: "Test Address, India",
        status: "DELIVERED",
        paymentStatus: "PAID",
        items: {
          create: {
            variantId: testVariant.id,
            sellerId: sellerProfile.id,
            quantity: 1,
            price: 500,
            productSnapshot: JSON.stringify({ name: testVariant.product.name }),
            variantSnapshot: JSON.stringify({ sku: testVariant.sku, size: testVariant.size }),
          },
        },
      },
    });
    createdOrderIds.push(testOrder3.id);

    await handleOrderDeliveredWallet(testOrder3.id);

    const walletBeforeRefund = await prisma.sellerWallet.findUnique({ where: { id: wallet.id } });
    if (!walletBeforeRefund) throw new Error("Wallet not found");

    setMockSession(customerUser.id, "CUSTOMER", customerUser.email, customerUser.name);
    const returnReqResult = await requestReturn(testOrder3.id, "Customer changed mind", "Returning to seller");
    log(`requestReturn result: ${JSON.stringify(returnReqResult)}`);
    if (!returnReqResult.success) {
      throw new Error("Customer return request failed.");
    }

    const returnRequest = await prisma.returnRequest.findUnique({ where: { orderId: testOrder3.id } });
    if (!returnRequest || Number(returnRequest.refundAmount) !== 500) {
      throw new Error("Return request record not found or incorrect refund amount.");
    }

    const secondReturnReq = await requestReturn(testOrder3.id, "Duplicate check");
    if (secondReturnReq.success) {
      throw new Error("Allowed duplicate return request on the same order.");
    }
    log("Blocked duplicate return request successfully.");

    setMockSession(adminUser.id, "ADMIN", adminUser.email, adminUser.name);

    const variantBefore = await prisma.productVariant.findUnique({ where: { id: testVariant.id } });
    const stockBefore = variantBefore?.stock || 0;

    log(`Finalizing refund of return request #${returnRequest.id}...`);
    const finalizeRefund = await finalizeRefundAdmin(returnRequest.id, "Approved by tester");
    log(`finalizeRefundAdmin result: ${JSON.stringify(finalizeRefund)}`);
    if (!finalizeRefund.success) {
      throw new Error("finalizeRefundAdmin failed.");
    }

    const variantAfter = await prisma.productVariant.findUnique({ where: { id: testVariant.id } });
    const stockAfter = variantAfter?.stock || 0;
    log(`Stock level: ${stockBefore} -> ${stockAfter} (Expected stock restore of +1)`);
    if (stockAfter !== stockBefore + 1) {
      throw new Error("Stock did not restore correctly on refund finalization.");
    }

    currentWallet = await prisma.sellerWallet.findUnique({ where: { id: wallet.id } });
    if (!currentWallet) throw new Error("Wallet not found");
    log("Balances post-refund:");
    log(`- Pending Balance: ₹${currentWallet.pendingBalance} (Expected: ${Number(walletBeforeRefund.pendingBalance) - 450})`);
    log(`- Total Refunded: ₹${currentWallet.totalRefunded} (Expected: ${Number(walletBeforeRefund.totalRefunded) + 450})`);

    if (Number(currentWallet.pendingBalance) !== Number(walletBeforeRefund.pendingBalance) - 450) {
      throw new Error("Wallet pending balance deduction was incorrect.");
    }

    const doubleRefund = await finalizeRefundAdmin(returnRequest.id, "Attempting double refund");
    if (doubleRefund.success) {
      throw new Error("Double refund guard failed! Admin finalizeRefund was executed twice.");
    }
    log("Blocked double refund successfully.");

    // ----------------------------------------------------
    // TEST CASE 7b: Seller Fault Refund with Commission Reversal
    // ----------------------------------------------------
    log("\n--- TEST CASE 7b: Seller Fault Refund & Commission Reversal ---");

    const orderNumber4 = `TEST-ORD-${Date.now() + 3}`;
    const testOrder4 = await prisma.order.create({
      data: {
        userId: customerUser.id,
        sellerId: sellerProfile.id,
        orderNumber: orderNumber4,
        subtotal: 600,
        shippingFee: 50,
        platformFee: 10,
        commissionAmount: 60,
        commissionRate: 0.10,
        discountAmount: 0,
        totalAmount: 660,
        shippingAddress: "Test Address, Jaipur",
        status: "DELIVERED",
        paymentStatus: "PAID",
        items: {
          create: {
            variantId: testVariant.id,
            sellerId: sellerProfile.id,
            quantity: 1,
            price: 600,
            productSnapshot: JSON.stringify({ name: testVariant.product.name }),
            variantSnapshot: JSON.stringify({ sku: testVariant.sku, size: testVariant.size }),
          },
        },
      },
    });
    createdOrderIds.push(testOrder4.id);

    await handleOrderDeliveredWallet(testOrder4.id);

    setMockSession(customerUser.id, "CUSTOMER", customerUser.email, customerUser.name);
    const returnReqResult4 = await requestReturn(testOrder4.id, "Damaged product", "Item arrived broken");
    log(`requestReturn (Seller Fault) result: ${JSON.stringify(returnReqResult4)}`);
    if (!returnReqResult4.success) {
      throw new Error("Customer return request (Seller Fault) failed.");
    }

    const returnRequest4 = await prisma.returnRequest.findUnique({ where: { orderId: testOrder4.id } });
    if (!returnRequest4) throw new Error("Return request 4 not found");

    log("Seeded Rule calculation validation:");
    log(`- Reason Category: ${returnRequest4.reasonCategory} (Expected: SELLER_FAULT)`);
    log(`- Customer Refund: ₹${returnRequest4.customerRefundAmount} (Expected: 600 + 50 = 650)`);
    log(`- Reverse Commission: ${returnRequest4.reverseCommission} (Expected: true)`);

    if (returnRequest4.reasonCategory !== "SELLER_FAULT" || Number(returnRequest4.customerRefundAmount) !== 650) {
      throw new Error("Automated Seller Fault refund calculation incorrect.");
    }

    setMockSession(adminUser.id, "ADMIN", adminUser.email, adminUser.name);
    const finalizeRefund4 = await finalizeRefundAdmin(returnRequest4.id, "Seller fault refund approved");
    log(`finalizeRefundAdmin (Seller Fault) result: ${JSON.stringify(finalizeRefund4)}`);
    if (!finalizeRefund4.success) {
      throw new Error("finalizeRefundAdmin (Seller Fault) failed.");
    }

    const ledgerTx4 = await prisma.ledgerEntry.findMany({ where: { reference: { startsWith: `refund_ret_${returnRequest4.id}` } } });
    let sumDebit4 = 0;
    let sumCredit4 = 0;
    for (const entry of ledgerTx4) {
      sumDebit4 += Number(entry.debit);
      sumCredit4 += Number(entry.credit);
    }
    log(`Ledger entry validation: Sum Debit: ₹${sumDebit4}, Sum Credit: ₹${sumCredit4}`);
    if (sumDebit4 !== sumCredit4 || sumDebit4 === 0) {
      throw new Error("Ledger entries are not balanced or empty for Seller Fault refund.");
    }
    log("Seller Fault refund ledger entries are balanced successfully.");

    // ----------------------------------------------------
    // TEST CASE 7c: Platform Fault Refund (Platform bears cost)
    // ----------------------------------------------------
    log("\n--- TEST CASE 7c: Platform Fault Refund ---");

    const orderNumber5 = `TEST-ORD-${Date.now() + 4}`;
    const testOrder5 = await prisma.order.create({
      data: {
        userId: customerUser.id,
        sellerId: sellerProfile.id,
        orderNumber: orderNumber5,
        subtotal: 300,
        shippingFee: 50,
        platformFee: 10,
        commissionAmount: 30,
        commissionRate: 0.10,
        discountAmount: 0,
        totalAmount: 360,
        shippingAddress: "Test Address, India",
        status: "DELIVERED",
        paymentStatus: "PAID",
        items: {
          create: {
            variantId: testVariant.id,
            sellerId: sellerProfile.id,
            quantity: 1,
            price: 300,
            productSnapshot: JSON.stringify({ name: testVariant.product.name }),
            variantSnapshot: JSON.stringify({ sku: testVariant.sku, size: testVariant.size }),
          },
        },
      },
    });
    createdOrderIds.push(testOrder5.id);

    await handleOrderDeliveredWallet(testOrder5.id);

    const walletBeforePlatformRefund = await prisma.sellerWallet.findUnique({ where: { id: wallet.id } });

    setMockSession(customerUser.id, "CUSTOMER", customerUser.email, customerUser.name);
    const returnReqResult5 = await requestReturn(testOrder5.id, "Platform pricing mistake", "Pricing mismatch on catalog");
    if (!returnReqResult5.success) {
      throw new Error("Customer return request (Platform Fault) failed.");
    }

    const returnRequest5 = await prisma.returnRequest.findUnique({ where: { orderId: testOrder5.id } });
    if (!returnRequest5) throw new Error("Return request 5 not found");

    log("Platform Fault rule calculation validation:");
    log(`- Reason Category: ${returnRequest5.reasonCategory} (Expected: PLATFORM_FAULT)`);
    log(`- Seller Wallet Deduction: ₹${returnRequest5.sellerDeductionAmount} (Expected: 0)`);
    log(`- Platform Cost: ₹${returnRequest5.platformCost} (Expected: 300 + 50 = 350)`);

    if (returnRequest5.reasonCategory !== "PLATFORM_FAULT" || Number(returnRequest5.sellerDeductionAmount) !== 0) {
      throw new Error("Automated Platform Fault refund calculation incorrect.");
    }

    setMockSession(adminUser.id, "ADMIN", adminUser.email, adminUser.name);
    const finalizeRefund5 = await finalizeRefundAdmin(returnRequest5.id, "Platform fault refund approved");
    if (!finalizeRefund5.success) {
      throw new Error("finalizeRefundAdmin (Platform Fault) failed.");
    }

    const walletAfterPlatformRefund = await prisma.sellerWallet.findUnique({ where: { id: wallet.id } });
    if (!walletAfterPlatformRefund || !walletBeforePlatformRefund) throw new Error("Wallet not found");
    log("Seller Wallet Balance comparison:");
    log(`- Before Platform Refund: Withdrawable: ₹${walletBeforePlatformRefund.withdrawableBalance}`);
    log(`- After Platform Refund: Withdrawable: ₹${walletAfterPlatformRefund.withdrawableBalance}`);

    if (Number(walletAfterPlatformRefund.withdrawableBalance) !== Number(walletBeforePlatformRefund.withdrawableBalance)) {
      throw new Error("Seller wallet was incorrectly deducted for a Platform Fault refund.");
    }
    log("Seller wallet protected from Platform Fault refund deductions successfully.");

    const ledgerTx5 = await prisma.ledgerEntry.findMany({ where: { reference: { startsWith: `refund_ret_${returnRequest5.id}` } } });
    let sumDebit5 = 0;
    let sumCredit5 = 0;
    for (const entry of ledgerTx5) {
      sumDebit5 += Number(entry.debit);
      sumCredit5 += Number(entry.credit);
    }
    log(`Ledger entry validation (Platform Fault): Sum Debit: ₹${sumDebit5}, Sum Credit: ₹${sumCredit5}`);
    if (sumDebit5 !== sumCredit5 || sumDebit5 === 0) {
      throw new Error("Ledger entries are not balanced or empty for Platform Fault refund.");
    }
    log("Platform Fault refund ledger entries are balanced successfully.");

    // ----------------------------------------------------
    // TEST CASE 7d: Seller Fault Refund with Custom Splits & Commission Preservation
    // ----------------------------------------------------
    log("\n--- TEST CASE 7d: Seller Fault Refund Commission & Splits ---");

    const ordNumA = `TEST-ORD-7DA-${Date.now()}`;
    const ordNumB = `TEST-ORD-7DB-${Date.now()}`;

    const orderA = await prisma.order.create({
      data: {
        userId: customerUser.id,
        sellerId: sellerProfile.id,
        orderNumber: ordNumA,
        subtotal: 1000,
        shippingFee: 0,
        platformFee: 15,
        commissionAmount: 100,
        commissionRate: 0.10,
        discountAmount: 0,
        totalAmount: 1015,
        shippingAddress: "Test Address, India",
        status: "DELIVERED",
        paymentStatus: "PAID",
        items: {
          create: {
            variantId: testVariant.id,
            sellerId: sellerProfile.id,
            quantity: 1,
            price: 1000,
            productSnapshot: JSON.stringify({ name: testVariant.product.name }),
            variantSnapshot: JSON.stringify({ sku: testVariant.sku, size: testVariant.size }),
          },
        },
      },
    });

    const orderB = await prisma.order.create({
      data: {
        userId: customerUser.id,
        sellerId: sellerProfile.id,
        orderNumber: ordNumB,
        subtotal: 1000,
        shippingFee: 0,
        platformFee: 15,
        commissionAmount: 100,
        commissionRate: 0.10,
        discountAmount: 0,
        totalAmount: 1015,
        shippingAddress: "Test Address, India",
        status: "DELIVERED",
        paymentStatus: "PAID",
        items: {
          create: {
            variantId: testVariant.id,
            sellerId: sellerProfile.id,
            quantity: 1,
            price: 1000,
            productSnapshot: JSON.stringify({ name: testVariant.product.name }),
            variantSnapshot: JSON.stringify({ sku: testVariant.sku, size: testVariant.size }),
          },
        },
      },
    });

    createdOrderIds.push(orderA.id, orderB.id);

    await handleOrderDeliveredWallet(orderA.id);
    await handleOrderDeliveredWallet(orderB.id);

    setMockSession(customerUser.id, "CUSTOMER", customerUser.email, customerUser.name);
    const returnReq7d = await requestReturn(orderA.id, "Damaged product", "Broken box");
    if (!returnReq7d.success) throw new Error("Customer return request for 7d failed.");

    const returnRequest7dObj = await prisma.returnRequest.findUnique({ where: { orderId: orderA.id } });
    if (!returnRequest7dObj) throw new Error("Return request 7d not found");

    await prisma.returnRequest.update({
      where: { id: returnRequest7dObj.id },
      data: { returnShippingFee: 15, customerRefundAmount: 1000, sellerDeductionAmount: 1015 },
    });

    setMockSession(adminUser.id, "ADMIN", adminUser.email, adminUser.name);
    const finalizeRefund7d = await finalizeRefundAdmin(
      returnRequest7dObj.id,
      "Seller fault custom split overrides",
      undefined,
      undefined,
      1000,
      1015
    );
    if (!finalizeRefund7d.success) {
      throw new Error(`finalizeRefundAdmin 7d failed: ${finalizeRefund7d.error}`);
    }

    const ledgerTx7d = await prisma.ledgerEntry.findMany({ where: { reference: { startsWith: `refund_ret_${returnRequest7dObj.id}` } } });
    let sumDebit7d = 0;
    let sumCredit7d = 0;
    for (const entry of ledgerTx7d) {
      sumDebit7d += Number(entry.debit);
      sumCredit7d += Number(entry.credit);
    }
    log(`Ledger entry validation (Case 7d): Sum Debit: ₹${sumDebit7d}, Sum Credit: ₹${sumCredit7d}`);
    if (sumDebit7d !== sumCredit7d || sumDebit7d === 0) {
      throw new Error("Ledger entries are not balanced or empty for Custom Seller Fault refund.");
    }

    const commissionDebit = ledgerTx7d.find((entry) => entry.accountName === "PLATFORM_REVENUE");
    if (commissionDebit) {
      throw new Error("PLATFORM_REVENUE was debited/reversed for Seller Fault return.");
    }
    log("Platform commission correctly preserved (not reversed) for Seller Fault return.");

    // ----------------------------------------------------
    // TEST CASE 7e: Customer Fault Return Shipping Payable & Balance
    // ----------------------------------------------------
    log("\n--- TEST CASE 7e: Customer Fault Return Shipping Payable ---");

    const ordNumC = `TEST-ORD-7EC-${Date.now()}`;
    const ordNumD = `TEST-ORD-7ED-${Date.now()}`;

    const orderC = await prisma.order.create({
      data: {
        userId: customerUser.id,
        sellerId: sellerProfile.id,
        orderNumber: ordNumC,
        subtotal: 1000,
        shippingFee: 0,
        platformFee: 15,
        commissionAmount: 100,
        commissionRate: 0.10,
        discountAmount: 0,
        totalAmount: 1015,
        shippingAddress: "Test Address, India",
        status: "DELIVERED",
        paymentStatus: "PAID",
        items: {
          create: {
            variantId: testVariant.id,
            sellerId: sellerProfile.id,
            quantity: 1,
            price: 1000,
            productSnapshot: JSON.stringify({ name: testVariant.product.name }),
            variantSnapshot: JSON.stringify({ sku: testVariant.sku, size: testVariant.size }),
          },
        },
      },
    });

    const orderD = await prisma.order.create({
      data: {
        userId: customerUser.id,
        sellerId: sellerProfile.id,
        orderNumber: ordNumD,
        subtotal: 1000,
        shippingFee: 0,
        platformFee: 15,
        commissionAmount: 100,
        commissionRate: 0.10,
        discountAmount: 0,
        totalAmount: 1015,
        shippingAddress: "Test Address, India",
        status: "DELIVERED",
        paymentStatus: "PAID",
        items: {
          create: {
            variantId: testVariant.id,
            sellerId: sellerProfile.id,
            quantity: 1,
            price: 1000,
            productSnapshot: JSON.stringify({ name: testVariant.product.name }),
            variantSnapshot: JSON.stringify({ sku: testVariant.sku, size: testVariant.size }),
          },
        },
      },
    });

    createdOrderIds.push(orderC.id, orderD.id);

    await handleOrderDeliveredWallet(orderC.id);
    await handleOrderDeliveredWallet(orderD.id);

    setMockSession(customerUser.id, "CUSTOMER", customerUser.email, customerUser.name);
    const returnReq7e = await requestReturn(orderC.id, "Customer changed mind", "No longer need it");
    if (!returnReq7e.success) throw new Error("Customer return request for 7e failed.");

    const returnRequest7eObj = await prisma.returnRequest.findUnique({ where: { orderId: orderC.id } });
    if (!returnRequest7eObj) throw new Error("Return request 7e not found");

    await prisma.returnRequest.update({
      where: { id: returnRequest7eObj.id },
      data: { returnShippingFee: 180, deductionAmount: 180, customerRefundAmount: 820, sellerDeductionAmount: 1000 },
    });

    setMockSession(adminUser.id, "ADMIN", adminUser.email, adminUser.name);
    const finalizeRefund7e = await finalizeRefundAdmin(returnRequest7eObj.id, "Customer fault refund with return shipping payable");
    if (!finalizeRefund7e.success) {
      throw new Error(`finalizeRefundAdmin 7e failed: ${finalizeRefund7e.error}`);
    }

    const ledgerTx7e = await prisma.ledgerEntry.findMany({ where: { reference: { startsWith: `refund_ret_${returnRequest7eObj.id}` } } });
    let sumDebit7e = 0;
    let sumCredit7e = 0;
    for (const entry of ledgerTx7e) {
      sumDebit7e += Number(entry.debit);
      sumCredit7e += Number(entry.credit);
    }
    log(`Ledger entry validation (Case 7e): Sum Debit: ₹${sumDebit7e}, Sum Credit: ₹${sumCredit7e}`);
    if (sumDebit7e !== sumCredit7e || sumDebit7e === 0) {
      throw new Error("Ledger entries are not balanced or empty for Customer Fault refund.");
    }

    const shippingPayableEntry = ledgerTx7e.find((entry) => entry.accountName === "RETURN_SHIPPING_PAYABLE");
    if (!shippingPayableEntry || Number(shippingPayableEntry.credit) !== 180) {
      throw new Error("RETURN_SHIPPING_PAYABLE was not correctly credited with ₹180.");
    }
    log("RETURN_SHIPPING_PAYABLE credited with ₹180 successfully.");

    const commissionDebit7e = ledgerTx7e.find((entry) => entry.accountName === "PLATFORM_REVENUE");
    if (commissionDebit7e) {
      throw new Error("PLATFORM_REVENUE was debited/reversed for Customer Fault return.");
    }
    log("Platform commission correctly preserved for Customer Fault return.");

    const platformRecon = await reconcilePlatformFinancials();
    log(`Platform reconciliation details: ${JSON.stringify(platformRecon, null, 2)}`);
    if (platformRecon.difference !== 0) {
      const allEntries = await prisma.ledgerEntry.findMany({ orderBy: { createdAt: "asc" } });
      log("All Ledger Entries in DB:");
      for (const ent of allEntries) {
        log(`  [${ent.createdAt.toISOString()}] Ref: ${ent.reference.padEnd(30)} | Account: ${ent.accountName.padEnd(25)} | Debit: ${ent.debit} | Credit: ${ent.credit} | Desc: ${ent.description}`);
      }
      throw new Error(`Platform financials are out of balance! Difference: ${platformRecon.difference}`);
    }
    log("Platform reconciliation remains perfectly balanced at ₹0 difference.");

    // ----------------------------------------------------
    // TEST CASE 7f: Custom Return Reason Rule Validation
    // ----------------------------------------------------
    log("\n--- TEST CASE 7f: Custom Return Reason Rule Validation ---");

    setMockSession(adminUser.id, "ADMIN", adminUser.email, adminUser.name);

    const ruleName7f = "Item damaged or defective";
    let rule7f = await prisma.returnReasonRule.findFirst({ where: { name: { equals: ruleName7f, mode: "insensitive" } } });

    if (rule7f) {
      rule7f = await prisma.returnReasonRule.update({
        where: { id: rule7f.id },
        data: {
          responsibility: "SELLER_FAULT",
          originalShippingResponsibility: "CUSTOMER",
          returnShippingResponsibility: "SELLER",
          reverseCommission: false,
          isActive: true,
        },
      });
    } else {
      rule7f = await prisma.returnReasonRule.create({
        data: {
          name: ruleName7f,
          description: "Seller fault damaged or defective item",
          responsibility: "SELLER_FAULT",
          originalShippingResponsibility: "CUSTOMER",
          returnShippingResponsibility: "SELLER",
          reverseCommission: false,
          isActive: true,
        },
      });
    }
    log(`Rule created/loaded: ${rule7f.name} (id: ${rule7f.id})`);

    const ordNumF = `TEST-ORD-7FF-${Date.now()}`;
    const orderF = await prisma.order.create({
      data: {
        userId: customerUser.id,
        sellerId: sellerProfile.id,
        orderNumber: ordNumF,
        subtotal: 1000,
        shippingFee: 0,
        platformFee: 15,
        commissionAmount: 100,
        commissionRate: 0.10,
        discountAmount: 0,
        totalAmount: 1015,
        shippingAddress: "Test Address, India",
        status: "DELIVERED",
        paymentStatus: "PAID",
        items: {
          create: {
            variantId: testVariant.id,
            sellerId: sellerProfile.id,
            quantity: 1,
            price: 1000,
            productSnapshot: JSON.stringify({ name: testVariant.product.name }),
            variantSnapshot: JSON.stringify({ sku: testVariant.sku, size: testVariant.size }),
          },
        },
      },
    });
    createdOrderIds.push(orderF.id);

    await handleOrderDeliveredWallet(orderF.id);

    setMockSession(customerUser.id, "CUSTOMER", customerUser.email, customerUser.name);
    const returnReq7f = await requestReturn(orderF.id, "Item damaged or defective", "Arrived broken");
    if (!returnReq7f.success) {
      throw new Error(`Customer return request for 7f failed: ${returnReq7f.error}`);
    }

    const returnRequest7fObj = await prisma.returnRequest.findUnique({ where: { orderId: orderF.id } });
    if (!returnRequest7fObj) throw new Error("Return request 7f not found");

    await prisma.returnRequest.update({
      where: { id: returnRequest7fObj.id },
      data: { returnShippingFee: 180, deductionAmount: 0, customerRefundAmount: 1000, sellerDeductionAmount: 1180, platformCost: 0 },
    });

    setMockSession(adminUser.id, "ADMIN", adminUser.email, adminUser.name);
    const finalizeRefund7f = await finalizeRefundAdmin(returnRequest7fObj.id, "Finalizing seller fault return case 7f");
    if (!finalizeRefund7f.success) {
      throw new Error(`finalizeRefundAdmin 7f failed: ${finalizeRefund7f.error}`);
    }

    const finalReturnReq7f = await prisma.returnRequest.findUnique({ where: { id: returnRequest7fObj.id } });
    if (!finalReturnReq7f) throw new Error("finalReturnReq7f not found");

    log(`Case 7f values: customerRefundAmount: ${finalReturnReq7f.customerRefundAmount}, sellerDeductionAmount: ${finalReturnReq7f.sellerDeductionAmount}, platformCost: ${finalReturnReq7f.platformCost}`);

    if (Number(finalReturnReq7f.customerRefundAmount) !== 1000) {
      throw new Error(`Customer Refund Amount was expected to be 1000, but is ${finalReturnReq7f.customerRefundAmount}`);
    }
    if (Number(finalReturnReq7f.sellerDeductionAmount) !== 1180) {
      throw new Error(`Seller Deduction Amount was expected to be 1180, but is ${finalReturnReq7f.sellerDeductionAmount}`);
    }
    if (Number(finalReturnReq7f.deductionAmount) !== 0) {
      throw new Error(`Customer deduction was expected to be 0, but is ${finalReturnReq7f.deductionAmount}`);
    }
    if (Number(finalReturnReq7f.platformCost) !== 0) {
      throw new Error(`Platform Cost was expected to be 0, but is ${finalReturnReq7f.platformCost}`);
    }

    const ledgerTx7f = await prisma.ledgerEntry.findMany({ where: { reference: { startsWith: `refund_ret_${returnRequest7fObj.id}` } } });
    let sumDebit7f = 0;
    let sumCredit7f = 0;
    for (const entry of ledgerTx7f) {
      sumDebit7f += Number(entry.debit);
      sumCredit7f += Number(entry.credit);
    }
    log(`Ledger entry validation (Case 7f): Sum Debit: ₹${sumDebit7f}, Sum Credit: ₹${sumCredit7f}`);
    if (sumDebit7f !== sumCredit7f || sumDebit7f === 0) {
      throw new Error("Ledger entries are not balanced or empty for Case 7f refund.");
    }

    const shippingPayableEntry7f = ledgerTx7f.find((entry) => entry.accountName === "RETURN_SHIPPING_PAYABLE");
    if (!shippingPayableEntry7f || Number(shippingPayableEntry7f.credit) !== 180) {
      throw new Error("RETURN_SHIPPING_PAYABLE was not correctly credited with ₹180 in Case 7f.");
    }
    log("RETURN_SHIPPING_PAYABLE credited with ₹180 successfully in Case 7f.");

    const commissionDebit7f = ledgerTx7f.find((entry) => entry.accountName === "PLATFORM_REVENUE");
    if (commissionDebit7f) {
      throw new Error("PLATFORM_REVENUE was debited/reversed for Seller Fault return in Case 7f.");
    }
    log("Platform commission correctly preserved for Case 7f return.");

    const platformRecon7f = await reconcilePlatformFinancials();
    log(`Platform reconciliation difference (Post Case 7f): ₹${platformRecon7f.difference}`);
    if (platformRecon7f.difference !== 0) {
      throw new Error(`Platform financials are out of balance after Case 7f! Difference: ${platformRecon7f.difference}`);
    }
    log("Platform reconciliation remains perfectly balanced at ₹0 difference after Case 7f.");

    // ----------------------------------------------------
    // TEST CASE 8: Disputes mediation
    // ----------------------------------------------------
    log("\n--- TEST CASE 8: Disputes mediation ---");

    setMockSession(customerUser.id, "CUSTOMER", customerUser.email, customerUser.name);
    const disputeResult = await createDispute({
      orderId: testOrder3.id,
      productId: testVariant.productId,
      sellerId: sellerProfile.id,
      reason: "Defective item",
      description: "The shirt stitches are coming off.",
    });
    log(`createDispute result: ${JSON.stringify(disputeResult)}`);
    if (!disputeResult.success || !disputeResult.disputeId) {
      throw new Error("Dispute filing failed.");
    }
    createdDisputeIds.push(disputeResult.disputeId);

    const custNoteResult = await addDisputeNote(disputeResult.disputeId, "Adding photos in a bit.", false);
    if (!custNoteResult.success) {
      throw new Error("Customer dispute note failed.");
    }

    setMockSession(adminUser.id, "ADMIN", adminUser.email, adminUser.name);
    const adminInternalNote = await addDisputeNote(disputeResult.disputeId, "Staff note: Seller has history of QC issues.", true);
    if (!adminInternalNote.success) {
      throw new Error("Admin internal dispute note failed.");
    }

    const updateDisResult = await updateDisputeAdmin(disputeResult.disputeId, {
      status: "IN_REVIEW",
      priority: "HIGH",
      adminNotes: "Reviewing seller transaction logs.",
    });
    if (!updateDisResult.success) {
      throw new Error("Admin update dispute details failed.");
    }

    const dispute = await prisma.dispute.findUnique({ where: { id: disputeResult.disputeId }, include: { notes: true } });
    if (!dispute || dispute.status !== "IN_REVIEW" || dispute.priority !== "HIGH" || dispute.notes.length !== 2) {
      throw new Error("Dispute state updates or notes list is incorrect.");
    }
    log("Dispute and mediation note trails validated successfully.");

    log("\n=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY ===");
  } finally {
    await runCleanup(adminUser);
    setMockSessionForTesting(null);
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n!!! TEST FAILED:", err);
    process.exit(1);
  });
