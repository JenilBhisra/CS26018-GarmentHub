import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { mapDbProductToMockProduct } from "@/lib/db-mappers";
import { auth } from "@/auth";
import ProductDetailClient from "./product-detail-client";
import { trackPageView } from "@/actions/analytics";
import { unstable_cache } from "next/cache";

export const metadata = {
  title: "Product Details — GarmentHub",
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

const getCachedProduct = unstable_cache(
  async (id: string) => {
    return prisma.product.findUnique({
      where: { id },
      include: {
        variants: true,
        seller: true,
        category: true,
      }
    });
  },
  ["product-detail-lookup"],
  { revalidate: 60, tags: ["products"] }
);

const getCachedReviews = unstable_cache(
  async (productId: string) => {
    return prisma.review.findMany({
      where: { productId, isHidden: false },
      include: {
        images: true,
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },
  ["product-reviews-lookup"],
  { revalidate: 60, tags: ["reviews"] }
);

const getCachedQuestions = unstable_cache(
  async (productId: string) => {
    return prisma.productQuestion.findMany({
      where: { productId, isHidden: false },
      include: {
        user: { select: { name: true } },
        answers: {
          include: {
            seller: {
              select: {
                storeName: true,
                userId: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  },
  ["product-questions-lookup"],
  { revalidate: 60, tags: ["questions"] }
);

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await trackPageView("PRODUCT_PAGE", id);
  const session = await auth();
  const sessionUser = session?.user ?? null;

  const dbProduct = await getCachedProduct(id);

  if (!dbProduct || dbProduct.status !== "ACTIVE") {
    notFound();
  }

  const product = mapDbProductToMockProduct(dbProduct);

  // Parallel fetch for non-user-specific reviews, questions, similar & recommended products
  const [reviews, questions, similarDb, recommendedDb] = await Promise.all([
    getCachedReviews(id),
    getCachedQuestions(id),
    prisma.product.findMany({
      where: {
        status: "ACTIVE",
        categoryId: dbProduct.categoryId,
        id: { not: id },
      },
      take: 4,
      select: productSelect,
      orderBy: { createdAt: "desc" }
    }),
    prisma.product.findMany({
      where: {
        status: "ACTIVE",
        id: { not: id },
      },
      take: 4,
      select: productSelect,
      orderBy: { rating: "desc" }
    })
  ]);

  const similar = similarDb.map((p) => mapDbProductToMockProduct(p as any));
  const recommended = recommendedDb.map((p) => mapDbProductToMockProduct(p as any));

  // User-specific states (wishlist, order reviews, and existing reviews)
  let isWishlisted = false;
  let unreviewedOrderItemId: string | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let userReviews: any[] = [];

  if (sessionUser) {
    const [wish, orderItems, existingReviews] = await Promise.all([
      prisma.wishlist.findUnique({
        where: {
          userId_productId: {
            userId: sessionUser.id,
            productId: id,
          },
        },
      }),
      prisma.orderItem.findMany({
        where: {
          order: {
            userId: sessionUser.id,
            status: { notIn: ["CANCELLED"] },
          },
          variant: {
            productId: id,
          },
        },
        include: {
          review: true,
        },
      }),
      prisma.review.findMany({
        where: {
          productId: id,
          userId: sessionUser.id,
        },
        include: {
          images: true,
        },
      })
    ]);

    isWishlisted = !!wish;
    const unreviewed = orderItems.find((oi) => !oi.review);
    if (unreviewed) {
      unreviewedOrderItemId = unreviewed.id;
    }
    userReviews = existingReviews;
  }

  return (
    <ProductDetailClient
      product={product}
      similar={similar}
      recommended={recommended}
      initialReviews={JSON.parse(JSON.stringify(reviews))}
      initialQuestions={JSON.parse(JSON.stringify(questions))}
      isWishlisted={isWishlisted}
      unreviewedOrderItemId={unreviewedOrderItemId}
      userReviews={JSON.parse(JSON.stringify(userReviews))}
      sessionUser={sessionUser ? { id: sessionUser.id, role: sessionUser.role, name: sessionUser.name } : null}
    />
  );
}

