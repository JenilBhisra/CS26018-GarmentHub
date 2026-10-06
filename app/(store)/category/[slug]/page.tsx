import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { mapDbProductToMockProduct } from "@/lib/db-mappers";
import CategoryClient from "./category-client";
import { trackPageView } from "@/actions/analytics";
import { unstable_cache } from "next/cache";

export const metadata = {
  title: "Category — GarmentHub",
};

const productSelect = {
  id: true,
  name: true,
  brand: true,
  rating: true,
  reviewsCount: true,
  images: true,
  videoUrl: true,
  isB2BEnabled: true,
  isFeatured: true,
  createdAt: true,
  tags: true,
  sellerId: true,
  manufacturerName: true,
  modelNumber: true,
  productCode: true,
  shortDescription: true,
  longDescription: true,
  careInstructions: true,
  countryOfOrigin: true,
  specifications: true,
  maxCapacity: true,
  dispatchTime: true,
  bulkPriceTiers: true,
  packagingDetails: true,
  weight: true,
  dimensions: true,
  shippingClass: true,
  seoTitle: true,
  seoDescription: true,
  seoKeywords: true,
  ogImage: true,
  certifications: true,
  warrantyInfo: true,
  returnPolicy: true,
  replacementPolicy: true,
  category: {
    select: {
      slug: true,
    }
  },
  seller: {
    select: {
      storeName: true,
      pickupAddress: true,
    }
  },
  variants: {
    select: {
      id: true,
      sku: true,
      size: true,
      color: true,
      mrp: true,
      sellingPrice: true,
      stock: true,
      images: true,
      moq: true,
      bulkPrice: true,
    }
  }
};

const getCachedCategory = unstable_cache(
  async (slug: string) => {
    return prisma.category.findUnique({
      where: { slug }
    });
  },
  ["category-lookup"],
  { revalidate: 60, tags: ["categories"] }
);

const getCachedCategoryProducts = unstable_cache(
  async (categoryId: string) => {
    const dbProducts = await prisma.product.findMany({
      where: {
        categoryId,
        status: "ACTIVE",
      },
      select: productSelect,
      orderBy: { createdAt: "desc" }
    });
    return dbProducts.map((p) => mapDbProductToMockProduct(p as any));
  },
  ["category-products"],
  { revalidate: 60, tags: ["products"] }
);

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await trackPageView("CATEGORY_PAGE");

  const dbCategory = await getCachedCategory(slug);

  if (!dbCategory) {
    notFound();
  }

  const products = await getCachedCategoryProducts(dbCategory.id);

  return (
    <CategoryClient
      category={{ slug: dbCategory.slug, label: dbCategory.name }}
      initialProducts={products}
    />
  );
}

