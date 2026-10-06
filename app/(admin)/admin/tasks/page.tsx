import React from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminTasksClient from "./tasks-client";

export const metadata = {
  title: "Admin Task Center — GarmentHub",
};

export default async function AdminTasksPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const [pendingKycList, pendingPayoutList, openDisputes] = await Promise.all([
    prisma.sellerKYC.findMany({
      where: { status: "PENDING_REVIEW" },
      include: {
        seller: {
          select: {
            storeName: true,
            bankName: true,
            bankAccountNumber: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payoutRequest.findMany({
      where: { status: "PENDING" },
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
    prisma.dispute.findMany({
      where: { status: "OPEN" },
      include: {
        order: {
          select: {
            orderNumber: true,
            totalAmount: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const mappedKycList = pendingKycList.map((k) => ({
    id: k.id,
    sellerId: k.sellerId,
    storeName: k.seller.storeName,
    gstCertificate: k.gstCertificate,
    panCard: k.panCard,
    idProof: k.idProof,
    addressProof: k.addressProof,
    bankProof: k.bankProof,
    status: k.status,
  }));

  const mappedPayoutList = pendingPayoutList.map((p) => ({
    id: p.id,
    sellerId: p.sellerId,
    storeName: p.seller.storeName,
    bankAccountHolder: p.seller.bankAccountHolder,
    bankAccountNumber: p.seller.bankAccountNumber,
    bankIFSC: p.seller.bankIFSC,
    bankName: p.seller.bankName,
    amount: Number(p.amount),
    status: p.status,
    createdAt: p.createdAt,
  }));

  const mappedDisputes = openDisputes
    .filter((d) => d.order !== null)
    .map((d) => ({
      id: d.id,
      orderId: d.orderId,
      orderNumber: d.order!.orderNumber,
      reason: d.reason,
      description: d.description,
      status: d.status,
      totalAmount: Number(d.order!.totalAmount),
      createdAt: d.createdAt,
    }));

  return (
    <AdminTasksClient
      initialKyc={mappedKycList}
      initialPayouts={mappedPayoutList}
      initialDisputes={mappedDisputes}
    />
  );
}
