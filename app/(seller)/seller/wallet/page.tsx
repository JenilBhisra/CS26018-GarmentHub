import React from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ensureSellerWallet } from "@/actions/wallets";
import WalletClient from "./wallet-client";
import { ensureKycApproved } from "@/actions/kyc";

export default async function Page() {
  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    redirect("/login");
  }

  // Fetch merchant profile
  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
    include: { kyc: true, wallet: true },
  });

  if (!seller) {
    redirect("/login");
  }

  // Ensure wallet exists in database
  const wallet = seller.wallet || (await ensureSellerWallet(seller.id));

  // Check completeness parameters
  const kycApproved = seller.kyc?.status === "APPROVED";
  const bankComplete = !!(
    seller.bankAccountNumber &&
    seller.bankIFSC &&
    seller.bankName &&
    seller.bankAccountHolder
  );

  // Fetch payout requests and wallet transaction logs
  const [payouts, transactions] = await Promise.all([
    prisma.payoutRequest.findMany({
      where: { sellerId: seller.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.walletTransaction.findMany({
      where: { sellerWalletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const formattedPayouts = payouts.map((p) => ({
    id: p.id,
    amount: Number(p.amount),
    status: p.status,
    bankReference: p.bankReference,
    rejectionReason: p.rejectionReason,
    adminNotes: p.adminNotes,
    createdAt: p.createdAt,
  }));

  const formattedTransactions = transactions.map((t) => ({
    id: t.id,
    amount: Number(t.amount),
    type: t.type,
    status: t.status,
    description: t.description,
    releaseAt: t.releaseAt,
    isReleased: t.isReleased,
    createdAt: t.createdAt,
  }));

  return (
    <WalletClient
      sellerId={seller.id}
      withdrawableBalance={Number(wallet.withdrawableBalance)}
      pendingBalance={Number(wallet.pendingBalance)}
      negativeBalance={Number(wallet.negativeBalance)}
      reserveBalance={Number(wallet.reserveBalance)}
      totalEarned={Number(wallet.totalEarned)}
      totalPaid={Number(wallet.totalPaid)}
      totalRefunded={Number(wallet.totalRefunded)}
      kycApproved={kycApproved}
      bankComplete={bankComplete}
      payouts={formattedPayouts}
      transactions={formattedTransactions}
    />
  );
}
