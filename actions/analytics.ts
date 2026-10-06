"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Role, OrderStatus, PaymentStatus, QuoteStatus, Prisma } from "@prisma/client";
import { cookies } from "next/headers";

// ---------------------------------------------------------------------------
// 1. Date range helper
// ---------------------------------------------------------------------------
export async function getDateRange(filter: string, customStart?: string, customEnd?: string) {
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date();

  switch (filter) {
    case "today":
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case "yesterday":
      startDate.setDate(now.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(now.getDate() - 1);
      endDate.setHours(23, 59, 59, 999);
      break;
    case "7days":
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      break;
    case "30days":
      startDate.setDate(now.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      break;
    case "thisMonth":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "thisYear":
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case "custom":
      if (customStart) {
        startDate = new Date(customStart);
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate.setDate(now.getDate() - 30);
      }
      if (customEnd) {
        endDate = new Date(customEnd);
        endDate.setHours(23, 59, 59, 999);
      }
      break;
    default:
      startDate.setDate(now.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
  }

  return { startDate, endDate };
}

// ---------------------------------------------------------------------------
// 2. Light tracking helpers (session throttled)
// ---------------------------------------------------------------------------
export async function trackPageView(pageType: string, productId?: string) {
  try {
    const cookieStore = await cookies();
    const throttleKey = `gh_view_${pageType}${productId ? `_${productId}` : ""}`;
    const throttled = cookieStore.get(throttleKey);

    if (throttled) {
      return { success: true, throttled: true };
    }

    // Throttle for 5 minutes (300 seconds)
    try {
      cookieStore.set(throttleKey, "1", { maxAge: 300, httpOnly: true, path: "/" });
    } catch {
      // In server components/static rendering, setting cookies throws an error.
      // We catch it here to prevent page load crashes.
    }

    await prisma.pageAnalytics.create({
      data: {
        pageType,
        productId,
      },
    });

    if (pageType === "PRODUCT_PAGE" && productId) {
      await prisma.productAnalytics.upsert({
        where: { productId },
        update: { views: { increment: 1 } },
        create: {
          productId,
          views: 1,
          wishlistCount: 0,
          cartAdds: 0,
          purchases: 0,
        },
      });
    }

    return { success: true };
  } catch (err) {
    console.error("trackPageView error:", err);
    return { success: false };
  }
}

export async function trackSearch(keyword: string, noResults: boolean) {
  try {
    if (!keyword || !keyword.trim()) return { success: false };
    const q = keyword.trim().toLowerCase();

    const cookieStore = await cookies();
    const throttleKey = `gh_search_${q}`;
    const throttled = cookieStore.get(throttleKey);

    if (throttled) {
      return { success: true, throttled: true };
    }

    try {
      cookieStore.set(throttleKey, "1", { maxAge: 60, httpOnly: true, path: "/" });
    } catch {
      // Catch rendering cookie mutation exception.
    }

    await prisma.searchAnalytics.create({
      data: {
        keyword: q,
        noResults,
      },
    });

    return { success: true };
  } catch (err) {
    console.error("trackSearch error:", err);
    return { success: false };
  }
}

export async function trackWishlistSync(productId: string) {
  try {
    const activeCount = await prisma.wishlist.count({
      where: { productId },
    });

    await prisma.productAnalytics.upsert({
      where: { productId },
      update: { wishlistCount: activeCount },
      create: {
        productId,
        wishlistCount: activeCount,
        views: 0,
        cartAdds: 0,
        purchases: 0,
      },
    });

    return { success: true };
  } catch (err) {
    console.error("trackWishlistSync error:", err);
    return { success: false };
  }
}

export async function trackCartAdd(productId: string, quantity: number = 1) {
  try {
    await prisma.productAnalytics.upsert({
      where: { productId },
      update: { cartAdds: { increment: quantity } },
      create: {
        productId,
        cartAdds: quantity,
        views: 0,
        wishlistCount: 0,
        purchases: 0,
      },
    });

    return { success: true };
  } catch (err) {
    console.error("trackCartAdd error:", err);
    return { success: false };
  }
}

export async function trackPurchase(productId: string, quantity: number = 1) {
  try {
    await prisma.productAnalytics.upsert({
      where: { productId },
      update: { purchases: { increment: quantity } },
      create: {
        productId,
        purchases: quantity,
        views: 0,
        wishlistCount: 0,
        cartAdds: 0,
      },
    });

    return { success: true };
  } catch (err) {
    console.error("trackPurchase error:", err);
    return { success: false };
  }
}

// ---------------------------------------------------------------------------
// 3. Guards
// ---------------------------------------------------------------------------
async function requireRole(allowed: Role[]) {
  const session = await auth();
  if (!session?.user || !allowed.includes(session.user.role)) {
    throw new Error("Unauthorized: Insufficient permissions.");
  }
  return session.user;
}

// ---------------------------------------------------------------------------
// 4. Admin Analytics Dashboard
// ---------------------------------------------------------------------------
export async function getAdminAnalytics(filter: string, customStart?: string, customEnd?: string) {
  await requireRole([Role.ADMIN]);
  const { startDate, endDate } = await getDateRange(filter, customStart, customEnd);

  const dateFilter = { createdAt: { gte: startDate, lte: endDate } };

  // Parallel Card Queries
  const [
    revenueAgg,
    orderCount,
    customerCount,
    sellerCount,
    b2bCount,
    productCount,
    rfqCount,
    couponCount,
    reviewCount,
  ] = await Promise.all([
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: {
        status: { notIn: [OrderStatus.CANCELLED] },
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
    prisma.order.count({ where: dateFilter }),
    prisma.user.count({ where: { role: Role.CUSTOMER, ...dateFilter } }),
    prisma.sellerProfile.count({ where: { approvalStatus: "APPROVED", ...dateFilter } }),
    prisma.b2BProfile.count({ where: { approvalStatus: "APPROVED", ...dateFilter } }),
    prisma.product.count({ where: { status: "ACTIVE", ...dateFilter } }),
    prisma.rFQ.count({ where: dateFilter }),
    prisma.couponUsage.count({ where: dateFilter }),
    prisma.review.count({ where: { isHidden: false, ...dateFilter } }),
  ]);

  // Aggregate Trends
  const [ordersData, sellersData, customersData, productsData, rfqsData] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      select: { createdAt: true, totalAmount: true, status: true },
    }),
    prisma.sellerProfile.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      select: { createdAt: true },
    }),
    prisma.user.findMany({
      where: { role: Role.CUSTOMER, createdAt: { gte: startDate, lte: endDate } },
      select: { createdAt: true },
    }),
    prisma.product.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      select: { createdAt: true },
    }),
    prisma.rFQ.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      select: { createdAt: true },
    }),
  ]);

  // Format Daily/Monthly chart data
  const isMonthly = filter === "thisYear";
  const trendsMap: Record<string, { date: string; revenue: number; orders: number; sellers: number; customers: number; products: number; rfqs: number }> = {};

  const getGroupKey = (d: Date) => {
    if (isMonthly) {
      return d.toLocaleString("default", { month: "short", year: "2-digit" });
    }
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  // Populate base dates to avoid gaps
  const curr = new Date(startDate);
  while (curr <= endDate) {
    const key = getGroupKey(curr);
    trendsMap[key] = { date: key, revenue: 0, orders: 0, sellers: 0, customers: 0, products: 0, rfqs: 0 };
    if (isMonthly) {
      curr.setMonth(curr.getMonth() + 1);
    } else {
      curr.setDate(curr.getDate() + 1);
    }
  }

  // Populate actual data
  ordersData.forEach((o) => {
    const key = getGroupKey(o.createdAt);
    if (!trendsMap[key]) trendsMap[key] = { date: key, revenue: 0, orders: 0, sellers: 0, customers: 0, products: 0, rfqs: 0 };
    trendsMap[key].orders++;
    if (o.status !== OrderStatus.CANCELLED) {
      trendsMap[key].revenue += Number(o.totalAmount);
    }
  });

  sellersData.forEach((s) => {
    const key = getGroupKey(s.createdAt);
    if (trendsMap[key]) trendsMap[key].sellers++;
  });

  customersData.forEach((c) => {
    const key = getGroupKey(c.createdAt);
    if (trendsMap[key]) trendsMap[key].customers++;
  });

  productsData.forEach((p) => {
    const key = getGroupKey(p.createdAt);
    if (trendsMap[key]) trendsMap[key].products++;
  });

  rfqsData.forEach((r) => {
    const key = getGroupKey(r.createdAt);
    if (trendsMap[key]) trendsMap[key].rfqs++;
  });

  const chartData = Object.values(trendsMap);

  // Top Lists
  // 1. Top Selling Products (using order items quantity)
  const topProductsRaw = await prisma.orderItem.groupBy({
    by: ["variantId", "sellerId"],
    where: { createdAt: { gte: startDate, lte: endDate } },
    _sum: { quantity: true, price: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 5,
  });

  const topProducts = await Promise.all(
    topProductsRaw.map(async (p) => {
      const variant = await prisma.productVariant.findUnique({
        where: { id: p.variantId || "" },
        include: { product: true },
      });
      return {
        name: variant?.product.name || "Unknown Product",
        image: variant?.product.images?.[0] || "",
        qty: p._sum.quantity || 0,
        revenue: (p._sum.quantity || 0) * Number(p._sum.price || 0),
      };
    })
  );

  // 2. Top Sellers
  const topSellersRaw = await prisma.order.groupBy({
    by: ["sellerId"],
    where: { status: { notIn: [OrderStatus.CANCELLED] }, createdAt: { gte: startDate, lte: endDate } },
    _sum: { totalAmount: true },
    orderBy: { _sum: { totalAmount: "desc" } },
    take: 5,
  });

  const topSellers = await Promise.all(
    topSellersRaw.map(async (s) => {
      const seller = await prisma.sellerProfile.findUnique({
        where: { id: s.sellerId },
      });
      return {
        storeName: seller?.storeName || "Unknown Seller",
        revenue: s._sum.totalAmount || 0,
      };
    })
  );

  // 3. Top Categories
  const topCategoriesRaw = await prisma.orderItem.findMany({
    where: { createdAt: { gte: startDate, lte: endDate } },
    include: {
      variant: {
        include: {
          product: {
            include: { category: true },
          },
        },
      },
    },
  });

  const catMap: Record<string, { name: string; revenue: number; qty: number }> = {};
  topCategoriesRaw.forEach((item) => {
    const category = item.variant?.product?.category;
    if (category) {
      if (!catMap[category.id]) {
        catMap[category.id] = { name: category.name, revenue: 0, qty: 0 };
      }
      catMap[category.id].revenue += Number(item.quantity) * Number(item.price);
      catMap[category.id].qty += item.quantity;
    }
  });

  const topCategories = Object.values(catMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // 4. Top Brands
  const brandMap: Record<string, { brand: string; revenue: number; qty: number }> = {};
  topCategoriesRaw.forEach((item) => {
    const brand = item.variant?.product?.brand;
    if (brand) {
      if (!brandMap[brand]) {
        brandMap[brand] = { brand, revenue: 0, qty: 0 };
      }
      brandMap[brand].revenue += Number(item.quantity) * Number(item.price);
      brandMap[brand].qty += item.quantity;
    }
  });

  const topBrands = Object.values(brandMap)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // 5. Top Customers
  const topCustomersRaw = await prisma.order.groupBy({
    by: ["userId"],
    where: { status: { notIn: [OrderStatus.CANCELLED] }, createdAt: { gte: startDate, lte: endDate } },
    _sum: { totalAmount: true },
    orderBy: { _sum: { totalAmount: "desc" } },
    take: 5,
  });

  const topCustomers = await Promise.all(
    topCustomersRaw.map(async (c) => {
      const userRecord = await prisma.user.findUnique({
        where: { id: c.userId },
        select: { name: true, email: true },
      });
      return {
        name: userRecord?.name || "Unknown Customer",
        email: userRecord?.email || "",
        spending: c._sum.totalAmount || 0,
      };
    })
  );

  return {
    cards: {
      revenue: revenueAgg._sum.totalAmount || 0,
      orders: orderCount,
      customers: customerCount,
      sellers: sellerCount,
      b2bBuyers: b2bCount,
      products: productCount,
      rfqs: rfqCount,
      couponsUsed: couponCount,
      reviews: reviewCount,
    },
    charts: chartData,
    topLists: {
      products: topProducts,
      sellers: topSellers,
      categories: topCategories,
      brands: topBrands,
      customers: topCustomers,
    },
  };
}

// ---------------------------------------------------------------------------
// 5. Seller Analytics Dashboard
// ---------------------------------------------------------------------------
export async function getSellerAnalytics(filter: string, customStart?: string, customEnd?: string) {
  const sellerUser = await requireRole([Role.SELLER]);
  const sellerProfile = await prisma.sellerProfile.findUnique({
    where: { userId: sellerUser.id },
  });

  if (!sellerProfile) {
    throw new Error("Seller profile not found.");
  }

  const { startDate, endDate } = await getDateRange(filter, customStart, customEnd);

  // Parallel Cards Queries
  const [
    revenueAgg,
    orderCount,
    pendingCount,
    productsSoldAgg,
    ratingAgg,
    rfqCount,
  ] = await Promise.all([
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: {
        sellerId: sellerProfile.id,
        status: { notIn: [OrderStatus.CANCELLED] },
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
    prisma.order.count({ where: { sellerId: sellerProfile.id, createdAt: { gte: startDate, lte: endDate } } }),
    prisma.order.count({
      where: {
        sellerId: sellerProfile.id,
        status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PROCESSING, OrderStatus.PACKED] },
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
    prisma.orderItem.aggregate({
      _sum: { quantity: true },
      where: {
        sellerId: sellerProfile.id,
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
    prisma.product.aggregate({
      _avg: { averageRating: true },
      where: { sellerId: sellerProfile.id, status: "ACTIVE" },
    }),
    prisma.rFQ.count({
      where: {
        product: { sellerId: sellerProfile.id },
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
  ]);

  // Chart Sales Trends
  const salesData = await prisma.order.findMany({
    where: { sellerId: sellerProfile.id, createdAt: { gte: startDate, lte: endDate } },
    select: { createdAt: true, totalAmount: true, status: true },
  });

  const isMonthly = filter === "thisYear";
  const trendsMap: Record<string, { date: string; sales: number; orders: number }> = {};

  const getGroupKey = (d: Date) => {
    if (isMonthly) {
      return d.toLocaleString("default", { month: "short", year: "2-digit" });
    }
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  const curr = new Date(startDate);
  while (curr <= endDate) {
    const key = getGroupKey(curr);
    trendsMap[key] = { date: key, sales: 0, orders: 0 };
    if (isMonthly) {
      curr.setMonth(curr.getMonth() + 1);
    } else {
      curr.setDate(curr.getDate() + 1);
    }
  }

  salesData.forEach((s) => {
    const key = getGroupKey(s.createdAt);
    if (!trendsMap[key]) trendsMap[key] = { date: key, sales: 0, orders: 0 };
    trendsMap[key].orders++;
    if (s.status !== OrderStatus.CANCELLED) {
      trendsMap[key].sales += Number(s.totalAmount);
    }
  });

  // Order Status Distribution
  const statusCounts = await prisma.order.groupBy({
    by: ["status"],
    where: { sellerId: sellerProfile.id, createdAt: { gte: startDate, lte: endDate } },
    _count: { id: true },
  });

  const statusDistribution = statusCounts.map((s) => ({
    name: s.status,
    value: s._count.id,
  }));

  // Top Selling Products (for this seller)
  const topProductsRaw = await prisma.orderItem.groupBy({
    by: ["variantId"],
    where: { sellerId: sellerProfile.id, createdAt: { gte: startDate, lte: endDate } },
    _sum: { quantity: true, price: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 5,
  });

  const topProducts = await Promise.all(
    topProductsRaw.map(async (p) => {
      const variant = await prisma.productVariant.findUnique({
        where: { id: p.variantId || "" },
        include: { product: true },
      });
      return {
        id: variant?.product.id || "",
        name: variant?.product.name || "Unknown Product",
        qty: p._sum.quantity || 0,
        revenue: (p._sum.quantity || 0) * Number(p._sum.price || 0),
      };
    })
  );

  // Low Stock Products (variants under 10 stock)
  const lowStockProducts = await prisma.productVariant.findMany({
    where: {
      product: { sellerId: sellerProfile.id },
      stock: { lte: 10 },
    },
    include: { product: true },
    orderBy: { stock: "asc" },
    take: 5,
  });

  // Most Viewed Products (from ProductAnalytics)
  const mostViewedProducts = await prisma.productAnalytics.findMany({
    where: { product: { sellerId: sellerProfile.id } },
    include: { product: true },
    orderBy: { views: "desc" },
    take: 5,
  });

  // Top Customers (for this seller)
  const topCustomersRaw = await prisma.order.groupBy({
    by: ["userId"],
    where: { sellerId: sellerProfile.id, status: { notIn: [OrderStatus.CANCELLED] }, createdAt: { gte: startDate, lte: endDate } },
    _sum: { totalAmount: true },
    orderBy: { _sum: { totalAmount: "desc" } },
    take: 5,
  });

  const topCustomers = await Promise.all(
    topCustomersRaw.map(async (c) => {
      const userRecord = await prisma.user.findUnique({
        where: { id: c.userId },
        select: { name: true, email: true },
      });
      return {
        name: userRecord?.name || "Unknown Customer",
        email: userRecord?.email || "",
        spending: c._sum.totalAmount || 0,
      };
    })
  );

  return {
    cards: {
      revenue: revenueAgg._sum.totalAmount || 0,
      orders: orderCount,
      productsSold: productsSoldAgg._sum.quantity || 0,
      pendingOrders: pendingCount,
      averageRating: ratingAgg._avg.averageRating || 0,
      rfqsReceived: rfqCount,
    },
    charts: {
      salesTrends: Object.values(trendsMap),
      statusDistribution,
    },
    tables: {
      topProducts,
      lowStock: lowStockProducts.map((v) => ({
        name: v.product.name,
        sku: v.sku || "N/A",
        size: v.size || "N/A",
        color: v.color || "N/A",
        stock: v.stock,
      })),
      mostViewed: mostViewedProducts.map((pa) => ({
        name: pa.product.name,
        views: pa.views,
        wishlist: pa.wishlistCount,
        cartAdds: pa.cartAdds,
        purchases: pa.purchases,
        conversion: pa.views > 0 ? ((pa.purchases / pa.views) * 100).toFixed(1) + "%" : "0.0%",
      })),
      topCustomers,
    },
  };
}

// ---------------------------------------------------------------------------
// 6. B2B Buyer Analytics
// ---------------------------------------------------------------------------
export async function getB2BAnalytics() {
  const buyerUser = await requireRole([Role.B2B_VENDOR, Role.ADMIN]);
  const b2bProfile = await prisma.b2BProfile.findUnique({
    where: { userId: buyerUser.id },
  });

  if (!b2bProfile) {
    throw new Error("B2B Vendor Profile not found.");
  }

  // Cards
  const [rfqCount, quotesCount, approvedQuotesCount, ordersCount, spendingAgg] = await Promise.all([
    prisma.rFQ.count({ where: { buyerId: b2bProfile.id } }),
    prisma.quote.count({ where: { rfq: { buyerId: b2bProfile.id } } }),
    prisma.quote.count({ where: { rfq: { buyerId: b2bProfile.id }, status: QuoteStatus.ACCEPTED } }),
    prisma.order.count({ where: { userId: buyerUser.id } }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { userId: buyerUser.id, status: { notIn: [OrderStatus.CANCELLED] } },
    }),
  ]);

  // Trends - RFQ by Month, Spending by Month
  const rfqs = await prisma.rFQ.findMany({
    where: { buyerId: b2bProfile.id },
    select: { createdAt: true },
  });

  const orders = await prisma.order.findMany({
    where: { userId: buyerUser.id, status: { notIn: [OrderStatus.CANCELLED] } },
    select: { createdAt: true, totalAmount: true },
  });

  const trendsMap: Record<string, { month: string; rfqs: number; spending: number }> = {};
  const getMonthKey = (d: Date) => d.toLocaleString("default", { month: "short", year: "2-digit" });

  rfqs.forEach((r) => {
    const key = getMonthKey(r.createdAt);
    if (!trendsMap[key]) trendsMap[key] = { month: key, rfqs: 0, spending: 0 };
    trendsMap[key].rfqs++;
  });

  orders.forEach((o) => {
    const key = getMonthKey(o.createdAt);
    if (!trendsMap[key]) trendsMap[key] = { month: key, rfqs: 0, spending: 0 };
    trendsMap[key].spending += Number(o.totalAmount);
  });

  return {
    cards: {
      rfqsSubmitted: rfqCount,
      quotesReceived: quotesCount,
      approvedQuotes: approvedQuotesCount,
      ordersCreated: ordersCount,
      totalSpending: spendingAgg._sum.totalAmount || 0,
    },
    charts: Object.values(trendsMap),
  };
}

// ---------------------------------------------------------------------------
// 7. Customer Analytics
// ---------------------------------------------------------------------------
export async function getCustomerAnalytics() {
  const customerUser = await requireRole([Role.CUSTOMER, Role.ADMIN]);

  // Cards
  const [orderCount, spendingAgg, wishlistCount, reviewsCount] = await Promise.all([
    prisma.order.count({ where: { userId: customerUser.id } }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { userId: customerUser.id, status: { notIn: [OrderStatus.CANCELLED] } },
    }),
    prisma.wishlist.count({ where: { userId: customerUser.id } }),
    prisma.review.count({ where: { userId: customerUser.id } }),
  ]);

  // Spending & Orders by month
  const orders = await prisma.order.findMany({
    where: { userId: customerUser.id, status: { notIn: [OrderStatus.CANCELLED] } },
    select: { createdAt: true, totalAmount: true },
  });

  const trendsMap: Record<string, { month: string; orders: number; spending: number }> = {};
  const getMonthKey = (d: Date) => d.toLocaleString("default", { month: "short", year: "2-digit" });

  orders.forEach((o) => {
    const key = getMonthKey(o.createdAt);
    if (!trendsMap[key]) trendsMap[key] = { month: key, orders: 0, spending: 0 };
    trendsMap[key].orders++;
    trendsMap[key].spending += Number(o.totalAmount);
  });

  return {
    cards: {
      totalOrders: orderCount,
      totalSpending: spendingAgg._sum.totalAmount || 0,
      wishlistItems: wishlistCount,
      reviewsSubmitted: reviewsCount,
    },
    charts: Object.values(trendsMap),
  };
}

// ---------------------------------------------------------------------------
// 8. Alerts Calculator
// ---------------------------------------------------------------------------
export async function getAdminAlerts() {
  await requireRole([Role.ADMIN]);

  const alerts: Array<{ type: "warning" | "danger" | "info"; title: string; message: string }> = [];

  // 1. Low stock products (any variant under 5 items)
  const lowStockCount = await prisma.productVariant.count({
    where: { stock: { gt: 0, lte: 5 } },
  });
  if (lowStockCount > 0) {
    alerts.push({
      type: "warning",
      title: "Low Stock Warning",
      message: `${lowStockCount} product variant(s) are running extremely low on stock (<= 5 units).`,
    });
  }

  // 2. Sudden sales spikes (last 24 hours compared to previous 7 days daily average)
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const eightDaysAgo = new Date();
  eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);

  const [last24hSales, last7dSales] = await Promise.all([
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { createdAt: { gte: oneDayAgo }, status: { notIn: [OrderStatus.CANCELLED] } },
    }),
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: { createdAt: { gte: eightDaysAgo, lte: oneDayAgo }, status: { notIn: [OrderStatus.CANCELLED] } },
    }),
  ]);

  const salesLast24h = Number(last24hSales._sum.totalAmount || 0);
  const avgDailySales7d = Number(last7dSales._sum.totalAmount || 0) / 7;

  if (avgDailySales7d > 0 && salesLast24h > avgDailySales7d * 2.5) {
    alerts.push({
      type: "info",
      title: "Sudden Sales Spike",
      message: `Sales in the last 24h (₹${salesLast24h.toLocaleString()}) are over 2.5x the rolling 7-day daily average (₹${avgDailySales7d.toLocaleString()}).`,
    });
  }

  // 3. Suspicious activities (KYC flag or multiple failed payments)
  const suspiciousKYCCount = await prisma.sellerKYC.count({
    where: { isSuspicious: true },
  });

  const failedPaymentsCount = await prisma.paymentTransaction.count({
    where: { status: PaymentStatus.FAILED, createdAt: { gte: oneDayAgo } },
  });

  if (suspiciousKYCCount > 0) {
    alerts.push({
      type: "danger",
      title: "Suspicious KYC Flag",
      message: `${suspiciousKYCCount} seller KYC submission(s) have been flagged as suspicious and need review.`,
    });
  }

  if (failedPaymentsCount > 10) {
    alerts.push({
      type: "warning",
      title: "High Payment Failures",
      message: `There have been ${failedPaymentsCount} failed payment transactions in the last 24 hours.`,
    });
  }

  // 4. High Refund/Return Rate (> 15% in last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [refundCount, totalOrdersCount] = await Promise.all([
    prisma.order.count({
      where: { status: { in: [OrderStatus.REFUNDED, OrderStatus.RETURNED] }, createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.order.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
  ]);

  if (totalOrdersCount > 10) {
    const refundRate = (refundCount / totalOrdersCount) * 100;
    if (refundRate > 15) {
      alerts.push({
        type: "danger",
        title: "High Refund / Return Rate",
        message: `Marketplace return/refund rate is currently at ${refundRate.toFixed(1)}% over the last 30 days (Limit: 15%).`,
      });
    }
  }

  return alerts;
}

export async function getSellerAlerts() {
  const sellerUser = await requireRole([Role.SELLER]);
  const sellerProfile = await prisma.sellerProfile.findUnique({
    where: { userId: sellerUser.id },
  });

  if (!sellerProfile) return [];

  const alerts: Array<{ type: "warning" | "danger" | "info"; title: string; message: string }> = [];

  // 1. Low stock (variants stock <= 5)
  const lowStockCount = await prisma.productVariant.count({
    where: {
      product: { sellerId: sellerProfile.id },
      stock: { gt: 0, lte: 5 },
    },
  });
  if (lowStockCount > 0) {
    alerts.push({
      type: "warning",
      title: "Low Stock Alert",
      message: `You have ${lowStockCount} item(s) running extremely low on stock (5 or less).`,
    });
  }

  // 2. Out of stock (variants stock = 0)
  const outOfStockCount = await prisma.productVariant.count({
    where: {
      product: { sellerId: sellerProfile.id },
      stock: 0,
    },
  });
  if (outOfStockCount > 0) {
    alerts.push({
      type: "danger",
      title: "Out of Stock Alert",
      message: `You have ${outOfStockCount} variant(s) completely out of stock. Customers cannot purchase these.`,
    });
  }

  // 3. New top selling product (sold > 15 units in last 14 days)
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const topSellers = await prisma.orderItem.groupBy({
    by: ["variantId"],
    where: { sellerId: sellerProfile.id, createdAt: { gte: fourteenDaysAgo } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 1,
  });

  if (topSellers.length > 0 && (topSellers[0]._sum.quantity || 0) > 15) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: topSellers[0].variantId || "" },
      include: { product: true },
    });
    alerts.push({
      type: "info",
      title: "Top Seller Spiking",
      message: `Your product "${variant?.product.name}" is performing exceptionally well with ${topSellers[0]._sum.quantity} units sold in the last 14 days!`,
    });
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// 9. Report Data Compiler
// ---------------------------------------------------------------------------
export async function getReportData(reportType: string, filter: string, customStart?: string, customEnd?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized.");

  const { startDate, endDate } = await getDateRange(filter, customStart, customEnd);

  // Setup security access bounds
  const isAdmin = session.user.role === Role.ADMIN;
  const isSeller = session.user.role === Role.SELLER;
  const isCustomer = session.user.role === Role.CUSTOMER;
  const isB2B = session.user.role === Role.B2B_VENDOR;

  let sellerProfileId: string | null = null;
  if (isSeller) {
    const seller = await prisma.sellerProfile.findUnique({ where: { userId: session.user.id } });
    if (!seller) throw new Error("Seller profile not found.");
    sellerProfileId = seller.id;
  }

  switch (reportType) {
    case "sales": {
      // Admin gets all orders; Seller gets only their own; Customer/B2B gets only their own
      const orders = await prisma.order.findMany({
        where: {
          ...(isSeller ? { sellerId: sellerProfileId! } : {}),
          ...(isCustomer || isB2B ? { userId: session.user.id } : {}),
          createdAt: { gte: startDate, lte: endDate },
        },
        include: { user: true, seller: true },
        orderBy: { createdAt: "desc" },
      });

      return orders.map((o) => ({
        "Order Number": o.orderNumber,
        "Customer Name": o.user.name,
        "Customer Email": o.user.email,
        "Store Name": o.seller.storeName,
        "Subtotal (₹)": o.subtotal,
        "Discount (₹)": o.discountAmount,
        "Platform Fee (₹)": o.platformFee,
        "Shipping (₹)": o.shippingFee,
        "Total (₹)": o.totalAmount,
        "Payment Method": o.paymentMethod || "COD",
        "Payment Status": o.paymentStatus,
        "Order Status": o.status,
        "Order Date": o.createdAt.toLocaleDateString("en-IN"),
      }));
    }

    case "seller": {
      if (!isAdmin) throw new Error("Access denied: Admin only report.");
      const sellers = await prisma.sellerProfile.findMany({
        include: { user: true, _count: { select: { products: true } } },
        orderBy: { createdAt: "desc" },
      });

      return await Promise.all(
        sellers.map(async (s) => {
          // Calculate aggregates
          const orderSum = await prisma.order.aggregate({
            _sum: { totalAmount: true },
            where: { sellerId: s.id, status: { notIn: [OrderStatus.CANCELLED] } },
          });
          const orderCount = await prisma.order.count({
            where: { sellerId: s.id },
          });

          return {
            "Store Name": s.storeName,
            "Owner Name": s.user.name,
            "Email": s.user.email,
            "GSTIN": s.GSTIN || "N/A",
            "PAN": s.PAN || "N/A",
            "Commission Rate": `${(s.commissionRate * 100).toFixed(0)}%`,
            "Approval Status": s.approvalStatus,
            "Total Products Listed": s._count.products,
            "Total Orders": orderCount,
            "Total Revenue (₹)": orderSum._sum.totalAmount || 0,
            "Joined Date": s.createdAt.toLocaleDateString("en-IN"),
          };
        })
      );
    }

    case "product": {
      const products = await prisma.product.findMany({
        where: {
          ...(isSeller ? { sellerId: sellerProfileId! } : {}),
          createdAt: { gte: startDate, lte: endDate },
        },
        include: { category: true, seller: true, analytics: true },
        orderBy: { createdAt: "desc" },
      });

      return products.map((p) => ({
        "Product Name": p.name,
        "Brand": p.brand,
        "Category": p.category.name,
        "Store Name": p.seller.storeName,
        "Status": p.status,
        "Views": p.analytics?.views || 0,
        "Wishlist Count": p.analytics?.wishlistCount || 0,
        "Cart Additions": p.analytics?.cartAdds || 0,
        "Purchases": p.analytics?.purchases || 0,
        "Conversion Rate": p.analytics?.views && p.analytics.views > 0
          ? ((p.analytics.purchases / p.analytics.views) * 100).toFixed(1) + "%"
          : "0.0%",
        "Created Date": p.createdAt.toLocaleDateString("en-IN"),
      }));
    }

    case "inventory": {
      if (!isSeller) throw new Error("Access denied: Seller only report.");
      const variants = await prisma.productVariant.findMany({
        where: {
          product: { sellerId: sellerProfileId! },
        },
        include: { product: true },
        orderBy: [{ stock: "asc" }, { sku: "asc" }],
      });

      return variants.map((v) => ({
        "Product Name": v.product.name,
        "SKU": v.sku || "N/A",
        "Size": v.size || "N/A",
        "Color": v.color || "N/A",
        "Stock level": v.stock,
        "Selling Price (₹)": v.sellingPrice,
        "MRP (₹)": v.mrp,
        "Status": v.stock === 0 ? "Out of Stock" : v.stock <= 5 ? "Low Stock" : "In Stock",
      }));
    }

    case "customer": {
      if (!isAdmin) throw new Error("Access denied: Admin only report.");
      const users = await prisma.user.findMany({
        where: { role: Role.CUSTOMER, createdAt: { gte: startDate, lte: endDate } },
        orderBy: { createdAt: "desc" },
      });

      return await Promise.all(
        users.map(async (u) => {
          const spendingAgg = await prisma.order.aggregate({
            _sum: { totalAmount: true },
            where: { userId: u.id, status: { notIn: [OrderStatus.CANCELLED] } },
          });
          const ordersCount = await prisma.order.count({ where: { userId: u.id } });
          const wishlistCount = await prisma.wishlist.count({ where: { userId: u.id } });
          const reviewsCount = await prisma.review.count({ where: { userId: u.id } });

          return {
            "Customer Name": u.name,
            "Email": u.email,
            "Phone": u.phone || "N/A",
            "Joined Date": u.createdAt.toLocaleDateString("en-IN"),
            "Total Orders": ordersCount,
            "Total Spending (₹)": spendingAgg._sum.totalAmount || 0,
            "Wishlist Items": wishlistCount,
            "Reviews Submitted": reviewsCount,
          };
        })
      );
    }

    case "coupon": {
      if (!isAdmin) throw new Error("Access denied: Admin only report.");
      const coupons = await prisma.coupon.findMany({
        include: { _count: { select: { usages: true } } },
        orderBy: { createdAt: "desc" },
      });

      return coupons.map((c) => ({
        "Coupon Code": c.code,
        "Discount Type": c.discountType,
        "Discount Value": c.discountValue,
        "Min Order Amount (₹)": c.minimumOrderAmount,
        "Max Discount Allowed (₹)": c.maximumDiscount || "Unlimited",
        "Global Usage Limit": c.usageLimit || "Unlimited",
        "Total Usages Recorded": c.usageCount,
        "Start Date": c.startDate.toLocaleDateString("en-IN"),
        "End Date": c.endDate.toLocaleDateString("en-IN"),
        "Status": c.status,
      }));
    }

    case "rfq": {
      if (!isAdmin && !isB2B) throw new Error("Access denied: Admin or B2B Buyer only.");
      const rfqs = await prisma.rFQ.findMany({
        where: {
          ...(isB2B ? { buyer: { userId: session.user.id } } : {}),
          createdAt: { gte: startDate, lte: endDate },
        },
        include: {
          buyer: { include: { user: true } },
          product: { include: { seller: true } },
          quotes: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return rfqs.map((r) => {
        const bestQuote = r.quotes.reduce((best, q) => (Number(q.price) < best ? Number(q.price) : best), Infinity);
        return {
          "RFQ ID": r.id,
          "Buyer Company": r.buyer.companyName,
          "Buyer Contact": r.buyer.user.name,
          "Product Name": r.product.name,
          "Supplier Store": r.product.seller.storeName,
          "Quantity Requested": r.quantity,
          "Target Price (₹)": r.targetPrice,
          "Best Quote Received (₹)": bestQuote === Infinity ? "None" : bestQuote,
          "Status": r.status,
          "Date Created": r.createdAt.toLocaleDateString("en-IN"),
        };
      });
    }

    case "seller_ledger": {
      if (!isSeller && !isAdmin) throw new Error("Access denied: Seller or Admin only report.");
      const ledger = await prisma.ledgerEntry.findMany({
        where: {
          ...(isSeller
            ? {
                OR: [
                  { accountName: `SELLER_PENDING:${sellerProfileId}` },
                  { accountName: `SELLER_WITHDRAWABLE:${sellerProfileId}` },
                  { accountName: `SELLER_RESERVE:${sellerProfileId}` },
                ],
              }
            : {}),
          createdAt: { gte: startDate, lte: endDate },
        },
        orderBy: { createdAt: "desc" },
      });

      return ledger.map((l) => ({
        "Date": l.createdAt.toLocaleDateString("en-IN"),
        "Transaction ID": l.transactionId,
        "Account Name": l.accountName,
        "Debit (₹)": l.debit.toNumber(),
        "Credit (₹)": l.credit.toNumber(),
        "Reference": l.reference,
        "Description": l.description || "",
      }));
    }

    case "payout_report": {
      if (!isSeller && !isAdmin) throw new Error("Access denied: Seller or Admin only report.");
      const payouts = await prisma.payoutRequest.findMany({
        where: {
          ...(isSeller ? { sellerId: sellerProfileId! } : {}),
          createdAt: { gte: startDate, lte: endDate },
        },
        include: { seller: { select: { storeName: true } } },
        orderBy: { createdAt: "desc" },
      });

      return payouts.map((p) => ({
        "Request ID": p.id,
        "Store Name": p.seller.storeName,
        "Amount (₹)": p.amount.toNumber(),
        "Status": p.status,
        "UTR (Bank Ref)": p.bankReference || "N/A",
        "Rejection Reason": p.rejectionReason || "N/A",
        "Created Date": p.createdAt.toLocaleDateString("en-IN"),
        "Updated Date": p.updatedAt.toLocaleDateString("en-IN"),
      }));
    }

    case "refund_report": {
      if (!isSeller && !isAdmin) throw new Error("Access denied: Seller or Admin only report.");
      const returns = await prisma.returnRequest.findMany({
        where: {
          ...(isSeller ? { sellerId: sellerProfileId! } : {}),
          createdAt: { gte: startDate, lte: endDate },
        },
        include: {
          order: { select: { orderNumber: true } },
          customer: { select: { name: true } },
          seller: { select: { storeName: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return returns.map((r) => ({
        "Return ID": r.id,
        "Order Number": r.order.orderNumber,
        "Customer Name": r.customer.name,
        "Store Name": r.seller.storeName,
        "Base Item Value (₹)": r.refundAmount.toNumber(),
        "Original Shipping (₹)": r.originalShippingFee.toNumber(),
        "Return Shipping Fee (₹)": r.returnShippingFee.toNumber(),
        "Reason Category": r.reasonCategory || "N/A",
        "Responsibility": r.shippingResponsibility || "N/A",
        "Customer Refunded (₹)": r.customerRefundAmount.toNumber(),
        "Seller Deducted (₹)": r.sellerDeductionAmount.toNumber(),
        "Customer Deduction (₹)": r.deductionAmount.toNumber(),
        "Reason Description": r.reason + (r.description ? ` - ${r.description}` : ""),
        "Status": r.status,
        "Created Date": r.createdAt.toLocaleDateString("en-IN"),
      }));
    }

    case "commission_report": {
      if (!isSeller && !isAdmin) throw new Error("Access denied: Seller or Admin only report.");
      const commissions = await prisma.commission.findMany({
        where: {
          ...(isSeller ? { sellerId: sellerProfileId! } : {}),
          createdAt: { gte: startDate, lte: endDate },
        },
        include: {
          order: {
            include: {
              seller: { select: { storeName: true } }
            }
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return commissions.map((c) => ({
        "Order Number": c.order.orderNumber,
        "Store Name": c.order.seller.storeName,
        "Order Subtotal (₹)": c.order.subtotal.toNumber(),
        "Commission Rate (%)": `${(c.rate * 100).toFixed(0)}%`,
        "Commission Amount (₹)": c.amount.toNumber(),
        "Date": c.createdAt.toLocaleDateString("en-IN"),
      }));
    }

    case "admin_settlement": {
      if (!isAdmin) throw new Error("Access denied: Admin only report.");
      const wallets = await prisma.sellerWallet.findMany({
        include: { seller: { select: { storeName: true } } },
        orderBy: { seller: { storeName: "asc" } },
      });

      return wallets.map((w) => ({
        "Store Name": w.seller.storeName,
        "Total Earned (₹)": w.totalEarned.toNumber(),
        "Total Paid (₹)": w.totalPaid.toNumber(),
        "Total Refunded (₹)": w.totalRefunded.toNumber(),
        "Pending Balance (₹)": w.pendingBalance.toNumber(),
        "Withdrawable Balance (₹)": w.withdrawableBalance.toNumber(),
        "Negative Balance (₹)": w.negativeBalance.toNumber(),
        "Reserve Balance (₹)": w.reserveBalance.toNumber(),
      }));
    }

    case "transaction_history": {
      if (!isSeller) throw new Error("Access denied: Seller only report.");
      const wallet = await prisma.sellerWallet.findUnique({ where: { sellerId: sellerProfileId! } });
      if (!wallet) return [];

      const txs = await prisma.walletTransaction.findMany({
        where: {
          sellerWalletId: wallet.id,
          createdAt: { gte: startDate, lte: endDate },
        },
        orderBy: { createdAt: "desc" },
      });

      return txs.map((t) => ({
        "Transaction ID": t.id,
        "Amount (₹)": t.amount.toNumber(),
        "Type": t.type,
        "Status": t.status,
        "Reference": t.reference || "N/A",
        "Description": t.description || "",
        "Date": t.createdAt.toLocaleDateString("en-IN"),
      }));
    }

    default:
      throw new Error("Invalid report type.");
  }
}
