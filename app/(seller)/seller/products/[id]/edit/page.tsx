import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import ProductForm from "../../product-form";
import { ensureKycApproved } from "@/actions/kyc";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await ensureKycApproved();
  const { id } = await params;
  
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const product = await prisma.product.findUnique({
    where: { id },
    include: { variants: true }
  });

  if (!product) {
    notFound();
  }

  // Ownership Protection Check
  if (session.user.role === "SELLER") {
    const sellerProfile = await prisma.sellerProfile.findUnique({
      where: { userId: session.user.id }
    });
    if (!sellerProfile || product.sellerId !== sellerProfile.id) {
      redirect("/unauthorized");
    }
  }

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" }
  });

  const defaultVariant = product.variants[0];
  const initialData = {
    id: product.id,
    name: product.name,
    description: product.description || "",
    categoryId: product.categoryId,
    price: defaultVariant ? Number(defaultVariant.sellingPrice) : 0,
    stock: defaultVariant ? defaultVariant.stock : 0,
    sku: defaultVariant?.sku || "",
    images: product.images,
    videoUrl: product.videoUrl || undefined,
    status: product.status,
    isB2BEnabled: product.isB2BEnabled,
    rejectionReason: product.rejectionReason,
    variants: product.variants.map((v) => ({
      id: v.id,
      sku: v.sku || undefined,
      sellingPrice: Number(v.sellingPrice),
      stock: v.stock,
      size: v.size || undefined,
      color: v.color || undefined,
      images: v.images || [],
      moq: v.moq || undefined,
    })),

    // Advanced fields
    brand: product.brand || "",
    tags: product.tags,
    manufacturerName: product.manufacturerName || "",
    modelNumber: product.modelNumber || "",
    productCode: product.productCode || "",
    shortDescription: product.shortDescription || "",
    longDescription: product.longDescription || "",
    careInstructions: product.careInstructions || "",
    countryOfOrigin: product.countryOfOrigin || "",
    specifications: product.specifications,
    maxCapacity: product.maxCapacity || "",
    dispatchTime: product.dispatchTime || "",
    bulkPriceTiers: product.bulkPriceTiers,
    packagingDetails: product.packagingDetails || "",
    weight: product.weight !== null ? product.weight : undefined,
    dimensions: product.dimensions || "",
    shippingClass: product.shippingClass || "",
    seoTitle: product.seoTitle || "",
    seoDescription: product.seoDescription || "",
    seoKeywords: product.seoKeywords,
    ogImage: product.ogImage || "",
    certifications: product.certifications,
    warrantyInfo: product.warrantyInfo || "",
    returnPolicy: product.returnPolicy || "",
    replacementPolicy: product.replacementPolicy || "",
    slug: product.slug || "",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Edit Product</h1>
        <p className="text-sm text-muted-foreground">Modify product details, inventory, and status.</p>
      </div>
      <ProductForm categories={categories} initialData={initialData} />
    </div>
  );
}
