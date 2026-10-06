import React from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ensureSellerWallet } from "@/actions/wallets";
import { serializeDecimals } from "@/lib/serialize";
import SellerClient from "./seller-client";

export default async function SellerDashboard() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    redirect("/login");
  }

  // Resolve Seller Profile
  const profile = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
    include: { kyc: true, wallet: true },
  });

  if (!profile) {
    redirect("/login");
  }

  const kycStatus = profile.kyc?.status || "NOT_SUBMITTED";
  const rejectionReason = profile.kyc?.rejectionReason || null;
  const wallet = profile.wallet || (await ensureSellerWallet(profile.id));

  // Define date thresholds
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Parallel database metrics aggregation for the seller
  const [
    todayOrdersCount,
    pendingOrdersCount,
    deliveredOrdersCount,
    returnRequestsCount,
    totalCompletedOrders,
    totalReturnedRequests,
    revenueAgg,
    lowStockVariants,
    outOfStockVariants,
    recentOrders,
    ordersToShip,
    userPreference,
  ] = await Promise.all([
    // Counts
    prisma.order.count({ where: { sellerId: profile.id, createdAt: { gte: todayStart } } }),
    prisma.order.count({ where: { sellerId: profile.id, status: "PENDING" } }),
    prisma.order.count({ where: { sellerId: profile.id, status: "DELIVERED" } }),
    prisma.returnRequest.count({ where: { sellerId: profile.id, status: "REQUESTED" } }),
    
    // Completed metrics for refund rates
    prisma.order.count({
      where: { sellerId: profile.id, status: { in: ["DELIVERED", "RETURNED", "REFUNDED"] } },
    }),
    prisma.returnRequest.count({
      where: { sellerId: profile.id, status: "REFUNDED" },
    }),

    // Revenue summation
    prisma.order.aggregate({
      where: { sellerId: profile.id, status: "DELIVERED" },
      _sum: { subtotal: true },
    }),

    // Inventory status checks
    prisma.productVariant.findMany({
      where: { product: { sellerId: profile.id }, stock: { gt: 0, lte: 5 } },
      include: { product: true },
      orderBy: { stock: "asc" },
      take: 10,
    }),
    prisma.productVariant.findMany({
      where: { product: { sellerId: profile.id }, stock: 0 },
      include: { product: true },
      take: 10,
    }),

    // Lists
    prisma.order.findMany({
      where: { sellerId: profile.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { user: { select: { name: true } } },
    }),
    prisma.order.findMany({
      where: { sellerId: profile.id, status: "PROCESSING" },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    prisma.userPreference.findUnique({
      where: { userId: session.user.id },
    }),
  ]);

  const totalRevenue = Number(revenueAgg._sum.subtotal || 0);
  const refundPercentage = totalCompletedOrders > 0 ? (totalReturnedRequests / totalCompletedOrders) * 100 : 0;

  // Fetch 7-day merchant sales trend in parallel
  const past7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const revenueTrend = await Promise.all(
    past7Days.map(async (date) => {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      const agg = await prisma.order.aggregate({
        where: {
          sellerId: profile.id,
          createdAt: { gte: start, lte: end },
          status: { not: "CANCELLED" },
        },
        _sum: { subtotal: true },
      });
      return {
        label: date.toLocaleDateString("en-IN", { weekday: "short" }),
        value: Number(agg._sum.subtotal || 0),
      };
    })
  );

  // Net units sold per day (last 7 days), excluding cancelled orders
  const netUnitsSoldTrend = await Promise.all(
    past7Days.map(async (date) => {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      const agg = await prisma.orderItem.aggregate({
        where: {
          sellerId: profile.id,
          createdAt: { gte: start, lte: end },
          order: { status: { not: "CANCELLED" } },
        },
        _sum: { quantity: true },
      });
      return {
        label: date.toLocaleDateString("en-IN", { weekday: "short" }),
        units: agg._sum.quantity || 0,
      };
    })
  );

  // Fetch seller's top products sales
  const topProductsRaw = await prisma.product.findMany({
    where: { sellerId: profile.id, status: "ACTIVE" },
    include: { analytics: true },
    orderBy: { analytics: { purchases: "desc" } },
    take: 5,
  });

  const topProducts = topProductsRaw.map((p) => ({
    label: p.name,
    value: p.analytics?.purchases || 0,
  }));

  const defaults = {
    cardOrder: [
      "withdrawable", "pending_bal", "negative_bal", "revenue",
      "orders_today", "orders_pending", "orders_delivered", "returns", "refund_rate"
    ],
    hiddenCards: [],
    collapsedWidgets: [],
    savedViews: [],
  };

  const preferences = userPreference
    ? { ...defaults, ...(userPreference.settings as any) }
    : defaults;

  const statsProps = {
    todayOrdersCount,
    pendingOrdersCount,
    deliveredOrdersCount,
    returnRequestsCount,
    totalRevenue,
    refundPercentage,
  };

  // Safe mapping of wallets for component props
  const walletProps = {
    withdrawableBalance: Number(wallet.withdrawableBalance),
    pendingBalance: Number(wallet.pendingBalance),
    negativeBalance: Number(wallet.negativeBalance),
  };

  // Fetch inactive products
  const inactiveProducts = await prisma.product.findMany({
    where: { sellerId: profile.id, status: "DRAFT" },
    take: 5,
  });

  return (
    <SellerClient
      profile={{ id: profile.id, storeName: profile.storeName, storeSlug: profile.storeSlug }}
      kycStatus={kycStatus}
      rejectionReason={rejectionReason}
      wallet={walletProps}
      stats={statsProps}
      lowStockVariants={serializeDecimals(lowStockVariants)}
      outOfStockVariants={serializeDecimals(outOfStockVariants)}
      inactiveProducts={inactiveProducts}
      highReturnProducts={[]}
      recentOrders={serializeDecimals(recentOrders)}
      ordersToShip={serializeDecimals(ordersToShip)}
      initialPreferences={preferences}
      revenueTrend={revenueTrend}
      topProducts={topProducts}
      netUnitsSoldTrend={netUnitsSoldTrend}
    />
  );
}
