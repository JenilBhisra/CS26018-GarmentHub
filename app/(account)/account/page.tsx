import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function Page() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const [user, ordersCount, wishlistCount, recentOrders] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } }),
    prisma.order.count({ where: { userId: session.user.id } }),
    prisma.wishlist.count({ where: { userId: session.user.id } }),
    prisma.order.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, orderNumber: true, status: true, updatedAt: true },
    }),
  ]);

  const firstName = (user?.name || "there").split(" ")[0];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Hi, {firstName}</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Orders</div>
          <div className="mt-1 font-display text-2xl">{ordersCount}</div>
        </div>
        <div className="rounded-md border border-border p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Wishlist</div>
          <div className="mt-1 font-display text-2xl">{wishlistCount}</div>
        </div>
      </div>
      <section className="rounded-md border border-border">
        <div className="border-b border-border p-4 font-medium">Recent orders</div>
        {recentOrders.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No orders yet.{" "}
            <Link href="/" className="text-accent underline">
              Start shopping
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {recentOrders.map((o) => (
              <li key={o.id} className="flex items-center justify-between p-4">
                <span>Order #{o.orderNumber}</span>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{o.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
