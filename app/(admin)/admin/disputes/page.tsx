import React from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DisputesClient from "./disputes-client";
import { DisputeStatus, DisputePriority } from "@prisma/client";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    priority?: string;
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
  const priority = params.priority || "ALL";

  // Build filter options
  const whereClause: any = {};

  if (search.trim()) {
    whereClause.OR = [
      { reason: { contains: search.trim(), mode: "insensitive" } },
      { description: { contains: search.trim(), mode: "insensitive" } },
      { seller: { storeName: { contains: search.trim(), mode: "insensitive" } } },
    ];
  }

  if (status !== "ALL") {
    whereClause.status = status as DisputeStatus;
  }

  if (priority !== "ALL") {
    whereClause.priority = priority as DisputePriority;
  }

  const disputes = await prisma.dispute.findMany({
    where: whereClause,
    include: {
      order: { select: { orderNumber: true, totalAmount: true } },
      customer: { select: { name: true, email: true } },
      seller: { select: { storeName: true } },
      notes: {
        include: {
          author: { select: { name: true, role: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const formattedDisputes = disputes.map((d) => ({
    id: d.id,
    orderId: d.orderId,
    orderNumber: d.order?.orderNumber || null,
    productId: d.productId,
    customerId: d.customerId,
    customerName: d.customer?.name || "Global Customer",
    customerEmail: d.customer?.email || null,
    sellerId: d.sellerId,
    sellerStoreName: d.seller?.storeName || "Global Platform",
    reason: d.reason,
    description: d.description,
    status: d.status,
    priority: d.priority,
    adminNotes: d.adminNotes,
    createdAt: d.createdAt,
    notes: d.notes.map((n) => ({
      id: n.id,
      note: n.note,
      isInternal: n.isInternal,
      authorName: n.author.name,
      authorRole: n.author.role,
      createdAt: n.createdAt,
    })),
  }));

  return <DisputesClient disputes={formattedDisputes} />;
}
