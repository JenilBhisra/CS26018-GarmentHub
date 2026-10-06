import { ensureKycApproved } from "@/actions/kyc";
import { getPackLogs } from "@/actions/packlogs";
import PackLogsClient from "./pack-logs-client";

export const metadata = {
  title: "Pack Logs — GarmentHub",
};

export default async function Page() {
  await ensureKycApproved();

  const res = await getPackLogs();
  const packLogs = res.success && res.packLogs ? res.packLogs : [];

  return <PackLogsClient packLogs={packLogs} />;
}
