"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ReturnStatus, Prisma, ShippingResponsibility, ReturnReasonCategory } from "@prisma/client";

const Decimal = Prisma.Decimal;

/**
 * Automatically seeds older ReturnRequest records with permanent reporting fields.
 */
export async function seedOldReturnRequests() {
  try {
    const unseeded = await prisma.returnRequest.findMany({
      where: { orderNumber: null },
      include: {
        order: {
          include: {
            items: true,
            user: true,
          }
        },
        seller: true,
        returnReasonRule: true,
      }
    });

    if (unseeded.length === 0) return;

    for (const ret of unseeded) {
      const order = ret.order;
      const productAmount = order.subtotal.minus(order.discountAmount);
      
      let category = ret.reasonCategory || "CUSTOMER_FAULT";
      let origShipResp: ShippingResponsibility = "CUSTOMER";
      let retShipResp: ShippingResponsibility = "CUSTOMER";

      if (ret.returnReasonRule) {
        origShipResp = ret.returnReasonRule.originalShippingResponsibility;
        retShipResp = ret.returnReasonRule.returnShippingResponsibility;
      } else {
        if (category === "SELLER_FAULT") {
          origShipResp = "SELLER";
          retShipResp = "SELLER";
        } else if (category === "CUSTOMER_FAULT") {
          origShipResp = "CUSTOMER";
          retShipResp = "CUSTOMER";
        } else {
          origShipResp = "PLATFORM";
          retShipResp = "PLATFORM";
        }
      }

      const orderNum = order.orderNumber;
      const storeName = ret.seller.storeName;
      const cName = order.user?.name || "Customer";
      const cEmail = order.user?.email || "customer@garmenthub.local";
      const pName = order.items.map(item => (item.productSnapshot as any)?.name || "").filter(Boolean).join(", ");
      const pSku = order.items.map(item => (item.variantSnapshot as any)?.sku || "").filter(Boolean).join(", ");
      const qty = order.items.reduce((sum, item) => sum + item.quantity, 0);

      await prisma.returnRequest.update({
        where: { id: ret.id },
        data: {
          orderNumber: orderNum,
          sellerStoreName: storeName,
          customerName: cName,
          customerEmail: cEmail,
          productName: pName,
          productSku: pSku,
          quantity: qty,
          productAmount: productAmount,
          originalShippingResponsibility: origShipResp,
          returnShippingResponsibility: retShipResp,
          whoPaidProductRefund: category === "PLATFORM_FAULT" ? "Platform" : "Seller",
          whoPaidOriginalShipping: origShipResp === "SELLER" ? "Seller" : (origShipResp === "PLATFORM" ? "Platform" : "Customer"),
          whoPaidReturnShipping: retShipResp === "SELLER" ? "Seller" : (retShipResp === "PLATFORM" ? "Platform" : "Customer"),
          walletTransactionRef: ret.status === "REFUNDED" ? `refund_ret_${ret.id}` : null,
          ledgerTransactionRef: ret.status === "REFUNDED" ? `refund_ret_${ret.id}` : null,
          approvedAt: ret.status === "REFUNDED" || ret.status === "APPROVED" ? ret.updatedAt : null,
          refundedAt: ret.status === "REFUNDED" ? ret.updatedAt : null,
        }
      });
    }
  } catch (err) {
    console.error("seedOldReturnRequests error:", err);
  }
}

interface ReportFilters {
  page?: number;
  limit?: number;
  search?: string;
  sellerId?: string;
  status?: string;
  reason?: string;
  responsibility?: string;
  reasonCategory?: string;
  whoPaid?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * Builds the Prisma where query filter based on input search parameters.
 */
function buildWhereFilter(filters: ReportFilters): Prisma.ReturnRequestWhereInput {
  const { search, sellerId, status, reason, responsibility, reasonCategory, whoPaid, startDate, endDate } = filters;
  const where: Prisma.ReturnRequestWhereInput = {};

  if (sellerId) {
    where.sellerId = sellerId;
  }

  if (status && status !== "ALL") {
    where.status = status as ReturnStatus;
  }

  if (reason && reason !== "ALL") {
    where.reason = { contains: reason, mode: "insensitive" };
  }

  if (responsibility && responsibility !== "ALL") {
    where.shippingResponsibility = responsibility as ShippingResponsibility;
  }

  if (reasonCategory && reasonCategory !== "ALL") {
    where.reasonCategory = reasonCategory as ReturnReasonCategory;
  }

  if (whoPaid && whoPaid !== "ALL") {
    const [field, value] = whoPaid.split("_");
    if (field && value) {
      (where as any)[field] = value;
    }
  }

  // Search by orderNumber, customer name/email, product name/sku
  if (search && search.trim() !== "") {
    const s = search.trim();
    where.OR = [
      { orderNumber: { contains: s, mode: "insensitive" } },
      { customerName: { contains: s, mode: "insensitive" } },
      { customerEmail: { contains: s, mode: "insensitive" } },
      { productName: { contains: s, mode: "insensitive" } },
      { productSku: { contains: s, mode: "insensitive" } },
      { order: { orderNumber: { contains: s, mode: "insensitive" } } },
      { customer: { name: { contains: s, mode: "insensitive" } } },
      { customer: { email: { contains: s, mode: "insensitive" } } },
    ];
  }

  // Date range filter
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  return where;
}

/**
 * Fetches return/refund reports with server-side pagination and filters.
 */
export async function getReturnRequestsReport(filters: ReportFilters) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized access. Please login.");
  }

  // Enforce seller restrictions
  let sellerId = filters.sellerId;
  const isSeller = session.user.role === "SELLER";
  if (isSeller) {
    const sellerProfile = await prisma.sellerProfile.findUnique({
      where: { userId: session.user.id }
    });
    if (!sellerProfile) {
      throw new Error("Seller profile not found.");
    }
    sellerId = sellerProfile.id;
  } else if (session.user.role !== "ADMIN") {
    throw new Error("Unauthorized access. Admin or Seller only.");
  }

  // Seed old records on request to ensure accurate historical reporting
  await seedOldReturnRequests();

  const finalFilters = { ...filters, sellerId };
  const where = buildWhereFilter(finalFilters);

  const page = finalFilters.page || 1;
  const limit = finalFilters.limit || 10;
  const skip = (page - 1) * limit;

  // Perform count and paginated query
  const [totalCount, items] = await Promise.all([
    prisma.returnRequest.count({ where }),
    prisma.returnRequest.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderId: true,
        customerId: true,
        sellerId: true,
        reason: true,
        description: true,
        status: true,
        adminNotes: true,
        refundAmount: true,
        originalShippingFee: true,
        returnShippingFee: true,
        shippingResponsibility: true,
        reasonCategory: true,
        deductionAmount: true,
        sellerDeductionAmount: true,
        customerRefundAmount: true,
        platformCost: true,
        reverseCommission: true,
        createdAt: true,
        updatedAt: true,
        // Reporting fields
        orderNumber: true,
        sellerStoreName: true,
        customerName: true,
        customerEmail: true,
        productName: true,
        productSku: true,
        quantity: true,
        productAmount: true,
        originalShippingResponsibility: true,
        returnShippingResponsibility: true,
        whoPaidProductRefund: true,
        whoPaidOriginalShipping: true,
        whoPaidReturnShipping: true,
        walletTransactionRef: true,
        ledgerTransactionRef: true,
        approvedAt: true,
        refundedAt: true,
      }
    })
  ]);

  // Compute aggregated stats for dashboard summary cards
  const allMatching = await prisma.returnRequest.findMany({
    where,
    select: {
      status: true,
      reasonCategory: true,
      customerRefundAmount: true,
      sellerDeductionAmount: true,
      deductionAmount: true,
      platformCost: true,
      returnShippingFee: true,
      whoPaidReturnShipping: true,
    }
  });

  const totals = {
    totalCount: allMatching.length,
    customerRefundTotal: new Decimal(0),
    sellerDeductionsTotal: new Decimal(0),
    customerDeductionsTotal: new Decimal(0),
    platformCostTotal: new Decimal(0),
    sellerReturnShippingTotal: new Decimal(0),
    sellerFaultCount: 0,
    customerFaultCount: 0,
    platformFaultCount: 0,
  };

  for (const r of allMatching) {
    if (r.status === "REFUNDED") {
      totals.customerRefundTotal = totals.customerRefundTotal.plus(r.customerRefundAmount);
      totals.sellerDeductionsTotal = totals.sellerDeductionsTotal.plus(r.sellerDeductionAmount);
      totals.customerDeductionsTotal = totals.customerDeductionsTotal.plus(r.deductionAmount);
      totals.platformCostTotal = totals.platformCostTotal.plus(r.platformCost);

      if (r.whoPaidReturnShipping === "Seller") {
        totals.sellerReturnShippingTotal = totals.sellerReturnShippingTotal.plus(r.returnShippingFee);
      }
    }

    if (r.reasonCategory === "SELLER_FAULT") totals.sellerFaultCount++;
    else if (r.reasonCategory === "CUSTOMER_FAULT") totals.customerFaultCount++;
    else if (r.reasonCategory === "PLATFORM_FAULT") totals.platformFaultCount++;
  }

  // Convert Decimals to string/number for client compatibility
  const serializedItems = items.map(item => ({
    ...item,
    refundAmount: Number(item.refundAmount),
    originalShippingFee: Number(item.originalShippingFee),
    returnShippingFee: Number(item.returnShippingFee),
    deductionAmount: Number(item.deductionAmount),
    sellerDeductionAmount: Number(item.sellerDeductionAmount),
    customerRefundAmount: Number(item.customerRefundAmount),
    platformCost: Number(item.platformCost),
    productAmount: Number(item.productAmount || item.refundAmount),
  }));

  const serializedSummary = {
    totalCount: totals.totalCount,
    customerRefundTotal: Number(totals.customerRefundTotal),
    sellerDeductionsTotal: Number(totals.sellerDeductionsTotal),
    customerDeductionsTotal: Number(totals.customerDeductionsTotal),
    platformCostTotal: Number(totals.platformCostTotal),
    sellerReturnShippingTotal: Number(totals.sellerReturnShippingTotal),
    sellerFaultCount: totals.sellerFaultCount,
    customerFaultCount: totals.customerFaultCount,
    platformFaultCount: totals.platformFaultCount,
  };

  return {
    success: true,
    data: serializedItems,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page,
    totalCount,
    summary: serializedSummary,
  };
}

/**
 * Fetches all matched records (without pagination limit) with select pruning for export.
 */
export async function getReturnRequestsExport(filters: Omit<ReportFilters, "page" | "limit">) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized access. Please login.");
  }

  let sellerId = filters.sellerId;
  const isSeller = session.user.role === "SELLER";
  if (isSeller) {
    const sellerProfile = await prisma.sellerProfile.findUnique({
      where: { userId: session.user.id }
    });
    if (!sellerProfile) {
      throw new Error("Seller profile not found.");
    }
    sellerId = sellerProfile.id;
  } else if (session.user.role !== "ADMIN") {
    throw new Error("Unauthorized access.");
  }

  const finalFilters = { ...filters, sellerId };
  const where = buildWhereFilter(finalFilters);

  const items = await prisma.returnRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderId: true,
      reason: true,
      description: true,
      status: true,
      adminNotes: true,
      refundAmount: true,
      originalShippingFee: true,
      returnShippingFee: true,
      shippingResponsibility: true,
      reasonCategory: true,
      deductionAmount: true,
      sellerDeductionAmount: true,
      customerRefundAmount: true,
      platformCost: true,
      reverseCommission: true,
      createdAt: true,
      // Reporting fields
      orderNumber: true,
      sellerStoreName: true,
      customerName: true,
      customerEmail: true,
      productName: true,
      productSku: true,
      quantity: true,
      productAmount: true,
      originalShippingResponsibility: true,
      returnShippingResponsibility: true,
      whoPaidProductRefund: true,
      whoPaidOriginalShipping: true,
      whoPaidReturnShipping: true,
      walletTransactionRef: true,
      ledgerTransactionRef: true,
      approvedAt: true,
      refundedAt: true,
    }
  });

  return items.map(item => ({
    refundId: item.id,
    seller: item.sellerStoreName || "Seller Portal",
    orderNumber: item.orderNumber || "",
    customer: `${item.customerName || "Customer"} (${item.customerEmail || ""})`,
    productName: item.productName || "",
    productSku: item.productSku || "",
    quantity: item.quantity,
    productAmount: Number(item.productAmount || item.refundAmount),
    originalShipping: Number(item.originalShippingFee),
    returnShipping: Number(item.returnShippingFee),
    customerRefund: Number(item.customerRefundAmount),
    sellerDeduction: Number(item.sellerDeductionAmount),
    customerDeduction: Number(item.deductionAmount),
    platformCost: Number(item.platformCost),
    returnReason: item.reason,
    customerComment: item.description || "",
    responsibility: item.shippingResponsibility || "CUSTOMER",
    whoPaidProductRefund: item.whoPaidProductRefund || (item.reasonCategory === "PLATFORM_FAULT" ? "Platform" : "Seller"),
    whoPaidOriginalShipping: item.whoPaidOriginalShipping || "Customer",
    whoPaidReturnShipping: item.whoPaidReturnShipping || "Customer",
    commissionReversed: item.reverseCommission ? "Reversed" : "Remains",
    status: item.status,
    requestedDate: item.createdAt.toISOString(),
    finalizedDate: item.refundedAt ? item.refundedAt.toISOString() : "",
    adminNote: item.adminNotes || "",
    ledgerReference: item.ledgerTransactionRef || "",
    walletTransactionReference: item.walletTransactionRef || "",
  }));
}
