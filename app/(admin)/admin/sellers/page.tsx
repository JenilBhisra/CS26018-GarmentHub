import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = 20;

  const [totalSellers, sellers] = await Promise.all([
    prisma.sellerProfile.count(),
    prisma.sellerProfile.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        storeName: true,
        pickupAddress: true,
        approvalStatus: true,
        _count: { select: { products: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalPages = Math.ceil(totalSellers / pageSize) || 1;

  const statusClass: Record<string, string> = {
    APPROVED: "bg-success/10 text-success",
    PENDING: "bg-amber-100 text-amber-800",
    REJECTED: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl">Sellers</h1>
        <p className="text-sm text-muted-foreground">{totalSellers} registered sellers</p>
      </div>
      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left">Store</th>
              <th className="px-4 py-3 text-left">Pickup address</th>
              <th className="px-4 py-3 text-left">Products</th>
              <th className="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sellers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No sellers yet.
                </td>
              </tr>
            ) : (
              sellers.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3">{s.storeName}</td>
                  <td className="px-4 py-3 max-w-xs truncate">{s.pickupAddress || "—"}</td>
                  <td className="px-4 py-3">{s._count.products}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass[s.approvalStatus] || ""}`}>
                      {s.approvalStatus}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        To approve, reject, or review seller applications, use{" "}
        <Link href="/admin/requests" className="text-accent underline">
          Vendor Requests
        </Link>
        .
      </p>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Link
            href={`/admin/sellers?page=${page - 1}`}
            className={`rounded-md border border-border px-3 py-1.5 text-sm ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
          >
            Previous
          </Link>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Link
            href={`/admin/sellers?page=${page + 1}`}
            className={`rounded-md border border-border px-3 py-1.5 text-sm ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
          >
            Next
          </Link>
        </div>
      )}
    </div>
  );
}
