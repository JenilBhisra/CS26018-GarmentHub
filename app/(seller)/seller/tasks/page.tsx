import React from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import SellerTasksClient from "./tasks-client";

export const metadata = {
  title: "My Task Center — GarmentHub Seller",
};

export default async function SellerTasksPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    redirect("/login");
  }

  // Resolve seller profile
  const profile = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
  });
  if (!profile) redirect("/login");

  const sellerId = profile.id;

  const [ordersToShip, lowStockVariants, outOfStockVariants, pendingReturns] =
    await Promise.all([
      // Orders awaiting shipment (PROCESSING status)
      prisma.order.findMany({
        where: { sellerId, status: "PROCESSING" },
        include: {
          user: { select: { name: true, email: true } },
          items: { take: 1 },
        },
        orderBy: { createdAt: "asc" },
        take: 50,
      }),

      // Low stock (1-5 units remaining)
      prisma.productVariant.findMany({
        where: { product: { sellerId }, stock: { gt: 0, lte: 5 } },
        include: {
          product: { select: { name: true, id: true } },
        },
        orderBy: { stock: "asc" },
        take: 30,
      }),

      // Out of stock (0 units)
      prisma.productVariant.findMany({
        where: { product: { sellerId }, stock: 0 },
        include: {
          product: { select: { name: true, id: true } },
        },
        take: 30,
      }),

      // Open return requests needing attention
      prisma.returnRequest.findMany({
        where: {
          sellerId,
          status: { in: ["REQUESTED", "ITEM_RECEIVED"] },
        },
        include: {
          order: { select: { orderNumber: true } },
          customer: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 30,
      }),
    ]);

  const mappedOrdersToShip = ordersToShip.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.user.name || "—",
    customerEmail: o.user.email || "—",
    firstProductName: "Order items",
    itemCount: o.items.length,
    totalAmount: Number(o.totalAmount),
    createdAt: o.createdAt,
    status: o.status,
  }));

  const mappedLowStock = lowStockVariants.map((v) => ({
    id: v.id,
    productId: v.product.id,
    productName: v.product.name,
    size: v.size,
    color: v.color,
    stock: v.stock,
    sku: v.sku,
  }));

  const mappedOutOfStock = outOfStockVariants.map((v) => ({
    id: v.id,
    productId: v.product.id,
    productName: v.product.name,
    size: v.size,
    color: v.color,
    stock: v.stock,
    sku: v.sku,
  }));

  const mappedReturns = pendingReturns.map((r) => ({
    id: r.id,
    orderNumber: r.order?.orderNumber || "—",
    customerName: r.customer?.name || "—",
    reason: r.reason,
    status: r.status,
    refundAmount: Number(r.refundAmount),
    createdAt: r.createdAt,
    firstProductName: "Return request",
  }));

  return (
    <SellerTasksClient
      ordersToShip={mappedOrdersToShip}
      lowStockVariants={mappedLowStock}
      outOfStockVariants={mappedOutOfStock}
      pendingReturns={mappedReturns}
    />
  );
}
