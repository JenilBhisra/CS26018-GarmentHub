import React from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminClient from "./admin-client";

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  // Define date thresholds
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Parallel database metrics aggregation
  const [
    todayOrdersCount,
    pendingOrdersCount,
    awaitingShipmentCount,
    activeSellersCount,
    pendingKycCount,
    pendingPayoutsCount,
    openDisputesCount,
    pendingRefundsCount,
    negativeWalletsCount,
    revenueAgg,
    commissionAgg,
    recentAuditLogs,
    topSellingProducts,
    pendingKycList,
    pendingPayoutList,
    userPreference,
    sellerFaultCount,
    customerFaultCount,
    platformFaultCount,
    categories,
  ] = await Promise.all([
    // Counts
    prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.order.count({ where: { status: "PROCESSING" } }),
    prisma.sellerProfile.count({ where: { approvalStatus: "APPROVED" } }),
    prisma.sellerKYC.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.payoutRequest.count({ where: { status: "PENDING" } }),
    prisma.dispute.count({ where: { status: "OPEN" } }),
    prisma.returnRequest.count({ where: { status: "REQUESTED" } }),
    prisma.sellerWallet.count({ where: { negativeBalance: { gt: 0 } } }),
    
    // Aggregations
    prisma.order.aggregate({
      where: { status: { not: "CANCELLED" } },
      _sum: { totalAmount: true },
    }),
    prisma.order.aggregate({
      where: { status: { not: "CANCELLED" } },
      _sum: { commissionAmount: true },
    }),

    // Lists for attention queues and feeds
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.product.findMany({
      where: { status: "ACTIVE" },
      include: { analytics: true },
      orderBy: { analytics: { purchases: "desc" } },
      take: 5,
    }),
    prisma.sellerKYC.findMany({
      where: { status: "PENDING_REVIEW" },
      include: { seller: true },
      take: 10,
    }),
    prisma.payoutRequest.findMany({
      where: { status: "PENDING" },
      include: { seller: true },
      take: 10,
    }),
    prisma.userPreference.findUnique({
      where: { userId: session.user.id },
    }),

    // Refund fault metrics for charts
    prisma.returnRequest.count({ where: { reasonCategory: "SELLER_FAULT" } }),
    prisma.returnRequest.count({ where: { reasonCategory: "CUSTOMER_FAULT" } }),
    prisma.returnRequest.count({ where: { reasonCategory: "PLATFORM_FAULT" } }),

    // Top categories list
    prisma.category.findMany({ take: 3 }),
  ]);

  const totalRevenue = Number(revenueAgg._sum.totalAmount || 0);
  const platformCommission = Number(commissionAgg._sum.commissionAmount || 0);

  // Calculate refund rate (completed refunds over total orders)
  const totalCompletedOrders = await prisma.order.count({
    where: { status: { in: ["DELIVERED", "RETURNED", "REFUNDED"] } },
  });
  const totalRefundedRequests = await prisma.returnRequest.count({
    where: { status: "REFUNDED" },
  });
  const refundRate = totalCompletedOrders > 0 ? (totalRefundedRequests / totalCompletedOrders) * 100 : 0;

  // Format pending queues for dropdown selections
  const formattedKycList = pendingKycList.map((k) => ({
    id: k.id,
    storeName: k.seller.storeName,
    panNumber: k.panNumber,
  }));

  const formattedPayoutList = pendingPayoutList.map((p) => ({
    id: p.id,
    storeName: p.seller.storeName,
    amount: Number(p.amount),
    reference: p.reference,
  }));

  // Fetch 7-day revenue trend dynamically in parallel
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
          createdAt: { gte: start, lte: end },
          status: { not: "CANCELLED" },
        },
        _sum: { totalAmount: true },
      });
      return {
        label: date.toLocaleDateString("en-IN", { weekday: "short" }),
        value: Number(agg._sum.totalAmount || 0),
      };
    })
  );

  // Fetch category sales in parallel
  const categorySales = await Promise.all(
    categories.map(async (cat) => {
      const agg = await prisma.orderItem.aggregate({
        where: { variant: { product: { categoryId: cat.id } } },
        _sum: { price: true },
      });
      return {
        label: cat.name,
        value: Number(agg._sum.price || 0),
      };
    })
  );

  const defaults = {
    cardOrder: [
      "orders_today", "orders_pending", "orders_awaiting", "active_sellers",
      "kyc_pending", "payouts_pending", "disputes_open", "refunds_pending",
      "negative_wallets", "total_revenue", "commission", "refund_rate"
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
    awaitingShipmentCount,
    activeSellersCount,
    pendingKycCount,
    pendingPayoutsCount,
    openDisputesCount,
    pendingRefundsCount,
    negativeWalletsCount,
    totalRevenue,
    platformCommission,
    refundRate,
  };

  const refundReasons = [
    { label: "Seller Fault", value: sellerFaultCount },
    { label: "Customer Fault", value: customerFaultCount },
    { label: "Platform Fault", value: platformFaultCount },
  ];

  return (
    <AdminClient
      stats={statsProps}
      recentAuditLogs={recentAuditLogs}
      topSellingProducts={topSellingProducts}
      pendingKycList={formattedKycList}
      pendingPayoutList={formattedPayoutList}
      initialPreferences={preferences}
      revenueTrend={revenueTrend}
      refundReasons={refundReasons}
      categorySales={categorySales}
    />
  );
}
