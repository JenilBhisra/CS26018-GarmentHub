import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMarketDatasetsAdmin } from "@/actions/intelligence";
import UploadClient from "./upload-client";

export const metadata = {
  title: "Market Intelligence Upload — Admin Portal",
};

export default async function AdminMarketIntelligencePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  let datasets: any[] = [];
  try {
    const res = await getMarketDatasetsAdmin();
    if (res.success && res.data) {
      datasets = res.data;
    }
  } catch (err) {
    console.error("Failed to load datasets:", err);
  }

  return (
    <UploadClient initialDatasets={datasets} />
  );
}
