import { Suspense } from "react";
import { getVendorRequests, getVendorStats } from "@/actions/admin";
import { VendorRequestsClient } from "./requests-client";
import { Users, Clock, CheckCircle, XCircle } from "lucide-react";

export const metadata = {
  title: "Vendor Requests — GarmentHub Admin",
};

// Force dynamic rendering — this page hits the database
export const dynamic = "force-dynamic";

export default async function VendorRequestsPage() {
  const [requests, stats] = await Promise.all([
    getVendorRequests(),
    getVendorStats(),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-light text-foreground">Vendor Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and approve seller and B2B vendor applications.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Pending"
          value={stats.total.pending}
          icon={Clock}
          color="amber"
        />
        <StatCard
          label="Total Approved"
          value={stats.total.approved}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          label="Total Rejected"
          value={stats.total.rejected}
          icon={XCircle}
          color="red"
        />
        <StatCard
          label="Total Vendors"
          value={stats.total.pending + stats.total.approved + stats.total.rejected}
          icon={Users}
          color="blue"
        />
      </div>

      {/* Breakdown row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-orange-400" />
            <span className="font-medium">Sellers</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div className="text-center">
              <div className="text-lg font-semibold text-amber-600">{stats.seller.pending}</div>
              <div>Pending</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">{stats.seller.approved}</div>
              <div>Approved</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-red-600">{stats.seller.rejected}</div>
              <div>Rejected</div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="h-2 w-2 rounded-full bg-blue-400" />
            <span className="font-medium">B2B Vendors</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div className="text-center">
              <div className="text-lg font-semibold text-amber-600">{stats.b2b.pending}</div>
              <div>Pending</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">{stats.b2b.approved}</div>
              <div>Approved</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-red-600">{stats.b2b.rejected}</div>
              <div>Rejected</div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive table */}
      <Suspense fallback={<RequestsTableSkeleton />}>
        <VendorRequestsClient initialRequests={requests} />
      </Suspense>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: "amber" | "green" | "red" | "blue";
}) {
  const colorMap = {
    amber: "text-amber-600 bg-amber-50 border-amber-100",
    green: "text-green-600 bg-green-50 border-green-100",
    red: "text-red-600 bg-red-50 border-red-100",
    blue: "text-blue-600 bg-blue-50 border-blue-100",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className={`inline-flex rounded-lg p-2 border ${colorMap[color]} mb-3`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function RequestsTableSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card animate-pulse">
      <div className="p-4 border-b border-border">
        <div className="h-8 w-48 bg-muted rounded" />
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-4 p-4 border-b border-border last:border-0">
          <div className="h-10 w-10 bg-muted rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-3 w-48 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
