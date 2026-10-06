import { ensureKycApproved } from "@/actions/kyc";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureSellerWallet } from "@/actions/wallets";
import SellerReportsClient from "./reports-client";

export const metadata = {
  title: "Compile Store Reports — GarmentHub Seller",
};

export default async function SellerReportsPage() {
  await ensureKycApproved();

  const session = await auth();
  if (!session?.user || session.user.role !== "SELLER") {
    redirect("/login");
  }

  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: session.user.id },
    include: { wallet: true },
  });

  if (!seller) {
    redirect("/login");
  }

  const wallet = seller.wallet || (await ensureSellerWallet(seller.id));

  // Compute total sales and commission deductions
  const [salesAgg, commissionAgg] = await Promise.all([
    prisma.order.aggregate({
      _sum: { subtotal: true },
      where: { sellerId: seller.id, status: { notIn: ["CANCELLED"] } },
    }),
    prisma.order.aggregate({
      _sum: { commissionAmount: true },
      where: { sellerId: seller.id, status: { notIn: ["CANCELLED"] } },
    }),
  ]);

  const summary = {
    totalSales: (salesAgg._sum.subtotal || 0).toString(),
    totalEarned: wallet.totalEarned.toString(),
    commissionDeducted: (commissionAgg._sum.commissionAmount || 0).toString(),
    refundDeductions: wallet.totalRefunded.toString(),
    amountOnHold: wallet.pendingBalance.plus(wallet.reserveBalance).toString(),
    amountPaid: wallet.totalPaid.toString(),
    availableBalance: wallet.withdrawableBalance.toString(),
    negativeBalance: wallet.negativeBalance.toString(),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-light text-stone-900">Store Reports</h1>
        <p className="text-sm text-stone-500 mt-1">
          Compile and download reports on your store sales, accounting statements, product performance, and stock inventory.
        </p>
      </div>

      <SellerReportsClient summary={summary} />
    </div>
  );
}
