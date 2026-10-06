import { ensureKycApproved } from "@/actions/kyc";
import { getPackLogDetail } from "@/actions/packlogs";
import { serializeDecimals } from "@/lib/serialize";
import { notFound } from "next/navigation";
import PackLogDetailClient from "./detail-client";

export const metadata = {
  title: "Pack Log Details — GarmentHub",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await ensureKycApproved();

  const { id } = await params;
  const res = await getPackLogDetail(id);
  if (!res.success || !res.packLog) {
    notFound();
  }

  return <PackLogDetailClient packLog={serializeDecimals(res.packLog)} />;
}
