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

  const [totalCustomers, customers] = await Promise.all([
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.user.findMany({
      where: { role: "CUSTOMER" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalPages = Math.ceil(totalCustomers / pageSize) || 1;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl">Customers</h1>
        <p className="text-sm text-muted-foreground">{totalCustomers} registered customers</p>
      </div>
      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Phone</th>
              <th className="px-4 py-3 text-left">Orders</th>
              <th className="px-4 py-3 text-left">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No customers yet.
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">{c.name}</td>
                  <td className="px-4 py-3">{c.email}</td>
                  <td className="px-4 py-3">{c.phone || "—"}</td>
                  <td className="px-4 py-3">{c._count.orders}</td>
                  <td className="px-4 py-3">{c.createdAt.toLocaleDateString("en-IN")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Link
            href={`/admin/customers?page=${page - 1}`}
            className={`rounded-md border border-border px-3 py-1.5 text-sm ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
          >
            Previous
          </Link>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Link
            href={`/admin/customers?page=${page + 1}`}
            className={`rounded-md border border-border px-3 py-1.5 text-sm ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
          >
            Next
          </Link>
        </div>
      )}
    </div>
  );
}
