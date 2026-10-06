import React from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import SettlementsClient from "./settlements-client";
import { PayoutStatus } from "@prisma/client";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
  }>;
}

export default async function Page({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const params = await searchParams;
  const search = params.search || "";
  const status = params.status || "ALL";

  // Build payout query filters
  const payoutWhere: any = {};
  if (search.trim()) {
    payoutWhere.seller = {
      storeName: {
        contains: search.trim(),
        mode: "insensitive",
      },
    };
  }
  if (status !== "ALL") {
    payoutWhere.status = status as PayoutStatus;
  }

  // Build returns query filters
  const returnWhere: any = {};
  if (search.trim()) {
    returnWhere.OR = [
      { order: { orderNumber: { contains: search.trim(), mode: "insensitive" } } },
      { customer: { name: { contains: search.trim(), mode: "insensitive" } } },
      { seller: { storeName: { contains: search.trim(), mode: "insensitive" } } },
    ];
  }

  // Load both datasets in parallel
  const [payouts, returns] = await Promise.all([
    prisma.payoutRequest.findMany({
      where: payoutWhere,
      include: {
        seller: {
          select: {
            storeName: true,
            bankAccountHolder: true,
            bankAccountNumber: true,
            bankIFSC: true,
            bankName: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.returnRequest.findMany({
      where: returnWhere,
      include: {
        order: { select: { orderNumber: true, totalAmount: true } },
        customer: { select: { name: true, email: true } },
        seller: { select: { storeName: true } },
        returnReasonRule: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const formattedPayouts = payouts.map((p) => ({
    id: p.id,
    sellerId: p.sellerId,
    storeName: p.seller.storeName,
    bankAccountHolder: p.seller.bankAccountHolder,
    bankAccountNumber: p.seller.bankAccountNumber,
    bankIFSC: p.seller.bankIFSC,
    bankName: p.seller.bankName,
    amount: Number(p.amount),
    status: p.status,
    bankReference: p.bankReference,
    rejectionReason: p.rejectionReason,
    adminNotes: p.adminNotes,
    createdAt: p.createdAt,
  }));

  const formattedReturns = returns.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    orderNumber: r.order.orderNumber,
    customerName: r.customer.name,
    customerEmail: r.customer.email,
    sellerStoreName: r.seller.storeName,
    reason: r.reason,
    description: r.description,
    status: r.status,
    refundAmount: Number(r.refundAmount),
    restoreStock: r.restoreStock,
    stockRestored: r.stockRestored,
    originalShippingFee: Number(r.originalShippingFee),
    returnShippingFee: Number(r.returnShippingFee),
    shippingResponsibility: r.shippingResponsibility,
    reasonCategory: r.reasonCategory,
    deductionAmount: Number(r.deductionAmount),
    sellerDeductionAmount: Number(r.sellerDeductionAmount),
    customerRefundAmount: Number(r.customerRefundAmount),
    platformCost: Number(r.platformCost || 0),
    reverseCommission: r.reverseCommission,
    returnReasonRuleId: r.returnReasonRuleId,
    returnReasonRule: r.returnReasonRule ? {
      id: r.returnReasonRule.id,
      name: r.returnReasonRule.name,
      responsibility: r.returnReasonRule.responsibility,
      originalShippingResponsibility: r.returnReasonRule.originalShippingResponsibility,
      returnShippingResponsibility: r.returnReasonRule.returnShippingResponsibility,
      reverseCommission: r.returnReasonRule.reverseCommission,
    } : null,
    adminNotes: r.adminNotes,
    createdAt: r.createdAt,
  }));

  return (
    <SettlementsClient
      payouts={formattedPayouts}
      returns={formattedReturns}
    />
  );
}
