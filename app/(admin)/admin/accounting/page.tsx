import React from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { reconcilePlatformFinancials, getFinancialHealthReport, reconcileAllWalletsAdmin } from "@/actions/wallets";
import AccountingClient from "./accounting-client";

export const metadata = {
  title: "Financial Ledger & Control — GarmentHub Admin",
};

export default async function AdminAccountingPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== Role.ADMIN) {
    redirect("/unauthorized");
  }

  // Load accounting checks in parallel
  const [platformRecon, healthReport, walletRecon] = await Promise.all([
    reconcilePlatformFinancials(),
    getFinancialHealthReport(),
    reconcileAllWalletsAdmin(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-light text-stone-900">Financial Ledger & Accounting Control</h1>
        <p className="text-sm text-stone-500 mt-1">
          Double-entry financial control engine status, live platform reconciliation checks, and wallet audits.
        </p>
      </div>

      <AccountingClient
        initialPlatformRecon={platformRecon}
        initialHealthReport={healthReport}
        initialWalletRecon={walletRecon}
      />
    </div>
  );
}
