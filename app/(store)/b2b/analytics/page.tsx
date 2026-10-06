import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getB2BAnalytics } from "@/actions/analytics";
import B2BAnalyticsClient from "./analytics-client";
import { CustomerLayout } from "@/components/site/layout";
import { Role } from "@prisma/client";
import Link from "next/link";

export const metadata = {
  title: "Procurement Analytics — GarmentHub B2B",
};

export default async function B2BAnalyticsPage() {
  const session = await auth();
  if (!session?.user || (session.user.role !== Role.B2B_VENDOR && session.user.role !== Role.ADMIN)) {
    redirect("/b2b");
  }

  const analyticsData = await getB2BAnalytics();

  return (
    <CustomerLayout>
      <div className="container-page py-10 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="text-xs font-semibold text-stone-500 uppercase tracking-widest flex items-center gap-1.5 border-b border-stone-200 pb-4">
          <Link href="/b2b" className="hover:text-stone-900 transition-colors">B2B Portal</Link>
          <span>/</span>
          <Link href="/b2b/rfqs" className="hover:text-stone-900 transition-colors">My Inquiries</Link>
          <span>/</span>
          <span className="text-stone-900 font-bold">Analytics</span>
        </div>

        {/* Dashboard Content */}
        <B2BAnalyticsClient initialData={analyticsData} />
      </div>
    </CustomerLayout>
  );
}
