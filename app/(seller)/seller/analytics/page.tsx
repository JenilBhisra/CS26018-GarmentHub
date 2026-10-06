import { ensureKycApproved } from "@/actions/kyc";
import { getSellerAnalytics, getSellerAlerts } from "@/actions/analytics";
import SellerAnalyticsClient from "./lazy-analytics-client";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";

export const metadata = {
  title: "Analytics Dashboard — GarmentHub",
};

export default async function Page() {
  await ensureKycApproved();

  // Fetch initial 30 days data
  const initialFilter = "30days";
  const analyticsData = await getSellerAnalytics(initialFilter);
  const alerts = await getSellerAlerts();

  return (
    <div className="space-y-6">
      {/* Alert Notices */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          {alerts.map((a, idx) => {
            let bgClass = "bg-blue-50 border-blue-200 text-blue-800";
            let Icon = Info;
            if (a.type === "danger") {
              bgClass = "bg-red-50 border-red-200 text-red-800";
              Icon = AlertCircle;
            } else if (a.type === "warning") {
              bgClass = "bg-amber-50 border-amber-200 text-amber-800";
              Icon = AlertTriangle;
            }

            return (
              <div key={idx} className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${bgClass}`}>
                <Icon className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">{a.title}</h4>
                  <p className="text-xs mt-1 opacity-90">{a.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Client Content */}
      <SellerAnalyticsClient initialData={analyticsData} initialFilter={initialFilter} />
    </div>
  );
}
