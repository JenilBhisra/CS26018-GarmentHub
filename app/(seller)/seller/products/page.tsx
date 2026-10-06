import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SmartImage } from "@/components/site/smart-image";
import { deleteProduct } from "@/actions/products";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ensureKycApproved } from "@/actions/kyc";

export default async function SellerProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await ensureKycApproved();
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const pageSize = 10;

  let products = [];
  let totalProducts = 0;

  if (session.user.role === "ADMIN") {
    totalProducts = await prisma.product.count();
    products = await prisma.product.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: true,
        variants: true,
        seller: true,
      },
      orderBy: { createdAt: "desc" }
    });
  } else {
    const sellerProfile = await prisma.sellerProfile.findUnique({
      where: { userId: session.user.id }
    });
    if (!sellerProfile) {
      redirect("/seller/register");
    }
    totalProducts = await prisma.product.count({
      where: { sellerId: sellerProfile.id }
    });
    products = await prisma.product.findMany({
      where: { sellerId: sellerProfile.id },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: true,
        variants: true,
        seller: true,
      },
      orderBy: { createdAt: "desc" }
    });
  }

  const totalPages = Math.ceil(totalProducts / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">My Products</h1>
          <p className="text-sm text-muted-foreground">Manage your product catalog, pricing, and stock.</p>
        </div>
        <Link
          href="/seller/products/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Product
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left">Image</th>
              <th className="px-4 py-3 text-left">Title</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Price</th>
              <th className="px-4 py-3 text-left">Stock</th>
              <th className="px-4 py-3 text-left">SKU</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Created Date</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  No products found. Add your first product to get started!
                </td>
              </tr>
            ) : (
              products.map((p) => {
                const defaultVariant = p.variants?.[0];
                const totalStock = p.variants?.reduce((sum, v) => sum + v.stock, 0) || 0;
                const price = defaultVariant ? `₹${Number(defaultVariant.sellingPrice).toLocaleString("en-IN")}` : "N/A";
                const sku = defaultVariant ? defaultVariant.sku : "N/A";
                const createdDate = format(new Date(p.createdAt), "yyyy-MM-dd");

                let statusClass = "bg-stone-100 text-stone-700";
                if (p.status === "ACTIVE") statusClass = "bg-success/10 text-success";
                else if (p.status === "PENDING_REVIEW") statusClass = "bg-amber-100 text-amber-800";
                else if (p.status === "REJECTED") statusClass = "bg-red-100 text-red-800";
                else if (p.status === "DRAFT") statusClass = "bg-stone-200 text-stone-600";

                return (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="h-12 w-10 overflow-hidden rounded bg-stone-100 relative">
                        {p.images?.[0] ? (
                          <SmartImage src={p.images[0]} className="h-full w-full object-cover" alt="" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-stone-400 text-[10px]">No image</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium max-w-xs truncate">
                      {p.name}
                      {session.user.role === "ADMIN" && (
                        <div className="text-[10px] text-muted-foreground font-normal">
                          Store: {p.seller?.storeName || "Unknown"}
                        </div>
                      )}
                      {p.isB2BEnabled && (
                        <div className="mt-1">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.2 text-[9px] font-semibold border ${
                            p.isB2BApproved 
                              ? "bg-success/15 text-success border-success/20" 
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>
                            B2B: {p.isB2BApproved ? "Approved" : "Pending Approval"}
                          </span>
                        </div>
                      )}
                      {p.status === "REJECTED" && p.rejectionReason && (
                        <div className="text-[10px] text-red-600 font-normal mt-0.5">
                          Reason: {p.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{p.category?.name || "N/A"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{price}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={totalStock === 0 ? "text-destructive font-medium" : ""}>
                        {totalStock}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">{sku || "N/A"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium uppercase ${statusClass}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{createdDate}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/seller/products/${p.id}/edit`}
                          className="p-1 rounded text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Link>
                        <form
                          action={async () => {
                            "use server";
                            await deleteProduct(p.id);
                          }}
                          className="inline"
                        >
                          <button
                            type="submit"
                            className="p-1 rounded text-stone-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </form>
                      </div>
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
              href={`/seller/products?page=${page - 1}`}
              className={`relative inline-flex items-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
            >
              Previous
            </Link>
            <Link
              href={`/seller/products?page=${page + 1}`}
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
                  href={`/seller/products?page=${page - 1}`}
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
                      href={`/seller/products?page=${pNum}`}
                      aria-current={isCurrent ? "page" : undefined}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 ${isCurrent ? "z-10 bg-stone-900 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-600" : "text-stone-950 ring-1 ring-inset ring-border hover:bg-stone-50 focus:outline-offset-0"}`}
                    >
                      {pNum}
                    </Link>
                  );
                })}
                <Link
                  href={`/seller/products?page=${page + 1}`}
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
