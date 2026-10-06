import { prisma } from "@/lib/prisma";
import ProductForm from "../product-form";
import { ensureKycApproved } from "@/actions/kyc";

export default async function NewProductPage() {
  await ensureKycApproved();

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Add New Product</h1>
        <p className="text-sm text-muted-foreground">List a new garment on the marketplace catalog.</p>
      </div>
      <ProductForm categories={categories} />
    </div>
  );
}
