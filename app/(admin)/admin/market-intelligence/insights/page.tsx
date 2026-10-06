import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDatasetDetailsAdmin } from "@/actions/intelligence";
import InsightsClient from "./insights-client";

export const metadata = {
  title: "Admin Insight Review Panel — GarmentHub",
};

interface PageProps {
  searchParams: Promise<{ id?: string }>;
}

export default async function AdminInsightsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const resolvedParams = await searchParams;
  const selectedId = resolvedParams.id;

  // 1. Fetch all datasets (including archived/active status)
  const datasets = await prisma.marketDataset.findMany({
    orderBy: { createdAt: "desc" }
  });

  const formattedDatasets = datasets.map(d => ({
    id: d.id,
    originalName: d.originalName,
    status: d.status,
    isActive: d.isActive,
    isArchived: d.isArchived,
    rowCount: d.rowCount,
    createdAt: d.createdAt.toISOString()
  }));

  // 2. Determine which dataset details to fetch
  let activeDatasetId = selectedId;
  if (!activeDatasetId) {
    // If no ID selected, fall back to active dataset, then latest completed
    const activeDs = datasets.find(d => d.isActive && d.status === "COMPLETED");
    if (activeDs) {
      activeDatasetId = activeDs.id;
    } else {
      const latestCompleted = datasets.find(d => d.status === "COMPLETED");
      if (latestCompleted) activeDatasetId = latestCompleted.id;
    }
  }

  // 3. Fetch details for the target dataset
  let datasetDetails = null;
  if (activeDatasetId) {
    const res = await getDatasetDetailsAdmin(activeDatasetId);
    if (res.success && res.data) {
      datasetDetails = res.data;
    }
  }

  return (
    <InsightsClient 
      datasets={formattedDatasets} 
      initialDatasetDetails={datasetDetails} 
    />
  );
}
