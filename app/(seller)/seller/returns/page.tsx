import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureKycApproved } from "@/actions/kyc";
import { getReturnRequestsSeller } from "@/actions/returns";
import { serializeDecimals } from "@/lib/serialize";
import SellerReturnsClient from "./returns-client";

export const metadata = {
  title: "Returns & Refunds — Seller Portal",
};

export default async function SellerReturnsPage() {
  // Ensure the seller is logged in and their KYC is approved
  await ensureKycApproved();

  const session = await auth();
  if (!session?.user) redirect("/login");

  // Fetch only this seller's return requests and preferences
  let initialReturns: any[] = [];
  try {
    initialReturns = await getReturnRequestsSeller();
  } catch (err) {
    console.error("Failed to load seller returns:", err);
  }

  const userPreference = await prisma.userPreference.findUnique({
    where: { userId: session.user.id },
  });

  const defaults = {
    cardOrder: [],
    hiddenCards: [],
    collapsedWidgets: [],
    savedViews: [],
  };

  const preferences = userPreference
    ? { ...defaults, ...(userPreference.settings as any) }
    : defaults;

  return (
    <SellerReturnsClient
      initialReturns={serializeDecimals(initialReturns)}
      initialPreferences={preferences}
    />
  );
}
