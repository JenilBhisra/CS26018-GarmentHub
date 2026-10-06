import { prisma } from "@/lib/prisma";
import { mapDbProductToMockProduct } from "@/lib/db-mappers";
import { CustomerLayout } from "@/components/site/layout";
import { ProductCard } from "@/components/site/product-card";
import { trackPageView, trackSearch } from "@/actions/analytics";
import { rateLimit } from "@/lib/rate-limit";
import Link from "next/link";
import { Inbox, AlertTriangle } from "lucide-react";

export const metadata = {
  title: "Search Results — GarmentHub",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() || "";

  // Rate Limiting Search
  const limit = await rateLimit("search");
  if (!limit.success) {
    return (
      <CustomerLayout>
        <div className="container-page py-20 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-650 mx-auto">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-red-650">Too Many Search Requests</h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            You are searching too frequently. Please slow down and try again in a minute.
          </p>
        </div>
      </CustomerLayout>
    );
  }

  // 1. Fetch matching active products
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dbProducts: any[] = [];
  if (query) {
    dbProducts = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { brand: { contains: query, mode: "insensitive" } },
          { description: { contains: query, mode: "insensitive" } },
          { tags: { has: query } },
          { category: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      include: {
        category: true,
        variants: true,
        seller: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // 2. Track search analytics & page view
  await trackPageView("SEARCH_PAGE");
  if (query) {
    await trackSearch(query, dbProducts.length === 0);
  }

  const products = dbProducts.map(mapDbProductToMockProduct);

  return (
    <CustomerLayout>
      <div className="container-page py-10 space-y-6">
        <div>
          <h1 className="font-display text-3xl">Search Results</h1>
          {query ? (
            <p className="text-sm text-muted-foreground mt-1">
              Showing results for &ldquo;<strong className="text-foreground font-semibold">{query}</strong>&rdquo;
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">
              Please enter a keyword in the search bar above.
            </p>
          )}
        </div>

        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <Inbox className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-md">No Products Found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                We couldn&apos;t find any items matching your search. Try adjusting your spelling or using more general terms.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-stone-900 hover:bg-stone-850 text-white text-xs font-semibold transition-colors"
            >
              Browse Homepage
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
