import { Product as DbProduct, ProductVariant as DbProductVariant, Category as DbCategory, SellerProfile as DbSellerProfile } from "@prisma/client";
import { Product as MockProduct } from "./mock-data";

export type DbProductWithRelations = DbProduct & {
  variants?: DbProductVariant[];
  seller?: DbSellerProfile | null;
  category?: DbCategory | null;
};

export function mapDbProductToMockProduct(dbProduct: DbProductWithRelations): MockProduct {
  const variants = dbProduct.variants || [];
  const firstVariant = variants[0];
  const price = firstVariant ? Number(firstVariant.sellingPrice) : 0;
  const mrp = firstVariant ? Number(firstVariant.mrp) : 0;

  const colors = Array.from(new Set(variants.map((v) => v.color).filter(Boolean))) as string[];
  const sizes = Array.from(new Set(variants.map((v) => v.size).filter(Boolean))) as string[];

  const tags: string[] = [];
  if (dbProduct.isFeatured) {
    tags.push("bestseller");
  }
  const isRecent = new Date().getTime() - new Date(dbProduct.createdAt).getTime() < 30 * 24 * 60 * 60 * 1000;
  if (isRecent) {
    tags.push("new");
  }
  if (dbProduct.tags && dbProduct.tags.length > 0) {
    tags.push(...dbProduct.tags);
  }

  return {
    id: dbProduct.id,
    name: dbProduct.name,
    brand: dbProduct.brand || "Atelier 21",
    store: dbProduct.seller?.storeName || "Unknown Store",
    storeLocation: dbProduct.seller?.pickupAddress || "",
    price,
    mrp,
    rating: dbProduct.rating || 0,
    reviews: dbProduct.reviewsCount || 0,
    image: dbProduct.images?.[0] || "",
    images: dbProduct.images || [],
    videoUrl: dbProduct.videoUrl || undefined,
    category: dbProduct.category?.slug || "",
    colors,
    sizes,
    isB2B: dbProduct.isB2BEnabled,
    moq: firstVariant?.moq || undefined,
    bulkPrice: firstVariant?.bulkPrice ? Number(firstVariant.bulkPrice) : undefined,
    tags,
    sellerProfileId: dbProduct.sellerId,
    variants: variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size,
      color: v.color,
      mrp: Number(v.mrp),
      sellingPrice: Number(v.sellingPrice),
      stock: v.stock,
      images: v.images,
    })),

    // Advanced fields (Phase 6)
    manufacturerName: dbProduct.manufacturerName || undefined,
    modelNumber: dbProduct.modelNumber || undefined,
    productCode: dbProduct.productCode || undefined,
    shortDescription: dbProduct.shortDescription || undefined,
    longDescription: dbProduct.longDescription || undefined,
    careInstructions: dbProduct.careInstructions || undefined,
    countryOfOrigin: dbProduct.countryOfOrigin || undefined,
    specifications: dbProduct.specifications || undefined,
    maxCapacity: dbProduct.maxCapacity || undefined,
    dispatchTime: dbProduct.dispatchTime || undefined,
    bulkPriceTiers: dbProduct.bulkPriceTiers || undefined,
    packagingDetails: dbProduct.packagingDetails || undefined,
    weight: dbProduct.weight || undefined,
    dimensions: dbProduct.dimensions || undefined,
    shippingClass: dbProduct.shippingClass || undefined,
    seoTitle: dbProduct.seoTitle || undefined,
    seoDescription: dbProduct.seoDescription || undefined,
    seoKeywords: dbProduct.seoKeywords || undefined,
    ogImage: dbProduct.ogImage || undefined,
    certifications: dbProduct.certifications || undefined,
    warrantyInfo: dbProduct.warrantyInfo || undefined,
    returnPolicy: dbProduct.returnPolicy || undefined,
    replacementPolicy: dbProduct.replacementPolicy || undefined,
  };
}
