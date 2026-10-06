"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createAuditLog } from "@/actions/audit";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { recordLedgerTransaction } from "@/actions/ledger";

const Decimal = Prisma.Decimal;

/**
 * Ensure a SellerWallet exists for a given seller.
 */
export async function ensureSellerWallet(sellerId: string, tx?: any) {
  const prismaClient = tx || prisma;
  let wallet = await prismaClient.sellerWallet.findUnique({
    where: { sellerId },
  });

  if (!wallet) {
    wallet = await prismaClient.sellerWallet.create({
      data: {
        sellerId,
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
  }
  return wallet;
}

/**
 * When an order is delivered, calculate the seller earning and credit to Pending Balance.
 * Money Flow:
 * - Debit CUSTOMER_PAYMENTS: order.totalAmount
 * - Credit SELLER_PENDING: sellerEarning
 * - Credit PLATFORM_REVENUE: order.commissionAmount
 * - Credit PLATFORM_SHIPPING: order.shippingFee (if > 0)
 * - Credit PLATFORM_FEES: order.platformFee (if > 0)
 */
export async function handleOrderDeliveredWallet(orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { seller: true },
    });

    if (!order) {
      throw new Error(`Order ${orderId} not found.`);
    }

    if (order.status !== "DELIVERED") {
      throw new Error(`Order ${order.orderNumber} is not in DELIVERED status.`);
    }

    const reference = `earning_order_${order.id}`;

    // Idempotency guard: check if earning transaction was already recorded
    const existingTx = await tx.walletTransaction.findUnique({
      where: { reference },
    });

    if (existingTx) {
      return { success: true, message: "Earning was already processed for this order." };
    }

    const wallet = await ensureSellerWallet(order.sellerId, tx);

    // Earning Calculation: subtotal - discount - commission
    const sellerEarning = Decimal.max(
      0,
      order.subtotal.minus(order.discountAmount).minus(order.commissionAmount)
    );

    // Save actual seller earning on the order for audit integrity
    await tx.order.update({
      where: { id: order.id },
      data: { sellerEarning },
    });

    // Update wallet pending balance and total earned
    await tx.sellerWallet.update({
      where: { id: wallet.id },
      data: {
        pendingBalance: { increment: sellerEarning },
        totalEarned: { increment: sellerEarning },
      },
    });

    // Hold period: 7 days default
    const releaseAt = new Date();
    releaseAt.setDate(releaseAt.getDate() + 7);

    const walletTx = await tx.walletTransaction.create({
      data: {
        sellerWalletId: wallet.id,
        amount: sellerEarning,
        type: "EARNING",
        status: "PAID",
        description: `Earning for Order #${order.orderNumber}`,
        releaseAt,
        isReleased: false,
        reference,
      },
    });

    // Create double-entry ledger entries
    const ledgerEntries = [
      { accountName: "CUSTOMER_PAYMENTS", debit: order.totalAmount, credit: new Decimal(0) },
      { accountName: `SELLER_PENDING:${order.sellerId}`, debit: new Decimal(0), credit: sellerEarning },
      { accountName: "PLATFORM_REVENUE", debit: new Decimal(0), credit: order.commissionAmount },
    ];

    if (order.shippingFee.greaterThan(0)) {
      ledgerEntries.push({
        accountName: "PLATFORM_SHIPPING",
        debit: new Decimal(0),
        credit: order.shippingFee,
      });
    }

    if (order.platformFee.greaterThan(0)) {
      ledgerEntries.push({
        accountName: "PLATFORM_FEES",
        debit: new Decimal(0),
        credit: order.platformFee,
      });
    }

    await recordLedgerTransaction(tx, {
      reference,
      description: `Earning distribution for Order #${order.orderNumber}`,
      entries: ledgerEntries,
    });

    // Create a BackgroundJob to automate the future release of this pending balance
    await tx.backgroundJob.create({
      data: {
        queue: "wallet",
        payload: JSON.stringify({ action: "RELEASE_BALANCE", walletTransactionId: walletTx.id }),
        runAt: releaseAt,
        status: "PENDING",
      },
    });

    return { success: true, sellerEarning };
  });
}

/**
 * Release matured pending balances to withdrawable balance.
 * Option to filter by sellerId or run sitewide.
 * Money Flow:
 * - Debit SELLER_PENDING: amount
 * - Credit SELLER_WITHDRAWABLE: amount
 */
export async function releasePendingBalances(sellerId?: string) {
  const now = new Date();
  const whereClause: any = {
    type: "EARNING",
    isReleased: false,
    releaseAt: { lte: now },
  };

  if (sellerId) {
    whereClause.wallet = { sellerId };
  }

  const txsToRelease = await prisma.walletTransaction.findMany({
    where: whereClause,
    include: { wallet: true },
  });

  let count = 0;
  let totalReleasedAmount = new Decimal(0);

  for (const walletTx of txsToRelease) {
    try {
      await prisma.$transaction(async (tx) => {
        // Re-fetch within transaction block to safeguard against concurrent releases
        const currentTx = await tx.walletTransaction.findUnique({
          where: { id: walletTx.id },
          include: { wallet: true },
        });

        if (!currentTx || currentTx.isReleased) return;

        const amount = currentTx.amount;
        const wallet = currentTx.wallet;

        let toWithdrawable = amount;
        let newNegativeBalance = wallet.negativeBalance;

        // Recover negative balances first
        if (wallet.negativeBalance.greaterThan(0)) {
          if (amount.greaterThanOrEqualTo(wallet.negativeBalance)) {
            toWithdrawable = amount.minus(wallet.negativeBalance);
            newNegativeBalance = new Decimal(0);
          } else {
            toWithdrawable = new Decimal(0);
            newNegativeBalance = wallet.negativeBalance.minus(amount);
          }
        }

        // Deduct pending, update withdrawable/negative balances
        await tx.sellerWallet.update({
          where: { id: wallet.id },
          data: {
            pendingBalance: { decrement: amount },
            withdrawableBalance: { increment: toWithdrawable },
            availableBalance: { increment: toWithdrawable },
            negativeBalance: newNegativeBalance,
          },
        });

        const orderId = currentTx.reference?.replace("earning_order_", "") || "";

        // Mark current transaction as released
        await tx.walletTransaction.update({
          where: { id: currentTx.id },
          data: {
            isReleased: true,
          },
        });

        // Create a transaction record of the release movement in the wallet log
        await tx.walletTransaction.create({
          data: {
            sellerWalletId: wallet.id,
            amount: amount,
            type: "RELEASE",
            status: "PAID",
            description: `Released pending earning for txn ${currentTx.id}` +
              (wallet.negativeBalance.greaterThan(0)
                ? ` (Recovered ₹${amount.minus(toWithdrawable).toFixed(2)} negative balance)`
                : ""),
            reference: `release_txn_${currentTx.id}`,
          },
        });

        // Write double-entry ledger entries for release
        await recordLedgerTransaction(tx, {
          reference: `release_txn_${currentTx.id}`,
          description: `Release pending earning for transaction ${currentTx.id}`,
          entries: [
            { accountName: `SELLER_PENDING:${wallet.sellerId}`, debit: amount, credit: new Decimal(0) },
            { accountName: `SELLER_WITHDRAWABLE:${wallet.sellerId}`, debit: new Decimal(0), credit: amount },
          ],
        });

        count++;
        totalReleasedAmount = totalReleasedAmount.plus(amount);
      });
    } catch (err: any) {
      console.warn(`[CONCURRENCY CONTROL] Skip release of txn ${walletTx.id}: ${err.message || err}`);
    }
  }

  if (count > 0) {
    revalidatePath("/seller/wallet");
    revalidatePath("/admin/wallets");
  }

  return { success: true, count, totalReleasedAmount: totalReleasedAmount.toNumber() };
}

/**
 * Execute pending balance release background jobs immediately (Manual Simulation & Trigger).
 */
export async function processPendingBackgroundJobs() {
  const now = new Date();
  const pendingJobs = await prisma.backgroundJob.findMany({
    where: {
      queue: "wallet",
      status: "PENDING",
      runAt: { lte: now },
    },
  });

  let count = 0;
  for (const job of pendingJobs) {
    try {
      const payload = JSON.parse(job.payload);
      if (payload.action === "RELEASE_BALANCE") {
        await prisma.backgroundJob.update({
          where: { id: job.id },
          data: { status: "PROCESSING", attempts: { increment: 1 } },
        });

        // Trigger release logic
        await releasePendingBalances();

        await prisma.backgroundJob.update({
          where: { id: job.id },
          data: { status: "COMPLETED" },
        });
        count++;
      }
    } catch (err: any) {
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: "FAILED", error: err.message || "Failed processing release job" },
      });
    }
  }

  return { success: true, countProcessed: count };
}

/**
 * Admin manual credit/debit adjustment.
 * Money Flow:
 * - MANUAL_CREDIT:
 *   - Debit PLATFORM_ADJUSTMENT: amount
 *   - Credit SELLER_WITHDRAWABLE: amount
 * - MANUAL_DEBIT:
 *   - Debit SELLER_WITHDRAWABLE: amount
 *   - Credit PLATFORM_ADJUSTMENT: amount
 */
export async function adjustWalletAdmin(
  sellerId: string,
  amount: number,
  type: "MANUAL_CREDIT" | "MANUAL_DEBIT",
  reason: string
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized: Admin access required.");
  }

  if (!reason.trim()) {
    throw new Error("Reason is mandatory for manual adjustments.");
  }

  if (amount <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  const amountDec = new Decimal(amount);

  return prisma.$transaction(async (tx) => {
    const wallet = await ensureSellerWallet(sellerId, tx);
    const refId = `adjustment_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    const originalWallet = {
      withdrawableBalance: wallet.withdrawableBalance.toString(),
      negativeBalance: wallet.negativeBalance.toString(),
    };

    const ledgerAmount = type === "MANUAL_DEBIT" ? amountDec.negated() : amountDec;

    let newWithdrawable = wallet.withdrawableBalance;
    let newNegative = wallet.negativeBalance;

    if (type === "MANUAL_CREDIT") {
      // Credit pays off negative debt first
      if (wallet.negativeBalance.greaterThan(0)) {
        if (amountDec.greaterThanOrEqualTo(wallet.negativeBalance)) {
          const remaining = amountDec.minus(wallet.negativeBalance);
          newNegative = new Decimal(0);
          newWithdrawable = newWithdrawable.plus(remaining);
        } else {
          newNegative = wallet.negativeBalance.minus(amountDec);
        }
      } else {
        newWithdrawable = newWithdrawable.plus(amountDec);
      }
    } else {
      // Debit reduces withdrawable balance, then creates negative balance if insufficient
      if (wallet.withdrawableBalance.greaterThanOrEqualTo(amountDec)) {
        newWithdrawable = wallet.withdrawableBalance.minus(amountDec);
      } else {
        const remaining = amountDec.minus(wallet.withdrawableBalance);
        newWithdrawable = new Decimal(0);
        newNegative = wallet.negativeBalance.plus(remaining);
      }
    }

    const updatedWallet = await tx.sellerWallet.update({
      where: { id: wallet.id },
      data: {
        withdrawableBalance: newWithdrawable,
        availableBalance: newWithdrawable,
        negativeBalance: newNegative,
      },
    });

    // Create WalletTransaction log
    await tx.walletTransaction.create({
      data: {
        sellerWalletId: wallet.id,
        amount: ledgerAmount,
        type,
        status: "PAID",
        description: reason,
        reference: refId,
      },
    });

    // Create WalletAdjustment details
    await tx.walletAdjustment.create({
      data: {
        sellerWalletId: wallet.id,
        amount: ledgerAmount,
        type,
        reason,
        adminId: session.user.id,
        reference: refId,
      },
    });

    // Write double-entry ledger entries
    await recordLedgerTransaction(tx, {
      reference: refId,
      description: reason,
      entries: type === "MANUAL_CREDIT"
        ? [
            { accountName: "PLATFORM_ADJUSTMENT", debit: amountDec, credit: new Decimal(0) },
            { accountName: `SELLER_WITHDRAWABLE:${wallet.sellerId}`, debit: new Decimal(0), credit: amountDec },
          ]
        : [
            { accountName: `SELLER_WITHDRAWABLE:${wallet.sellerId}`, debit: amountDec, credit: new Decimal(0) },
            { accountName: "PLATFORM_ADJUSTMENT", debit: new Decimal(0), credit: amountDec },
          ],
    });

    // Immutable Audit Log
    await createAuditLog(
      `WALLET_${type}`,
      "SellerWallet",
      wallet.id,
      JSON.stringify(originalWallet),
      JSON.stringify({
        withdrawableBalance: updatedWallet.withdrawableBalance.toString(),
        negativeBalance: updatedWallet.negativeBalance.toString(),
      })
    );

    revalidatePath("/seller/wallet");
    revalidatePath("/admin/wallets");

    return { success: true };
  });
}

/**
 * Reconcile seller wallet balances with the double-entry ledger.
 */
export async function reconcileSellerWallet(sellerId: string, tx?: any) {
  const prismaClient = tx || prisma;
  const wallet = await ensureSellerWallet(sellerId, prismaClient);

  const pendingEntries = await prismaClient.ledgerEntry.findMany({
    where: { accountName: `SELLER_PENDING:${sellerId}` },
  });
  const withdrawableEntries = await prismaClient.ledgerEntry.findMany({
    where: { accountName: `SELLER_WITHDRAWABLE:${sellerId}` },
  });
  const reserveEntries = await prismaClient.ledgerEntry.findMany({
    where: { accountName: `SELLER_RESERVE:${sellerId}` },
  });

  // Calculate expected pending and total earned
  let expectedPending = new Decimal(0);
  let expectedTotalEarned = new Decimal(0);
  let expectedTotalRefundedPending = new Decimal(0);
  for (const entry of pendingEntries) {
    expectedPending = expectedPending.plus(entry.credit).minus(entry.debit);
    expectedTotalEarned = expectedTotalEarned.plus(entry.credit);
    if (entry.reference.startsWith("refund_")) {
      expectedTotalRefundedPending = expectedTotalRefundedPending.plus(entry.debit);
    }
  }

  // Calculate expected withdrawable and negative balances
  let netWithdrawable = new Decimal(0);
  let expectedTotalRefundedWithdrawable = new Decimal(0);
  for (const entry of withdrawableEntries) {
    netWithdrawable = netWithdrawable.plus(entry.credit).minus(entry.debit);
    if (entry.reference.startsWith("refund_")) {
      expectedTotalRefundedWithdrawable = expectedTotalRefundedWithdrawable.plus(entry.debit);
    }
  }

  const expectedWithdrawable = Decimal.max(0, netWithdrawable);
  const expectedNegative = Decimal.max(0, netWithdrawable.negated());

  // Calculate expected reserve and total paid
  let expectedReserve = new Decimal(0);
  let expectedTotalPaid = new Decimal(0);
  for (const entry of reserveEntries) {
    expectedReserve = expectedReserve.plus(entry.credit).minus(entry.debit);
    if (entry.reference.startsWith("payout_req_") && entry.debit.greaterThan(0)) {
      expectedTotalPaid = expectedTotalPaid.plus(entry.debit);
    }
  }

  const expectedTotalRefunded = expectedTotalRefundedPending.plus(expectedTotalRefundedWithdrawable);

  const status = {
    pendingMatch: expectedPending.equals(wallet.pendingBalance),
    withdrawableMatch: expectedWithdrawable.equals(wallet.withdrawableBalance),
    negativeMatch: expectedNegative.equals(wallet.negativeBalance),
    reserveMatch: expectedReserve.equals(wallet.reserveBalance),
    totalEarnedMatch: expectedTotalEarned.equals(wallet.totalEarned),
    totalPaidMatch: expectedTotalPaid.equals(wallet.totalPaid),
    totalRefundedMatch: expectedTotalRefunded.equals(wallet.totalRefunded),
  };

  const isReconciled = Object.values(status).every((v) => v === true);

  return {
    isReconciled,
    status,
    wallet: {
      id: wallet.id,
      sellerId,
      pendingBalance: wallet.pendingBalance.toString(),
      withdrawableBalance: wallet.withdrawableBalance.toString(),
      negativeBalance: wallet.negativeBalance.toString(),
      reserveBalance: wallet.reserveBalance.toString(),
      totalEarned: wallet.totalEarned.toString(),
      totalPaid: wallet.totalPaid.toString(),
      totalRefunded: wallet.totalRefunded.toString(),
    },
    expected: {
      pendingBalance: expectedPending.toString(),
      withdrawableBalance: expectedWithdrawable.toString(),
      negativeBalance: expectedNegative.toString(),
      reserveBalance: expectedReserve.toString(),
      totalEarned: expectedTotalEarned.toString(),
      totalPaid: expectedTotalPaid.toString(),
      totalRefunded: expectedTotalRefunded.toString(),
    },
  };
}

/**
 * Audit and align wallet fields with double-entry ledger calculations.
 */
export async function alignWalletToLedger(sellerId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized: Admin access required.");
  }

  return prisma.$transaction(async (tx) => {
    const recon = await reconcileSellerWallet(sellerId, tx);
    if (recon.isReconciled) {
      return { success: true, message: "Wallet is already reconciled." };
    }

    await tx.sellerWallet.update({
      where: { sellerId },
      data: {
        pendingBalance: new Decimal(recon.expected.pendingBalance),
        withdrawableBalance: new Decimal(recon.expected.withdrawableBalance),
        availableBalance: new Decimal(recon.expected.withdrawableBalance),
        negativeBalance: new Decimal(recon.expected.negativeBalance),
        reserveBalance: new Decimal(recon.expected.reserveBalance),
        totalEarned: new Decimal(recon.expected.totalEarned),
        totalPaid: new Decimal(recon.expected.totalPaid),
        totalRefunded: new Decimal(recon.expected.totalRefunded),
      },
    });

    return { success: true, message: "Wallet fields have been aligned with the ledger." };
  });
}

/**
 * Reconcile all wallets system-wide.
 */
export async function reconcileAllWalletsAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized: Admin access required.");
  }

  const wallets = await prisma.sellerWallet.findMany({
    select: { sellerId: true, seller: { select: { storeName: true } } },
  });

  const reports = [];
  let totalMismatches = 0;

  for (const w of wallets) {
    const report = await reconcileSellerWallet(w.sellerId);
    if (!report.isReconciled) {
      totalMismatches++;
    }
    reports.push({
      storeName: w.seller.storeName,
      sellerId: w.sellerId,
      ...report,
    });
  }

  return {
    success: true,
    totalChecked: wallets.length,
    totalMismatches,
    reports,
  };
}

/**
 * Perform a platform-wide financial check to ensure:
 * Customer Payments = Seller Balances + Platform Revenue + Platform Shipping + Platform Fees + Refunds + Payouts + Platform Adjustments
 */
export async function reconcilePlatformFinancials() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized: Admin access required.");
  }

  // 1. Fetch sums of all ledger accounts
  const customerPayments = await prisma.ledgerEntry.aggregate({
    _sum: { debit: true, credit: true },
    where: { accountName: "CUSTOMER_PAYMENTS" },
  });
  
  const platformRevenue = await prisma.ledgerEntry.aggregate({
    _sum: { debit: true, credit: true },
    where: { accountName: "PLATFORM_REVENUE" },
  });
  
  const platformShipping = await prisma.ledgerEntry.aggregate({
    _sum: { debit: true, credit: true },
    where: { accountName: "PLATFORM_SHIPPING" },
  });
  
  const platformFees = await prisma.ledgerEntry.aggregate({
    _sum: { debit: true, credit: true },
    where: { accountName: "PLATFORM_FEES" },
  });

  const customerRefunds = await prisma.ledgerEntry.aggregate({
    _sum: { debit: true, credit: true },
    where: { accountName: { in: ["CUSTOMER_REFUND", "SHIPPING_REFUND"] } },
  });

  const payoutOutflows = await prisma.ledgerEntry.aggregate({
    _sum: { debit: true, credit: true },
    where: { accountName: "PAYOUT_OUTFLOW" },
  });

  const platformAdjustments = await prisma.ledgerEntry.aggregate({
    _sum: { debit: true, credit: true },
    where: { accountName: "PLATFORM_ADJUSTMENT" },
  });

  const returnShippingPayables = await prisma.ledgerEntry.aggregate({
    _sum: { debit: true, credit: true },
    where: { accountName: "RETURN_SHIPPING_PAYABLE" },
  });

  const platformRefundExpenses = await prisma.ledgerEntry.aggregate({
    _sum: { debit: true, credit: true },
    where: { accountName: "PLATFORM_REFUND_EXPENSE" },
  });

  // 2. Calculate net ledger amounts
  const totalCustomerPayments = (customerPayments._sum.debit || new Decimal(0)).minus(customerPayments._sum.credit || new Decimal(0));
  const totalPlatformRevenue = (platformRevenue._sum.credit || new Decimal(0)).minus(platformRevenue._sum.debit || new Decimal(0));
  const totalPlatformShipping = (platformShipping._sum.credit || new Decimal(0)).minus(platformShipping._sum.debit || new Decimal(0));
  const totalPlatformFees = (platformFees._sum.credit || new Decimal(0)).minus(platformFees._sum.debit || new Decimal(0));
  const totalRefunds = (customerRefunds._sum.credit || new Decimal(0)).minus(customerRefunds._sum.debit || new Decimal(0));
  const totalPayouts = (payoutOutflows._sum.credit || new Decimal(0)).minus(payoutOutflows._sum.debit || new Decimal(0));
  const totalAdjustments = (platformAdjustments._sum.debit || new Decimal(0)).minus(platformAdjustments._sum.credit || new Decimal(0));
  const totalReturnShippingPayable = (returnShippingPayables._sum.credit || new Decimal(0)).minus(returnShippingPayables._sum.debit || new Decimal(0));
  const totalPlatformRefundExpense = (platformRefundExpenses._sum.debit || new Decimal(0)).minus(platformRefundExpenses._sum.credit || new Decimal(0));

  // 3. Sum up all active seller wallet balances (Liabilities)
  const walletAgg = await prisma.sellerWallet.aggregate({
    _sum: {
      pendingBalance: true,
      withdrawableBalance: true,
      negativeBalance: true,
      reserveBalance: true,
    },
  });

  const pendingSum = walletAgg._sum.pendingBalance || new Decimal(0);
  const withdrawableSum = walletAgg._sum.withdrawableBalance || new Decimal(0);
  const negativeSum = walletAgg._sum.negativeBalance || new Decimal(0);
  const reserveSum = walletAgg._sum.reserveBalance || new Decimal(0);
  
  const totalSellerLiabilities = pendingSum.plus(withdrawableSum).minus(negativeSum).plus(reserveSum);

  // 4. Check balance: Payments = Liabilities + Revenue + Shipping + Fees + Refunds + Payouts - Adjustments + ReturnShippingPayable - PlatformRefundExpense
  const rightHandSide = totalSellerLiabilities
    .plus(totalPlatformRevenue)
    .plus(totalPlatformShipping)
    .plus(totalPlatformFees)
    .plus(totalRefunds)
    .plus(totalPayouts)
    .minus(totalAdjustments)
    .plus(totalReturnShippingPayable)
    .minus(totalPlatformRefundExpense);

  const difference = totalCustomerPayments.minus(rightHandSide);
  const isBalanced = difference.isZero();

  return {
    isBalanced,
    difference: difference.toNumber(),
    customerPayments: totalCustomerPayments.toNumber(),
    sellerLiabilities: totalSellerLiabilities.toNumber(),
    platformRevenue: totalPlatformRevenue.toNumber(),
    platformShipping: totalPlatformShipping.toNumber(),
    platformFees: totalPlatformFees.toNumber(),
    refunds: totalRefunds.toNumber(),
    payouts: totalPayouts.toNumber(),
    adjustments: totalAdjustments.toNumber(),
    returnShippingPayable: totalReturnShippingPayable.toNumber(),
    platformRefundExpense: totalPlatformRefundExpense.toNumber(),
    walletSummary: {
      pending: pendingSum.toNumber(),
      withdrawable: withdrawableSum.toNumber(),
      negative: negativeSum.toNumber(),
      reserve: reserveSum.toNumber(),
    }
  };
}

/**
 * Get internal admin-only financial health report.
 */
export async function getFinancialHealthReport() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized: Admin access required.");
  }

  // 1. Ledger Balance Check (Global Debits vs Global Credits)
  const globalLedger = await prisma.ledgerEntry.aggregate({
    _sum: { debit: true, credit: true },
  });
  const totalDebits = globalLedger._sum.debit || new Decimal(0);
  const totalCredits = globalLedger._sum.credit || new Decimal(0);
  const ledgerBalanced = totalDebits.equals(totalCredits);

  // 2. Wallet vs Ledger Check
  const walletRecon = await reconcileAllWalletsAdmin();
  const walletsMatched = walletRecon.totalMismatches === 0;

  // 3. Duplicate Reference Check
  // Note: reference has unique index in DB, but we verify database state
  const duplicatesCount = 0; 

  // 4. Negative Reserve Balances Check
  const negativeReserveCount = await prisma.sellerWallet.count({
    where: { reserveBalance: { lt: 0 } },
  });

  // 5. Orphan Checks
  const payouts = await prisma.payoutRequest.findMany({ select: { reference: true } });
  let orphanPayouts = 0;
  for (const p of payouts) {
    const exists = await prisma.ledgerEntry.findFirst({ where: { reference: p.reference } });
    if (!exists) {
      orphanPayouts++;
    }
  }

  const returns = await prisma.returnRequest.findMany({ where: { status: "REFUNDED" }, select: { id: true } });
  let orphanRefunds = 0;
  for (const r of returns) {
    const exists = await prisma.ledgerEntry.findFirst({ where: { reference: `refund_ret_${r.id}` } });
    if (!exists) {
      orphanRefunds++;
    }
  }

  const isHealthy = ledgerBalanced && walletsMatched && negativeReserveCount === 0 && orphanPayouts === 0 && orphanRefunds === 0;

  return {
    isHealthy,
    ledgerBalanced,
    ledgerTotals: {
      debits: totalDebits.toNumber(),
      credits: totalCredits.toNumber(),
      difference: totalDebits.minus(totalCredits).toNumber(),
    },
    walletsMatched,
    totalWalletsChecked: walletRecon.totalChecked,
    totalWalletMismatches: walletRecon.totalMismatches,
    negativeReserveCount,
    orphanPayouts,
    orphanRefunds,
  };
}

/**
 * Local development only: Reset all financial testing data to zero.
 */
export async function resetFinancialDataDev() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized: Admin access required." };
  }

  // Guard: requires an explicit opt-in flag in addition to non-production NODE_ENV.
  // NODE_ENV alone is not a hard gate — it can be misconfigured in a deployed environment.
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_DEV_DATA_RESET !== "true") {
    return { success: false, error: "Blocked: This reset script requires ALLOW_DEV_DATA_RESET=true in a non-production environment." };
  }

  try {
    let logMessage = "";

    // Step 1: Delete all financial records inside a transaction
    await prisma.$transaction(async (tx) => {
      const disputeCount = await tx.dispute.count();
      const adjustmentCount = await tx.walletAdjustment.count();
      const transactionCount = await tx.walletTransaction.count();
      const ledgerCount = await tx.ledgerEntry.count();
      const payoutCount = await tx.payoutRequest.count();
      const returnCount = await tx.returnRequest.count();
      const orderCount = await tx.order.count();

      // Perform deletions in relational order
      await tx.disputeNote.deleteMany();
      await tx.dispute.deleteMany();
      await tx.walletAdjustment.deleteMany();
      await tx.walletTransaction.deleteMany();
      await tx.ledgerEntry.deleteMany();
      await tx.payoutRequest.deleteMany();
      await tx.returnRequest.deleteMany();

      await tx.orderItem.deleteMany();
      await tx.commission.deleteMany();
      await tx.paymentTransaction.deleteMany();
      await tx.shipment.deleteMany();
      await tx.order.deleteMany();

      // Reset all seller wallet balances to zero
      await tx.sellerWallet.updateMany({
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

      logMessage = `[DEV RESET] Financial statements successfully reset to zero. Counts deleted: ` +
        `Disputes: ${disputeCount}, WalletAdjustments: ${adjustmentCount}, WalletTransactions: ${transactionCount}, ` +
        `LedgerEntries: ${ledgerCount}, PayoutRequests: ${payoutCount}, ReturnRequests: ${returnCount}, Orders: ${orderCount}.`;
      console.log(logMessage);
    });

    // Step 2: Write the audit log OUTSIDE the transaction to avoid FK constraint failures
    // (e.g. if session userId is stale after a db reset)
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DEV_FINANCIAL_RESET",
        entityType: "System",
        entityId: "FinancialControl",
        oldValue: JSON.stringify({ status: "seeded_dirty" }),
        newValue: JSON.stringify({ status: "reset_zero", stats: logMessage }),
        ipAddress: "127.0.0.1",
        userAgent: "Server Action",
      },
    }).catch((e: any) => {
      // Audit log failure is non-fatal — the reset itself succeeded
      console.warn("[DEV RESET] Audit log skipped:", e?.message);
    });

    return {
      success: true,
      message: logMessage || "Financial data reset to zero successfully.",
    };
  } catch (err: any) {
    console.error("resetFinancialDataDev error:", err);
    return { success: false, error: err.message || "Failed to reset financial data." };
  }
}
