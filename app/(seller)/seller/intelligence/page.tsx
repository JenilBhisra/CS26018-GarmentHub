import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getSellerMetricSnapshot, getSellerInsights, getSellerProductMetrics, getSellerRecommendations } from "@/actions/intelligence";
import IntelligenceClient from "./intelligence-client";

export const metadata = {
  title: "Personal Business Intelligence — Seller Portal",
};

export default async function PersonalIntelligencePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Get precomputed seller snapshot
  let metrics = {
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalReturns: 0,
    conversionRate: 0.0,
    completedOrderCount: 0
  };

  try {
    const res = await getSellerMetricSnapshot();
    if (res.success && res.data) {
      metrics = res.data;
    }
  } catch (err) {
    console.error("Failed to load metrics snapshot:", err);
  }

  // Get active / locked insights
  let insights = null;
  try {
    const res = await getSellerInsights(metrics.completedOrderCount);
    if (res.success && res.data) {
      insights = res.data;
    }
  } catch (err) {
    console.error("Failed to load seller insights:", err);
  }

  // Get direct product performance metrics
  let productMetrics: any[] = [];
  try {
    const res = await getSellerProductMetrics();
    if (res.success && res.data) {
      productMetrics = res.data;
    }
  } catch (err) {
    console.error("Failed to load seller product metrics:", err);
  }

  // Get active smart growth recommendations
  let initialRecommendations: any[] = [];
  try {
    const res = await getSellerRecommendations();
    if (res.success && res.data) {
      initialRecommendations = res.data;
    }
  } catch (err) {
    console.error("Failed to load seller recommendations:", err);
  }

  return (
    <IntelligenceClient 
      metrics={metrics} 
      insights={insights} 
      productMetrics={productMetrics} 
      initialRecommendations={initialRecommendations}
    />
  );
}
