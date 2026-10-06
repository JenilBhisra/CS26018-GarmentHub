import React from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getReturnReasonRules, seedReturnReasonRules } from "@/actions/returns";
import ReturnRefundManagementClient from "./management-client";

export const metadata = {
  title: "Return & Refund Rules Management — GarmentHub",
};

export default async function ReturnRefundManagementPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  // Pre-seed rules if empty
  let rules = await getReturnReasonRules();
  if (rules.length === 0) {
    const seedRes = await seedReturnReasonRules();
    rules = await getReturnReasonRules();
  }

  // Format rules for client component
  const formattedRules = rules.map((r: any) => ({
    id: r.id,
    name: r.name,
    description: r.description || "",
    responsibility: r.responsibility,
    originalShippingResponsibility: r.originalShippingResponsibility,
    returnShippingResponsibility: r.returnShippingResponsibility,
    reverseCommission: r.reverseCommission,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-foreground">Return & Refund Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure return reasons, shipping responsibilities, and platform commission behaviors.
        </p>
      </div>

      <ReturnRefundManagementClient initialRules={formattedRules} />
    </div>
  );
}
