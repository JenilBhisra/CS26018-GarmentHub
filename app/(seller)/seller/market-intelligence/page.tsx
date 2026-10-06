import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMarketInsights } from "@/actions/intelligence";
import MarketClient from "./market-client";

export const metadata = {
  title: "General Market Intelligence — Seller Portal",
};

export default async function MarketIntelligencePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  let insights = null;
  try {
    const res = await getMarketInsights();
    if (res.success && res.data) {
      insights = res.data;
    }
  } catch (err) {
    console.error("Failed to load market insights:", err);
  }

  return (
    <MarketClient marketData={insights} />
  );
}
