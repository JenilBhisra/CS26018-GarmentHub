import React from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import WalletsClient from "./wallets-client";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
}

export default async function Page({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const params = await searchParams;
  const search = params.search || "";
  const page = parseInt(params.page || "1", 10);
  const limit = 10;
  const skip = (page - 1) * limit;

  // Query sellers and join their wallet.
  const sellers = await prisma.sellerProfile.findMany({
    where: {
      storeName: {
        contains: search,
        mode: "insensitive",
      },
    },
    include: {
      wallet: true,
    },
    skip,
    take: limit,
    orderBy: { storeName: "asc" },
  });

  const totalSellers = await prisma.sellerProfile.count({
    where: {
      storeName: {
        contains: search,
        mode: "insensitive",
      },
    },
  });

  const totalPages = Math.ceil(totalSellers / limit);

  // Map database response to our UI properties
  const walletsData = sellers.map((s) => ({
    id: s.wallet?.id || "",
    storeName: s.storeName,
    sellerId: s.id,
    withdrawableBalance: s.wallet ? Number(s.wallet.withdrawableBalance) : 0,
    pendingBalance: s.wallet ? Number(s.wallet.pendingBalance) : 0,
    negativeBalance: s.wallet ? Number(s.wallet.negativeBalance) : 0,
    reserveBalance: s.wallet ? Number(s.wallet.reserveBalance) : 0,
    totalEarned: s.wallet ? Number(s.wallet.totalEarned) : 0,
    totalPaid: s.wallet ? Number(s.wallet.totalPaid) : 0,
    totalRefunded: s.wallet ? Number(s.wallet.totalRefunded) : 0,
  }));

  return (
    <WalletsClient
      initialSellers={walletsData}
      totalPages={totalPages}
      currentPage={page}
    />
  );
}
