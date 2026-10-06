import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getCustomerAnalytics } from "@/actions/analytics";
import CustomerAnalyticsClient from "./analytics-client";

export const metadata = {
  title: "Purchase Analytics — GarmentHub Account",
};

export default async function AccountAnalyticsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const analyticsData = await getCustomerAnalytics();

  return <CustomerAnalyticsClient initialData={analyticsData} />;
}
