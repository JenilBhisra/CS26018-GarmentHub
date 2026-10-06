"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { ProductStatus, NotificationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import fs from "fs/promises";
import path from "path";
import { sendInAppNotification } from "@/actions/notifications";
import { sendNotificationEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { createAuditLog } from "@/actions/audit";

// Helper function to save a file locally in public/uploads
async function saveUploadedFile(file: File): Promise<string> {
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });

  const fileExtension = path.extname(file.name);
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}${fileExtension}`;
  const filePath = path.join(uploadDir, fileName);

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buffer);

  return `/uploads/${fileName}`;
}

export async function createProduct(formData: FormData) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "SELLER" && session.user.role !== "ADMIN")) {
    return { success: false, error: "Unauthorized" };
  }

  const limit = await rateLimit("product_create", session.user.id);
  if (!limit.success) {
    return { success: false, error: "Too many product creation attempts. Please try again in an hour." };
  }

  let sellerId: string;
  if (session.user.role === "ADMIN") {
    const profile = await prisma.sellerProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true }
    });
    if (profile) {
      sellerId = profile.id;
    } else {
      const firstProfile = await prisma.sellerProfile.findFirst({
        where: { approvalStatus: "APPROVED" },
        select: { id: true }
      });
      if (!firstProfile) {
        return { success: false, error: "No seller profile exists in the system to assign this product to." };
      }
      sellerId = firstProfile.id;
    }
  } else {
    const profile = await prisma.sellerProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true }
    });
    if (!profile) {
      return { success: false, error: "Seller profile not found." };
    }
    sellerId = profile.id;
  }

  // Text inputs
  const name = (formData.get("name") as string) || "";
  const brand = (formData.get("brand") as string) || "Atelier 21";
  const description = (formData.get("description") as string) || "";
  const categoryId = (formData.get("categoryId") as string) || "";
  const status = (formData.get("status") as ProductStatus) || "DRAFT";
  const isB2BEnabled = formData.get("isB2BEnabled") === "true" || formData.get("isB2BEnabled") === "on";

  // Advanced listings properties (Phase 6)
  const manufacturerName = formData.get("manufacturerName") as string | null;
  const modelNumber = formData.get("modelNumber") as string | null;
  const productCode = formData.get("productCode") as string | null;
  const shortDescription = formData.get("shortDescription") as string | null;
  const longDescription = formData.get("longDescription") as string | null;
  const careInstructions = formData.get("careInstructions") as string | null;
  const countryOfOrigin = formData.get("countryOfOrigin") as string | null;

  const maxCapacity = formData.get("maxCapacity") as string | null;
  const dispatchTime = formData.get("dispatchTime") as string | null;
  const packagingDetails = formData.get("packagingDetails") as string | null;

  const weightVal = formData.get("weight") as string | null;
  const weight = weightVal ? parseFloat(weightVal) : null;
  const dimensions = formData.get("dimensions") as string | null;
  const shippingClass = formData.get("shippingClass") as string | null;

  const seoTitle = formData.get("seoTitle") as string | null;
  const seoDescription = formData.get("seoDescription") as string | null;
  const ogImage = formData.get("ogImage") as string | null;

  const warrantyInfo = formData.get("warrantyInfo") as string | null;
  const returnPolicy = formData.get("returnPolicy") as string | null;
  const replacementPolicy = formData.get("replacementPolicy") as string | null;

  // Parse arrays
  const tags = (formData.getAll("tags") as string[]).map(t => t.trim()).filter(Boolean);
  const seoKeywords = (formData.getAll("seoKeywords") as string[]).map(k => k.trim()).filter(Boolean);
  const certifications = (formData.getAll("certifications") as string[]).map(c => c.trim()).filter(Boolean);

  // JSON objects
  const specificationsJson = formData.get("specifications") as string | null;
  const specifications = specificationsJson ? JSON.parse(specificationsJson) : null;

  const bulkPriceTiersJson = formData.get("bulkPriceTiers") as string | null;
  const bulkPriceTiers = bulkPriceTiersJson ? JSON.parse(bulkPriceTiersJson) : null;

  // Validation
  if (!name.trim()) return { success: false, error: "Title is required" };
  if (!categoryId) return { success: false, error: "Category is required" };

  // Parse custom slug or auto-generate
  const customSlug = formData.get("slug") as string | null;
  let slug = customSlug?.trim() || "";
  if (!slug) {
    slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now();
  } else {
    slug = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  }

  // Slug unique check
  const existingSlug = await prisma.product.findUnique({
    where: { slug }
  });
  if (existingSlug) {
    return { success: false, error: `Slug "${slug}" is already in use by another product. Slugs must be unique.` };
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId }
  });
  if (!category) {
    return { success: false, error: "Category not found." };
  }

  // Parse variants
  const variantsJson = formData.get("variants") as string | null;
  const variants = variantsJson ? JSON.parse(variantsJson) : [];
  if (!variants || variants.length === 0) {
    return { success: false, error: "At least one product variant is required." };
  }

  // Validate variants
  const skuSet = new Set<string>();
  for (const v of variants) {
    if (!v.sku || !v.sku.trim()) {
      return { success: false, error: "All variants must have a SKU." };
    }
    if (v.price < 0) {
      return { success: false, error: "Variant price cannot be negative." };
    }
    if (v.stock < 0) {
      return { success: false, error: "Variant stock quantity cannot be negative." };
    }
    if (skuSet.has(v.sku)) {
      return { success: false, error: `Duplicate SKU "${v.sku}" specified in variants list.` };
    }
    skuSet.add(v.sku);

    const existingSku = await prisma.productVariant.findUnique({
      where: { sku: v.sku }
    });
    if (existingSku) {
      return { success: false, error: `SKU "${v.sku}" is already in use by another product variant.` };
    }
  }

  // Handle media file uploads
  const imageFiles = formData.getAll("imageFiles") as File[];
  const videoFile = formData.get("videoFile") as File | null;

  const uploadedImages: string[] = [];
  try {
    for (const file of imageFiles) {
      if (file && file.size > 0 && file.name !== "undefined") {
        const url = await saveUploadedFile(file);
        uploadedImages.push(url);
      }
    }
  } catch (err) {
    console.error("Error saving image files:", err);
    return { success: false, error: "Failed to save uploaded image files." };
  }

  let uploadedVideoUrl: string | null = null;
  try {
    if (videoFile && videoFile.size > 0 && videoFile.name !== "undefined") {
      uploadedVideoUrl = await saveUploadedFile(videoFile);
    }
  } catch (err) {
    console.error("Error saving video file:", err);
    return { success: false, error: "Failed to save uploaded video file." };
  }

  // If a seller creates a product, it must go through review (demote ACTIVE/REJECTED to PENDING_REVIEW)
  let initialStatus = status;
  if (session.user.role === "SELLER") {
    if (initialStatus === "ACTIVE" || initialStatus === "REJECTED") {
      initialStatus = "PENDING_REVIEW";
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          sellerId,
          categoryId,
          name,
          slug,
          brand,
          description,
          images: uploadedImages,
          status: initialStatus,
          isB2BEnabled,
          isB2BApproved: false,
          createdById: session.user.id,
          videoUrl: uploadedVideoUrl,
          manufacturerName,
          modelNumber,
          productCode,
          tags,
          shortDescription,
          longDescription,
          careInstructions,
          countryOfOrigin,
          specifications: specifications || undefined,
          maxCapacity,
          dispatchTime,
          bulkPriceTiers: bulkPriceTiers || undefined,
          packagingDetails,
          weight,
          dimensions,
          shippingClass,
          seoTitle,
          seoDescription,
          seoKeywords,
          ogImage,
          certifications,
          warrantyInfo,
          returnPolicy,
          replacementPolicy,
        }
      });

      // Map variant images: any temporary indexes or placeholders should be mapped to the actual uploaded URL
      for (const v of variants) {
        // If v.images has temporary local indices, resolve them against uploadedImages
        const resolvedImages: string[] = [];
        if (v.images && v.images.length > 0) {
          v.images.forEach((imgKey: string) => {
            if (imgKey.startsWith("new-file-")) {
              const fileIndex = parseInt(imgKey.replace("new-file-", ""), 10);
              if (uploadedImages[fileIndex]) {
                resolvedImages.push(uploadedImages[fileIndex]);
              }
            } else {
              resolvedImages.push(imgKey);
            }
          });
        }

        await tx.productVariant.create({
          data: {
            productId: product.id,
            sku: v.sku,
            size: v.size || null,
            color: v.color || null,
            mrp: v.price,
            sellingPrice: v.price,
            stock: v.stock,
            images: resolvedImages,
          }
        });
      }

      return { product };
    });

    revalidatePath("/seller/products");
    revalidatePath("/admin/products");
    revalidatePath("/");

    await createAuditLog("CREATE_PRODUCT", "Product", result.product.id, null, { name, brand, isB2BEnabled, variantsCount: variants.length });

    return { success: true, productId: result.product.id };
  } catch (error: unknown) {
    console.error("createProduct error:", error);
    const message = error instanceof Error ? error.message : "Failed to create product";
    return { success: false, error: message };
  }
}

export async function updateProduct(id: string, formData: FormData) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "SELLER" && session.user.role !== "ADMIN")) {
    return { success: false, error: "Unauthorized" };
  }

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      videoUrl: true,
      isB2BApproved: true,
      sellerId: true,
      name: true,
      status: true
    }
  });

  if (!product) {
    return { success: false, error: "Product not found" };
  }

  // Ownership Check
  if (session.user.role === "SELLER") {
    const profile = await prisma.sellerProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true }
    });
    if (!profile || product.sellerId !== profile.id) {
      return { success: false, error: "Forbidden: You do not own this product." };
    }
  }

  // Text inputs
  const name = (formData.get("name") as string) || "";
  const brand = (formData.get("brand") as string) || "Atelier 21";
  const description = (formData.get("description") as string) || "";
  const categoryId = (formData.get("categoryId") as string) || "";
  const status = (formData.get("status") as ProductStatus) || "DRAFT";
  const isB2BEnabled = formData.get("isB2BEnabled") === "true" || formData.get("isB2BEnabled") === "on";
  let isB2BApproved = product.isB2BApproved;
  if (session.user.role === "SELLER") {
    isB2BApproved = false;
  } else if (session.user.role === "ADMIN") {
    const adminApprovedVal = formData.get("isB2BApproved");
    if (adminApprovedVal !== null) {
      isB2BApproved = adminApprovedVal === "true" || adminApprovedVal === "on";
    }
  }

  // Advanced listings properties (Phase 6)
  const manufacturerName = formData.get("manufacturerName") as string | null;
  const modelNumber = formData.get("modelNumber") as string | null;
  const productCode = formData.get("productCode") as string | null;
  const shortDescription = formData.get("shortDescription") as string | null;
  const longDescription = formData.get("longDescription") as string | null;
  const careInstructions = formData.get("careInstructions") as string | null;
  const countryOfOrigin = formData.get("countryOfOrigin") as string | null;

  const maxCapacity = formData.get("maxCapacity") as string | null;
  const dispatchTime = formData.get("dispatchTime") as string | null;
  const packagingDetails = formData.get("packagingDetails") as string | null;

  const weightVal = formData.get("weight") as string | null;
  const weight = weightVal ? parseFloat(weightVal) : null;
  const dimensions = formData.get("dimensions") as string | null;
  const shippingClass = formData.get("shippingClass") as string | null;

  const seoTitle = formData.get("seoTitle") as string | null;
  const seoDescription = formData.get("seoDescription") as string | null;
  const ogImage = formData.get("ogImage") as string | null;

  const warrantyInfo = formData.get("warrantyInfo") as string | null;
  const returnPolicy = formData.get("returnPolicy") as string | null;
  const replacementPolicy = formData.get("replacementPolicy") as string | null;

  // Parse arrays
  const tags = (formData.getAll("tags") as string[]).map(t => t.trim()).filter(Boolean);
  const seoKeywords = (formData.getAll("seoKeywords") as string[]).map(k => k.trim()).filter(Boolean);
  const certifications = (formData.getAll("certifications") as string[]).map(c => c.trim()).filter(Boolean);

  // JSON objects
  const specificationsJson = formData.get("specifications") as string | null;
  const specifications = specificationsJson ? JSON.parse(specificationsJson) : null;

  const bulkPriceTiersJson = formData.get("bulkPriceTiers") as string | null;
  const bulkPriceTiers = bulkPriceTiersJson ? JSON.parse(bulkPriceTiersJson) : null;

  // Validation
  if (!name.trim()) return { success: false, error: "Title is required" };
  if (!categoryId) return { success: false, error: "Category is required" };

  // Parse custom slug or auto-generate
  const customSlug = formData.get("slug") as string | null;
  let slug = customSlug?.trim() || "";
  if (!slug) {
    slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  } else {
    slug = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  }

  // Slug unique check (excluding current product)
  const existingSlug = await prisma.product.findFirst({
    where: {
      slug,
      id: { not: id }
    }
  });
  if (existingSlug) {
    return { success: false, error: `Slug "${slug}" is already in use by another product. Slugs must be unique.` };
  }

  // Parse variants
  const variantsJson = formData.get("variants") as string | null;
  const variants = variantsJson ? JSON.parse(variantsJson) : [];
  if (!variants || variants.length === 0) {
    return { success: false, error: "At least one product variant is required." };
  }

  // Validate variants
  const skuSet = new Set<string>();
  for (const v of variants) {
    if (!v.sku || !v.sku.trim()) {
      return { success: false, error: "All variants must have a SKU." };
    }
    if (v.price < 0) {
      return { success: false, error: "Variant price cannot be negative." };
    }
    if (v.stock < 0) {
      return { success: false, error: "Variant stock quantity cannot be negative." };
    }
    if (skuSet.has(v.sku)) {
      return { success: false, error: `Duplicate SKU "${v.sku}" specified in variants list.` };
    }
    skuSet.add(v.sku);

    const existingSku = await prisma.productVariant.findFirst({
      where: {
        sku: v.sku,
        productId: { not: id }
      }
    });
    if (existingSku) {
      return { success: false, error: `SKU "${v.sku}" is already in use by another product variant.` };
    }
  }

  // Parse existing media and new media files
  const existingImages = formData.getAll("existingImages") as string[];
  const imageFiles = formData.getAll("imageFiles") as File[];
  const videoFile = formData.get("videoFile") as File | null;
  const keepExistingVideo = formData.get("keepExistingVideo") === "true";

  const finalImages: string[] = [...existingImages];

  try {
    for (const file of imageFiles) {
      if (file && file.size > 0 && file.name !== "undefined") {
        const url = await saveUploadedFile(file);
        finalImages.push(url);
      }
    }
  } catch (err) {
    console.error("Error saving updated images:", err);
    return { success: false, error: "Failed to save uploaded image files." };
  }

  let finalVideoUrl: string | null = keepExistingVideo ? product.videoUrl : null;
  try {
    if (videoFile && videoFile.size > 0 && videoFile.name !== "undefined") {
      finalVideoUrl = await saveUploadedFile(videoFile);
    }
  } catch (err) {
    console.error("Error saving updated video:", err);
    return { success: false, error: "Failed to save uploaded video file." };
  }

  // If a seller updates status, it must go through review (demote ACTIVE/REJECTED to PENDING_REVIEW)
  let targetStatus = status;
  if (session.user.role === "SELLER") {
    if (targetStatus === "ACTIVE" || targetStatus === "REJECTED") {
      targetStatus = "PENDING_REVIEW";
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          categoryId,
          name,
          slug,
          brand,
          description,
          images: finalImages,
          status: targetStatus,
          isB2BEnabled,
          isB2BApproved,
          videoUrl: finalVideoUrl,
          manufacturerName,
          modelNumber,
          productCode,
          tags,
          shortDescription,
          longDescription,
          careInstructions,
          countryOfOrigin,
          specifications: specifications || undefined,
          maxCapacity,
          dispatchTime,
          bulkPriceTiers: bulkPriceTiers || undefined,
          packagingDetails,
          weight,
          dimensions,
          shippingClass,
          seoTitle,
          seoDescription,
          seoKeywords,
          ogImage,
          certifications,
          warrantyInfo,
          returnPolicy,
          replacementPolicy,
        }
      });

      // Synchronize variants
      const submittedVariantIds = variants.map((v: { id?: string }) => v.id).filter(Boolean);

      // 1. Delete variants not in the submitted list
      await tx.productVariant.deleteMany({
        where: {
          productId: id,
          id: { notIn: submittedVariantIds }
        }
      });

      // 2. Insert/Update submitted variants
      for (const v of variants) {
        // Resolve images URLs
        const resolvedImages: string[] = [];
        if (v.images && v.images.length > 0) {
          v.images.forEach((imgKey: string) => {
            if (imgKey.startsWith("new-file-")) {
              const fileIndex = parseInt(imgKey.replace("new-file-", ""), 10);
              // Resolve relative to where it lands in finalImages
              // The new images appended in order at the end of finalImages:
              // finalImages = [...existingImages, ...newImages]
              // so the file index maps to existingImages.length + fileIndex
              const resolvedUrl = finalImages[existingImages.length + fileIndex];
              if (resolvedUrl) {
                resolvedImages.push(resolvedUrl);
              }
            } else {
              resolvedImages.push(imgKey);
            }
          });
        }

        if (v.id) {
          // Verify this variant actually belongs to the product being edited before touching
          // it — `tx.productVariant.update({ where: { id: v.id } })` alone would blindly trust
          // a client-supplied variant id regardless of which product/seller it belongs to.
          // This read also gives us the pre-update stock for the ledger entry below.
          const existingVariant = await tx.productVariant.findFirst({
            where: { id: v.id, productId: id },
            select: { stock: true },
          });
          if (!existingVariant) {
            throw new Error(`Variant ${v.id} does not belong to this product.`);
          }

          await tx.productVariant.update({
            where: { id: v.id },
            data: {
              sku: v.sku,
              size: v.size || null,
              color: v.color || null,
              mrp: v.price,
              sellingPrice: v.price,
              stock: v.stock,
              images: resolvedImages,
            }
          });

          if (existingVariant.stock !== v.stock) {
            await tx.inventoryTransaction.create({
              data: {
                variantId: v.id,
                sellerId: product.sellerId,
                type: "ADJUSTMENT",
                quantityChange: v.stock - existingVariant.stock,
                quantityBefore: existingVariant.stock,
                quantityAfter: v.stock,
                reason: "Manual stock update via product edit",
                actorUserId: session.user.id,
              },
            });
          }
        } else {
          await tx.productVariant.create({
            data: {
              productId: id,
              sku: v.sku,
              size: v.size || null,
              color: v.color || null,
              mrp: v.price,
              sellingPrice: v.price,
              stock: v.stock,
              images: resolvedImages,
            }
          });
        }
      }
    });

    revalidatePath("/seller/products");
    revalidatePath("/admin/products");
    revalidatePath(`/product/${id}`);
    revalidatePath("/");

    await createAuditLog("UPDATE_PRODUCT", "Product", id, { name: product.name, status: product.status }, { name, status: targetStatus });

    return { success: true };
  } catch (error: unknown) {
    console.error("updateProduct error:", error);
    const message = error instanceof Error ? error.message : "Failed to update product";
    return { success: false, error: message };
  }
}

export async function deleteProduct(id: string) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "SELLER" && session.user.role !== "ADMIN")) {
    return { success: false, error: "Unauthorized" };
  }

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      sellerId: true,
      name: true,
      status: true
    }
  });

  if (!product) {
    return { success: false, error: "Product not found" };
  }

  // Ownership Check
  if (session.user.role === "SELLER") {
    const profile = await prisma.sellerProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true }
    });
    if (!profile || product.sellerId !== profile.id) {
      return { success: false, error: "Forbidden: You do not own this product." };
    }
  }

  try {
    await prisma.product.delete({
      where: { id }
    });

    revalidatePath("/seller/products");
    revalidatePath("/admin/products");
    revalidatePath("/");

    await createAuditLog("DELETE_PRODUCT", "Product", id, { name: product.name, status: product.status }, null);

    return { success: true };
  } catch (error: unknown) {
    console.error("deleteProduct error:", error);
    const message = error instanceof Error ? error.message : "Failed to delete product";
    return { success: false, error: message };
  }
}

export async function moderateProduct(
  id: string,
  action: "APPROVE" | "REJECT",
  rejectionReason?: string
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized: Admin access required." };
  }

  const status = action === "APPROVE" ? "ACTIVE" : "REJECTED";

  try {
    const product = await prisma.product.update({
      where: { id },
      data: {
        status,
        approvedById: session.user.id,
        approvedAt: new Date(),
        rejectionReason: action === "REJECT" ? rejectionReason || "Rejected by administrator" : null,
      },
      include: {
        seller: {
          include: { user: true }
        }
      }
    });

    // Send notifications to the seller
    if (action === "APPROVE") {
      sendInAppNotification(
        product.seller.userId,
        NotificationType.PRODUCT_APPROVED,
        "Product Approved",
        `Your product "${product.name}" has been approved and is now active.`,
        "/seller/products"
      ).catch(err => console.error("Product Approved in-app notification failed:", err));

      sendNotificationEmail(
        product.seller.user.email,
        `Your Product "${product.name}" Has Been Approved`,
        "SELLER_PRODUCT_APPROVED",
        {
          sellerName: product.seller.user.name || "Seller",
          productName: product.name
        }
      ).catch(err => console.error("Product Approved email failed:", err));
    } else {
      sendInAppNotification(
        product.seller.userId,
        NotificationType.PRODUCT_REJECTED,
        "Product Rejected",
        `Your product submission "${product.name}" was not approved. Reason: ${rejectionReason || "Validation failed"}`,
        "/seller/products"
      ).catch(err => console.error("Product Rejected in-app notification failed:", err));

      sendNotificationEmail(
        product.seller.user.email,
        `Product Submission Rejected: "${product.name}"`,
        "SELLER_PRODUCT_REJECTED",
        {
          sellerName: product.seller.user.name || "Seller",
          productName: product.name,
          reason: rejectionReason || "Validation failed"
        }
      ).catch(err => console.error("Product Rejected email failed:", err));
    }

    revalidatePath("/seller/products");
    revalidatePath("/admin/products");
    revalidatePath(`/product/${id}`);
    revalidatePath("/");

    await createAuditLog("MODERATE_PRODUCT", "Product", id, null, { status, rejectionReason });

    return { success: true };
  } catch (error: unknown) {
    console.error("moderateProduct error:", error);
    const message = error instanceof Error ? error.message : "Failed to moderate product";
    return { success: false, error: message };
  }
}

export async function moderateB2BProduct(id: string, approve: boolean) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized: Admin access required." };
  }

  try {
    const product = await prisma.product.update({
      where: { id },
      data: {
        isB2BApproved: approve,
      },
      include: {
        seller: {
          include: { user: true }
        }
      }
    });

    // Send notifications to the seller
    if (approve) {
      sendInAppNotification(
        product.seller.userId,
        NotificationType.PRODUCT_APPROVED,
        "B2B Product Approved",
        `Your B2B product request for "${product.name}" has been approved.`,
        "/seller/products"
      ).catch(err => console.error("B2B Product Approved in-app failed:", err));

      sendNotificationEmail(
        product.seller.user.email,
        `Your B2B Product Listing "${product.name}" Approved`,
        "SELLER_PRODUCT_APPROVED",
        {
          sellerName: product.seller.user.name || "Seller",
          productName: `${product.name} (B2B)`
        }
      ).catch(err => console.error("B2B Product Approved email failed:", err));
    } else {
      sendInAppNotification(
        product.seller.userId,
        NotificationType.PRODUCT_REJECTED,
        "B2B Product Rejected",
        `Your B2B product request for "${product.name}" has been rejected.`,
        "/seller/products"
      ).catch(err => console.error("B2B Product Rejected in-app failed:", err));

      sendNotificationEmail(
        product.seller.user.email,
        `B2B Product Listing Rejected: "${product.name}"`,
        "SELLER_PRODUCT_REJECTED",
        {
          sellerName: product.seller.user.name || "Seller",
          productName: `${product.name} (B2B)`,
          reason: "B2B catalog criteria not met"
        }
      ).catch(err => console.error("B2B Product Rejected email failed:", err));
    }

    revalidatePath("/seller/products");
    revalidatePath("/admin/products");
    revalidatePath(`/product/${id}`);
    revalidatePath("/b2b");
    revalidatePath("/");

    await createAuditLog("MODERATE_B2B_PRODUCT", "Product", id, null, { isB2BApproved: approve });

    return { success: true };
  } catch (error: unknown) {
    console.error("moderateB2BProduct error:", error);
    const message = error instanceof Error ? error.message : "Failed to moderate B2B status";
    return { success: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Category management (Admin only)
// ---------------------------------------------------------------------------

async function requireAdminSession() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized: Admin access required.");
  }
  return session;
}

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "");
}

export async function getTrendingCandidatesAdmin() {
  await requireAdminSession();
  return prisma.product.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, images: true, isFeatured: true },
    orderBy: { isFeatured: "desc" },
    take: 60,
  });
}

export async function setProductFeatured(id: string, isFeatured: boolean) {
  try {
    await requireAdminSession();
    await prisma.product.update({ where: { id }, data: { isFeatured } });
    await createAuditLog("SET_PRODUCT_FEATURED", "Product", id, null, { isFeatured });
    revalidatePath("/admin/trending");
    revalidatePath("/");
    return { success: true };
  } catch (error: unknown) {
    console.error("setProductFeatured error:", error);
    const message = error instanceof Error ? error.message : "Failed to update trending status";
    return { success: false, error: message };
  }
}

export async function getCategoriesAdmin() {
  await requireAdminSession();
  return prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createCategory(data: { name: string; image?: string }) {
  try {
    await requireAdminSession();

    const name = data.name.trim();
    if (!name) {
      return { success: false, error: "Category name is required." };
    }

    const slugBase = slugify(name);
    let slug = slugBase || `category-${Date.now()}`;
    let suffix = 0;
    while (await prisma.category.findUnique({ where: { slug } })) {
      suffix += 1;
      slug = `${slugBase}-${suffix}`;
    }

    await prisma.category.create({
      data: { name, slug, image: data.image?.trim() || null },
    });

    await createAuditLog("CREATE_CATEGORY", "Category", slug, null, { name });
    revalidatePath("/admin/categories");
    revalidatePath("/");
    return { success: true };
  } catch (error: unknown) {
    console.error("createCategory error:", error);
    const message = error instanceof Error ? error.message : "Failed to create category";
    return { success: false, error: message };
  }
}

export async function updateCategory(id: string, data: { name: string; image?: string }) {
  try {
    await requireAdminSession();

    const name = data.name.trim();
    if (!name) {
      return { success: false, error: "Category name is required." };
    }

    await prisma.category.update({
      where: { id },
      data: { name, image: data.image?.trim() || null },
    });

    await createAuditLog("UPDATE_CATEGORY", "Category", id, null, { name });
    revalidatePath("/admin/categories");
    revalidatePath("/");
    return { success: true };
  } catch (error: unknown) {
    console.error("updateCategory error:", error);
    const message = error instanceof Error ? error.message : "Failed to update category";
    return { success: false, error: message };
  }
}

export async function deleteCategory(id: string) {
  try {
    await requireAdminSession();

    const productCount = await prisma.product.count({ where: { categoryId: id } });
    if (productCount > 0) {
      return { success: false, error: `Cannot delete: ${productCount} product(s) still use this category.` };
    }

    await prisma.category.delete({ where: { id } });

    await createAuditLog("DELETE_CATEGORY", "Category", id, null, null);
    revalidatePath("/admin/categories");
    revalidatePath("/");
    return { success: true };
  } catch (error: unknown) {
    console.error("deleteCategory error:", error);
    const message = error instanceof Error ? error.message : "Failed to delete category";
    return { success: false, error: message };
  }
}
