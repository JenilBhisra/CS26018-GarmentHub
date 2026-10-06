import { ensureKycApproved } from "@/actions/kyc";
import { getPackLogDetail } from "@/actions/packlogs";
import { getTmpBins } from "@/actions/scan-pack";
import { notFound } from "next/navigation";
import ScanPackClient from "./scan-client";

export const metadata = {
  title: "Scan & Pack Orders — GarmentHub",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await ensureKycApproved();

  const { id } = await params;
  const [packLogRes, binsRes] = await Promise.all([getPackLogDetail(id), getTmpBins(id)]);

  if (!packLogRes.success || !packLogRes.packLog) {
    notFound();
  }

  return (
    <ScanPackClient
      packLogId={id}
      packLogName={packLogRes.packLog.name}
      initialBins={binsRes.success ? binsRes.bins : []}
      initialScannedCount={binsRes.success ? binsRes.scannedCount : 0}
      totalCount={binsRes.success ? binsRes.totalCount : 0}
    />
  );
}
