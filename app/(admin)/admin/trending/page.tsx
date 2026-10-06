import { getTrendingCandidatesAdmin } from "@/actions/products";
import { TrendingClient } from "./trending-client";

export default async function Page() {
  const products = await getTrendingCandidatesAdmin();

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl">Trending sections</h1>
      <p className="text-sm text-muted-foreground">Pin products to homepage trending modules.</p>
      <TrendingClient
        products={products.map((p) => ({
          id: p.id,
          name: p.name,
          image: p.images[0] ?? null,
          isFeatured: p.isFeatured,
        }))}
      />
    </div>
  );
}
