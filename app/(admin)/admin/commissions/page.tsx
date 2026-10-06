import React from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Search, AlertCircle, TrendingUp, Percent, ShieldCheck } from "lucide-react";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    page?: string;
  }>;
}

export default async function Page({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const params = await searchParams;
  const search = params.search || "";
  const page = parseInt(params.page || "1", 10);
  const limit = 10;
  const skip = (page - 1) * limit;

  // Build filter options
  const whereClause: any = {};
  if (search.trim()) {
    whereClause.OR = [
      { order: { orderNumber: { contains: search.trim(), mode: "insensitive" } } },
      { order: { seller: { storeName: { contains: search.trim(), mode: "insensitive" } } } },
    ];
  }

  // Fetch commissions
  const commissions = await prisma.commission.findMany({
    where: whereClause,
    include: {
      order: {
        select: {
          orderNumber: true,
          subtotal: true,
          discountAmount: true,
          sellerEarning: true,
          seller: { select: { storeName: true } },
        },
      },
    },
    skip,
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  const totalCommissions = await prisma.commission.count({ where: whereClause });
  const totalPages = Math.ceil(totalCommissions / limit);

  // Aggregate stats (sitewide)
  const statsAggregate = await prisma.commission.aggregate({
    _sum: {
      amount: true,
    },
  });

  const ordersCount = await prisma.order.count({
    where: { status: { not: "CANCELLED" } },
  });

  const totalPlatformComms = Number(statsAggregate._sum.amount || 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Platform Commissions</h1>
        <p className="text-sm text-muted-foreground">Detailed billing audit trails for platform splits on order transactions.</p>
      </div>

      {/* Aggregate Widgets */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total Commission Earned</span>
            <Percent className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 font-display text-3xl text-emerald-600 font-semibold">
            ₹{totalPlatformComms.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Sum of platform cuts on active sales</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total Sales Billed</span>
            <TrendingUp className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 font-display text-3xl text-foreground font-semibold">
            {ordersCount} orders
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">Excludes cancelled transactions</div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Billing Security</span>
            <ShieldCheck className="h-4 w-4 text-sky-600" />
          </div>
          <div className="mt-2 font-display text-lg text-foreground font-semibold">
            Immutable Audit logs
          </div>
          <div className="text-[10px] text-muted-foreground mt-2">Historical commission values remain locked</div>
        </div>
      </div>

      {/* Search Filter */}
      <form method="GET" className="flex gap-2 max-w-md">
        <input
          type="text"
          name="search"
          placeholder="Search order # or store name..."
          defaultValue={search}
          className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm text-foreground focus:border-accent outline-none"
        />
        <button
          type="submit"
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted cursor-pointer"
        >
          Search
        </button>
      </form>

      {/* Commissions Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left">Order Number</th>
              <th className="px-4 py-3 text-left">Vendor Store</th>
              <th className="px-4 py-3 text-right">Order Subtotal</th>
              <th className="px-4 py-3 text-center">Commission Rate</th>
              <th className="px-4 py-3 text-right">Platform Fee split</th>
              <th className="px-4 py-3 text-right">Vendor Net Earnings</th>
              <th className="px-4 py-3 text-left">Billed Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {commissions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                    <span>No commission billing logs recorded.</span>
                  </div>
                </td>
              </tr>
            ) : (
              commissions.map((c) => {
                const discAmt = Number(c.order.discountAmount);
                const subAmt = Number(c.order.subtotal);
                const commAmt = Number(c.amount);
                // Seller Net Earning = Subtotal - Discount - Commission
                const sellerEarning = Number(c.order.sellerEarning) > 0 
                  ? Number(c.order.sellerEarning) 
                  : Math.max(0, subAmt - discAmt - commAmt);
                  
                return (
                  <tr key={c.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-4 font-semibold text-foreground font-mono">
                      {c.order.orderNumber}
                    </td>
                    <td className="px-4 py-4 text-foreground">{c.order.seller?.storeName || "Atelier"}</td>
                    <td className="px-4 py-4 text-right font-mono text-foreground">
                      ₹{subAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      {discAmt > 0 && (
                        <div className="text-[10px] text-destructive">Discount: -₹{discAmt.toLocaleString("en-IN")}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center font-semibold text-muted-foreground">
                      {(c.rate * 100).toFixed(0)}%
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-emerald-600 font-semibold">
                      +₹{commAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-indigo-600">
                      ₹{sellerEarning.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Link
              href={`/admin/commissions?search=${search}&page=${page - 1}`}
              className={`rounded border border-border px-3 py-1 text-xs hover:bg-muted ${
                page <= 1 ? "pointer-events-none opacity-40" : ""
              }`}
            >
              Previous
            </Link>
            <Link
              href={`/admin/commissions?search=${search}&page=${page + 1}`}
              className={`rounded border border-border px-3 py-1 text-xs hover:bg-muted ${
                page >= totalPages ? "pointer-events-none opacity-40" : ""
              }`}
            >
              Next
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
