import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

// Copy the platform reconciliation logic from actions/wallets.ts
async function reconcilePlatformFinancials() {
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

  const totalCustomerPayments = (customerPayments._sum.debit || new Decimal(0)).minus(customerPayments._sum.credit || new Decimal(0));
  const totalPlatformRevenue = (platformRevenue._sum.credit || new Decimal(0)).minus(platformRevenue._sum.debit || new Decimal(0));
  const totalPlatformShipping = (platformShipping._sum.credit || new Decimal(0)).minus(platformShipping._sum.debit || new Decimal(0));
  const totalPlatformFees = (platformFees._sum.credit || new Decimal(0)).minus(platformFees._sum.debit || new Decimal(0));
  const totalRefunds = (customerRefunds._sum.credit || new Decimal(0)).minus(customerRefunds._sum.debit || new Decimal(0));
  const totalPayouts = (payoutOutflows._sum.credit || new Decimal(0)).minus(payoutOutflows._sum.debit || new Decimal(0));
  const totalAdjustments = (platformAdjustments._sum.debit || new Decimal(0)).minus(platformAdjustments._sum.credit || new Decimal(0));
  const totalReturnShippingPayable = (returnShippingPayables._sum.credit || new Decimal(0)).minus(returnShippingPayables._sum.debit || new Decimal(0));
  const totalPlatformRefundExpense = (platformRefundExpenses._sum.debit || new Decimal(0)).minus(platformRefundExpenses._sum.credit || new Decimal(0));

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
  
  console.log({
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
  });
}

reconcilePlatformFinancials().catch(console.error);
