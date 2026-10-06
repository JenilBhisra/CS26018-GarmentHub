import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SmartImage } from "@/components/site/smart-image";
import { moderateProduct, moderateB2BProduct } from "@/actions/products";
import { Check, X } from "lucide-react";

export default async function AdminProductsPage({
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
  const pageSize = 10;

  const totalProducts = await prisma.product.count();
  const products = await prisma.product.findMany({
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      category: true,
      variants: true,
      seller: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const totalPages = Math.ceil(totalProducts / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Products Moderation</h1>
        <p className="text-sm text-muted-foreground">Approve new listings or manage existing products on the marketplace.</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3 text-left">Store</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Price</th>
              <th className="px-4 py-3 text-left">Stock</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">B2B Status</th>
              <th className="px-4 py-3 text-left">Moderation Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No products found in the database.
                </td>
              </tr>
            ) : (
              products.map((p) => {
                const defaultVariant = p.variants?.[0];
                const totalStock = p.variants?.reduce((sum, v) => sum + v.stock, 0) || 0;
                const price = defaultVariant ? `₹${Number(defaultVariant.sellingPrice).toLocaleString("en-IN")}` : "N/A";
                
                let statusClass = "bg-stone-100 text-stone-700";
                if (p.status === "ACTIVE") statusClass = "bg-success/10 text-success";
                else if (p.status === "PENDING_REVIEW") statusClass = "bg-amber-100 text-amber-800";
                else if (p.status === "REJECTED") statusClass = "bg-red-100 text-red-800";
                else if (p.status === "DRAFT") statusClass = "bg-stone-200 text-stone-600";

                return (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-10 overflow-hidden rounded bg-stone-100 relative shrink-0">
                          {p.images?.[0] ? (
                            <SmartImage src={p.images[0]} className="h-full w-full object-cover" alt="" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-stone-400 text-[10px]">No image</div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-stone-900">{p.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">ID: {p.id}</div>
                          {p.status === "REJECTED" && p.rejectionReason && (
                            <div className="text-[10px] text-red-600 font-normal mt-0.5 max-w-xs">
                              Reason: {p.rejectionReason}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-stone-700">{p.seller?.storeName || "Unknown Store"}</div>
                      <div className="text-[10px] text-muted-foreground">{p.seller?.pickupAddress || ""}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{p.category?.name || "N/A"}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-stone-900">{price}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-stone-600">{totalStock} units</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium uppercase ${statusClass}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {!p.isB2BEnabled ? (
                        <span className="text-xs text-stone-400">Disabled</span>
                      ) : p.isB2BApproved ? (
                        <div className="flex flex-col gap-1 items-start">
                          <span className="inline-flex rounded-full bg-success/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-success">
                            Approved
                          </span>
                          <form
                            action={async () => {
                              "use server";
                              await moderateB2BProduct(p.id, false);
                            }}
                          >
                            <button
                              type="submit"
                              className="text-[10px] text-red-600 hover:text-red-700 font-medium hover:underline mt-1"
                            >
                              Revoke Approval
                            </button>
                          </form>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1 items-start">
                          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-amber-850">
                            Requested
                          </span>
                          <form
                            action={async () => {
                              "use server";
                              await moderateB2BProduct(p.id, true);
                            }}
                          >
                            <button
                              type="submit"
                              className="inline-flex items-center gap-0.5 bg-amber-600 text-white text-[10px] font-semibold px-2 py-1 rounded hover:bg-amber-500 transition-colors mt-1"
                            >
                              <Check className="h-2.5 w-2.5" /> Approve B2B
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {p.status === "PENDING_REVIEW" ? (
                        <div className="flex items-center gap-3">
                          <form
                            action={async () => {
                              "use server";
                              await moderateProduct(p.id, "APPROVE");
                            }}
                          >
                            <button
                              type="submit"
                              className="inline-flex items-center gap-1 bg-emerald-600 text-white text-xs font-medium px-2.5 py-1.5 rounded hover:bg-emerald-500 transition-colors"
                            >
                              <Check className="h-3 w-3" /> Approve
                            </button>
                          </form>
                          
                          <form
                            action={async (formData: FormData) => {
                              "use server";
                              const reason = formData.get("reason") as string;
                              await moderateProduct(p.id, "REJECT", reason);
                            }}
                            className="flex items-center gap-2"
                          >
                            <input
                              name="reason"
                              placeholder="Rejection reason..."
                              className="h-8 border border-input rounded px-2 text-xs focus:outline-none focus:border-stone-950 max-w-[150px]"
                              required
                            />
                            <button
                              type="submit"
                              className="inline-flex items-center gap-1 bg-red-600 text-white text-xs font-medium px-2.5 py-1.5 rounded hover:bg-red-500 transition-colors"
                            >
                              <X className="h-3 w-3" /> Reject
                            </button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">None required</span>
                      )}
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
        <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-card sm:px-6 rounded-lg mt-4 shadow-sm">
          <div className="flex flex-1 justify-between sm:hidden">
            <Link
              href={`/admin/products?page=${page - 1}`}
              className={`relative inline-flex items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
            >
              Previous
            </Link>
            <Link
              href={`/admin/products?page=${page + 1}`}
              className={`relative ml-3 inline-flex items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
            >
              Next
            </Link>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-stone-700">
                Showing <span className="font-medium">{(page - 1) * pageSize + 1}</span> to <span className="font-medium">{Math.min(page * pageSize, totalProducts)}</span> of{" "}
                <span className="font-medium">{totalProducts}</span> results
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm bg-white" aria-label="Pagination">
                <Link
                  href={`/admin/products?page=${page - 1}`}
                  className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-stone-400 ring-1 ring-inset ring-border hover:bg-stone-50 focus:z-20 focus:outline-offset-0 ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
                >
                  <span className="sr-only">Previous</span>
                  &larr;
                </Link>
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  const isCurrent = pNum === page;
                  return (
                    <Link
                      key={pNum}
                      href={`/admin/products?page=${pNum}`}
                      aria-current={isCurrent ? "page" : undefined}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 ${isCurrent ? "z-10 bg-stone-900 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-600" : "text-stone-950 ring-1 ring-inset ring-border hover:bg-stone-50 focus:outline-offset-0"}`}
                    >
                      {pNum}
                    </Link>
                  );
                })}
                <Link
                  href={`/admin/products?page=${page + 1}`}
                  className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-stone-400 ring-1 ring-inset ring-border hover:bg-stone-50 focus:z-20 focus:outline-offset-0 ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
                >
                  <span className="sr-only">Next</span>
                  &rarr;
                </Link>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
