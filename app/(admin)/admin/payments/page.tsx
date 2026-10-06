import React from "react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { PaymentStatus } from "@prisma/client";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
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
  const status = params.status || "ALL";
  const page = parseInt(params.page || "1", 10);
  const limit = 10;
  const skip = (page - 1) * limit;

  // Build filter options
  const whereClause: any = {};
  if (search.trim()) {
    whereClause.OR = [
      { transactionId: { contains: search.trim(), mode: "insensitive" } },
      { order: { orderNumber: { contains: search.trim(), mode: "insensitive" } } },
    ];
  }

  if (status !== "ALL") {
    whereClause.status = status as PaymentStatus;
  }

  // Fetch transactions
  const transactions = await prisma.paymentTransaction.findMany({
    where: whereClause,
    include: {
      order: {
        select: {
          orderNumber: true,
        },
      },
    },
    skip,
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  const totalTransactions = await prisma.paymentTransaction.count({ where: whereClause });
  const totalPages = Math.ceil(totalTransactions / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Payment Transactions</h1>
        <p className="text-sm text-muted-foreground">Audit log of customer payment transactions collected via manual, COD, or card channels.</p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form method="GET" className="flex-1 flex gap-2">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              name="search"
              placeholder="Search txn ID or order #..."
              defaultValue={search}
              className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm text-foreground focus:border-accent outline-none"
            />
          </div>
          {status !== "ALL" && <input type="hidden" name="status" value={status} />}
          <button
            type="submit"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted cursor-pointer"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase">Status:</label>
          <form method="GET" className="inline-block">
            {search && <input type="hidden" name="search" value={search} />}
            <select
              name="status"
              onChange={(e) => {
                const form = e.target.form;
                if (form) form.submit();
              }}
              defaultValue={status}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="FAILED">Failed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </form>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left">Transaction ID</th>
              <th className="px-4 py-3 text-left">Order Number</th>
              <th className="px-4 py-3 text-left">Payment Channel</th>
              <th className="px-4 py-3 text-right">Amount Billed</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-left">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-1">
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                    <span>No transactions recorded.</span>
                  </div>
                </td>
              </tr>
            ) : (
              transactions.map((t) => (
                <tr key={t.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-4.5 font-medium text-foreground font-mono">
                    {t.transactionId || `TXN-${t.id.substring(0, 8).toUpperCase()}`}
                  </td>
                  <td className="px-4 py-4.5 font-semibold text-foreground font-mono">
                    {t.order.orderNumber}
                  </td>
                  <td className="px-4 py-4.5 text-foreground font-medium">{t.paymentMethod}</td>
                  <td className="px-4 py-4.5 text-right font-mono font-semibold text-foreground">
                    ₹{Number(t.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4.5 text-center">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        t.status === "PAID"
                          ? "bg-emerald-100 text-emerald-800"
                          : t.status === "PENDING"
                          ? "bg-amber-100 text-amber-800"
                          : t.status === "FAILED"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-4.5 text-muted-foreground">
                    {new Date(t.createdAt).toLocaleString("en-IN")}
                  </td>
                </tr>
              ))
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
              href={`/admin/payments?search=${search}&status=${status}&page=${page - 1}`}
              className={`rounded border border-border px-3 py-1 text-xs hover:bg-muted ${
                page <= 1 ? "pointer-events-none opacity-40" : ""
              }`}
            >
              Previous
            </Link>
            <Link
              href={`/admin/payments?search=${search}&status=${status}&page=${page + 1}`}
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
