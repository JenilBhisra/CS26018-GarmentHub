import { getCategoriesAdmin } from "@/actions/products";
import { CategoriesClient } from "./categories-client";

export default async function Page() {
  const categories = await getCategoriesAdmin();

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl">Categories</h1>
      <CategoriesClient
        initialCategories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          image: c.image,
          productCount: c._count.products,
        }))}
      />
    </div>
  );
}
