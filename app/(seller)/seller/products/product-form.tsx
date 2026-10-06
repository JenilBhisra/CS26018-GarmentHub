"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createProduct, updateProduct } from "@/actions/products";
import { ProductStatus } from "@prisma/client";
import { 
  UploadCloud, X, Film, Plus, Trash2, Star,
  Info, Settings, Image as ImageIcon, Layers, Truck, Award
} from "lucide-react";

type Category = {
  id: string;
  name: string;
  slug: string;
};

type VariantItem = {
  id?: string;
  sku: string;
  price: number;
  stock: number;
  size: string;
  color: string;
  images: string[]; // URLs or temporary placeholders like "new-file-0"
};

type ProductFormProps = {
  categories: Category[];
  initialData?: {
    id: string;
    name: string;
    description: string;
    categoryId: string;
    price: number; // displayed default variant price
    stock: number; // displayed default variant stock
    sku: string;   // displayed default variant SKU
    images: string[];
    videoUrl?: string;
    status: ProductStatus;
    isB2BEnabled: boolean;
    variants?: {
      id: string;
      sku?: string;
      sellingPrice?: number;
      stock?: number;
      size?: string;
      color?: string;
      images?: string[];
      moq?: number;
    }[];
    
    // Advanced fields
    brand?: string;
    tags?: string[];
    manufacturerName?: string;
    modelNumber?: string;
    productCode?: string;
    shortDescription?: string;
    longDescription?: string;
    careInstructions?: string;
    countryOfOrigin?: string;
    specifications?: unknown;
    maxCapacity?: string;
    dispatchTime?: string;
    bulkPriceTiers?: unknown;
    packagingDetails?: string;
    weight?: number;
    dimensions?: string;
    shippingClass?: string;
    seoTitle?: string;
    seoDescription?: string;
    seoKeywords?: string[];
    ogImage?: string;
    certifications?: string[];
    warrantyInfo?: string;
    returnPolicy?: string;
    replacementPolicy?: string;
    slug?: string;
    rejectionReason?: string | null;
  };
};

type NewImageItem = {
  id: string;
  file: File;
  previewUrl: string;
};

const TABS = [
  { id: "basics", label: "Basics", icon: Info },
  { id: "specs", label: "Garment Specifications", icon: Settings },
  { id: "media", label: "Media Gallery", icon: ImageIcon },
  { id: "variants", label: "Variants & Inventory", icon: Layers },
  { id: "wholesale", label: "Wholesale & B2B", icon: Award },
  { id: "shipping", label: "Shipping, SEO & Trust", icon: Truck },
];

export default function ProductForm({ categories, initialData }: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("basics");

  // Tab 1: Basics
  const [name, setName] = useState(initialData?.name || "");
  const [brand, setBrand] = useState(initialData?.brand || "");
  const [manufacturerName, setManufacturerName] = useState(initialData?.manufacturerName || "");
  const [modelNumber, setModelNumber] = useState(initialData?.modelNumber || "");
  const [productCode, setProductCode] = useState(initialData?.productCode || "");
  const [shortDescription, setShortDescription] = useState(initialData?.shortDescription || "");
  const [longDescription, setLongDescription] = useState(initialData?.longDescription || initialData?.description || "");
  const [careInstructions, setCareInstructions] = useState(initialData?.careInstructions || "");
  const [countryOfOrigin, setCountryOfOrigin] = useState(initialData?.countryOfOrigin || "");
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || categories[0]?.id || "");
  const [status, setStatus] = useState<ProductStatus>(initialData?.status || "PENDING_REVIEW");
  const [tagsInput, setTagsInput] = useState(initialData?.tags?.join(", ") || "");

  // Tab 2: Specifications (Extensible JSON)
  const initialSpecs = (initialData?.specifications || {}) as Record<string, string>;
  const [fabricMaterial, setFabricMaterial] = useState(initialSpecs.fabricMaterial || "");
  const [gender, setGender] = useState(initialSpecs.gender || "");
  const [ageGroup, setAgeGroup] = useState(initialSpecs.ageGroup || "");
  const [occasion, setOccasion] = useState(initialSpecs.occasion || "");
  const [pattern, setPattern] = useState(initialSpecs.pattern || "");
  const [sleeveType, setSleeveType] = useState(initialSpecs.sleeveType || "");
  const [fitType, setFitType] = useState(initialSpecs.fitType || "");
  const [neckType, setNeckType] = useState(initialSpecs.neckType || "");
  const [season, setSeason] = useState(initialSpecs.season || "");
  const [style, setStyle] = useState(initialSpecs.style || "");
  const [gsm, setGsm] = useState(initialSpecs.gsm || "");
  const [washCareInstructions, setWashCareInstructions] = useState(initialSpecs.washCareInstructions || "");

  // Tab 3: Media Gallery
  const [existingImages, setExistingImages] = useState<string[]>(initialData?.images || []);
  const [newImages, setNewImages] = useState<NewImageItem[]>([]);
  const [existingVideo, setExistingVideo] = useState<string | null>(initialData?.videoUrl || null);
  const [newVideoFile, setNewVideoFile] = useState<File | null>(null);
  const [newVideoPreview, setNewVideoPreview] = useState<string | null>(null);

  // Tab 4: Multi-Variants
  const mapInitialVariants = (): VariantItem[] => {
    if (initialData?.variants && initialData.variants.length > 0) {
      return initialData.variants.map((v) => ({
        id: v.id,
        sku: v.sku || "",
        price: v.sellingPrice || 0,
        stock: v.stock || 0,
        size: v.size || "",
        color: v.color || "",
        images: v.images || [],
      }));
    }
    // Prefill with initial fallback parameters if editing a product with 1 default variant
    return [
      {
        sku: initialData?.sku || "",
        price: initialData?.price || 0,
        stock: initialData?.stock || 0,
        size: "Free Size",
        color: "Default",
        images: [],
      },
    ];
  };

  const [variants, setVariants] = useState<VariantItem[]>(mapInitialVariants());
  const [editingVariantIndex, setEditingVariantIndex] = useState<number | null>(null);

  // Tab 5: Wholesale & B2B
  const [isB2BEnabled, setIsB2BEnabled] = useState(initialData?.isB2BEnabled || false);
  const [maxCapacity, setMaxCapacity] = useState(initialData?.maxCapacity || "");
  const [dispatchTime, setDispatchTime] = useState(initialData?.dispatchTime || "");
  const [packagingDetails, setPackagingDetails] = useState(initialData?.packagingDetails || "");
  const [moq, setMoq] = useState(initialData?.variants?.[0]?.moq || 1);
  const [bulkPriceTiers, setBulkPriceTiers] = useState<{ quantity: number; price: number }[]>(
    (initialData?.bulkPriceTiers as { quantity: number; price: number }[]) || []
  );
  const [newTierQty, setNewTierQty] = useState("");
  const [newTierPrice, setNewTierPrice] = useState("");

  // Tab 6: Shipping, SEO & Trust
  const [weight, setWeight] = useState(initialData?.weight !== undefined ? initialData.weight : 0);
  const [dimensions, setDimensions] = useState(initialData?.dimensions || "");
  const [shippingClass, setShippingClass] = useState(initialData?.shippingClass || "");
  const [seoTitle, setSeoTitle] = useState(initialData?.seoTitle || "");
  const [seoDescription, setSeoDescription] = useState(initialData?.seoDescription || "");
  const [seoKeywordsInput, setSeoKeywordsInput] = useState(initialData?.seoKeywords?.join(", ") || "");
  const [ogImage, setOgImage] = useState(initialData?.ogImage || "");
  const [customSlug, setCustomSlug] = useState(initialData?.slug || "");
  const [warrantyInfo, setWarrantyInfo] = useState(initialData?.warrantyInfo || "");
  const [returnPolicy, setReturnPolicy] = useState(initialData?.returnPolicy || "");
  const [replacementPolicy, setReplacementPolicy] = useState(initialData?.replacementPolicy || "");
  const [certificationsInput, setCertificationsInput] = useState(initialData?.certifications?.join(", ") || "");

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      newImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      if (newVideoPreview) URL.revokeObjectURL(newVideoPreview);
    };
  }, [newImages, newVideoPreview]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const currentTotal = existingImages.length + newImages.length;
    if (currentTotal + files.length > 10) {
      setError("Maximum 10 photos are allowed per listing.");
      return;
    }
    setError(null);
    const items: NewImageItem[] = files.map((file) => ({
      id: Math.random().toString(36).substring(2, 9) + Date.now(),
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setNewImages((prev) => [...prev, ...items]);
  };

  const removeExistingImage = (index: number) => {
    const imgUrl = existingImages[index];
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
    // Remove deleted images from variants
    setVariants((prev) =>
      prev.map((v) => ({
        ...v,
        images: v.images.filter((img) => img !== imgUrl),
      }))
    );
  };

  const removeNewImage = (id: string, previewUrl: string, idx: number) => {
    URL.revokeObjectURL(previewUrl);
    setNewImages((prev) => prev.filter((img) => img.id !== id));
    // Remove resolved key "new-file-idx" from variants
    const matchKey = `new-file-${idx}`;
    setVariants((prev) =>
      prev.map((v) => ({
        ...v,
        images: v.images.filter((img) => img !== matchKey),
      }))
    );
  };

  const moveImage = (index: number, direction: "left" | "right") => {
    const imagesList = [...existingImages];
    const targetIdx = direction === "left" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= imagesList.length) return;
    
    // Swap images
    const temp = imagesList[index];
    imagesList[index] = imagesList[targetIdx];
    imagesList[targetIdx] = temp;
    setExistingImages(imagesList);
  };

  const makeCoverImage = (index: number) => {
    const imagesList = [...existingImages];
    const [target] = imagesList.splice(index, 1);
    imagesList.unshift(target);
    setExistingImages(imagesList);
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (newVideoPreview) URL.revokeObjectURL(newVideoPreview);
    setNewVideoFile(file);
    setNewVideoPreview(URL.createObjectURL(file));
    setExistingVideo(null);
  };

  const removeVideo = () => {
    if (newVideoPreview) {
      URL.revokeObjectURL(newVideoPreview);
      setNewVideoPreview(null);
    }
    setNewVideoFile(null);
    setExistingVideo(null);
  };

  // Add / Remove variant rows
  const addVariantRow = () => {
    const baseSku = variants[0]?.sku || initialData?.sku || "SKU";
    const basePrice = variants[0]?.price || initialData?.price || 0;
    setVariants((prev) => [
      ...prev,
      {
        sku: `${baseSku}-${prev.length + 1}`,
        price: basePrice,
        stock: 0,
        size: "",
        color: "",
        images: [],
      },
    ]);
  };

  const removeVariantRow = (index: number) => {
    if (variants.length === 1) {
      setError("At least one product variant is required.");
      return;
    }
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const updateVariantRow = (index: number, field: keyof VariantItem, value: string | number | string[]) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  };

  // Manage variant image mappings
  const toggleVariantImage = (variantIndex: number, imageKey: string) => {
    const v = variants[variantIndex];
    const isAssociated = v.images.includes(imageKey);
    const updatedImages = isAssociated
      ? v.images.filter((img) => img !== imageKey)
      : [...v.images, imageKey];
    updateVariantRow(variantIndex, "images", updatedImages);
  };

  // Bulk Wholesale Tiers
  const addPriceTier = () => {
    const qty = parseInt(newTierQty, 10);
    const tierPrice = parseFloat(newTierPrice);
    if (isNaN(qty) || qty <= 0 || isNaN(tierPrice) || tierPrice < 0) {
      setError("Please specify a valid quantity and pricing tier.");
      return;
    }
    setBulkPriceTiers((prev) => [...prev, { quantity: qty, price: tierPrice }].sort((a, b) => a.quantity - b.quantity));
    setNewTierQty("");
    setNewTierPrice("");
    setError(null);
  };

  const removePriceTier = (index: number) => {
    setBulkPriceTiers((prev) => prev.filter((_, i) => i !== index));
  };

  const validateTab = (tabId: string): boolean => {
    setError(null);
    if (tabId === "basics") {
      if (!name.trim()) {
        setError("Basics: Product title is required.");
        return false;
      }
      if (!categoryId) {
        setError("Basics: Product category is required.");
        return false;
      }
    }
    if (tabId === "media") {
      const totalImagesCount = existingImages.length + newImages.length;
      if (totalImagesCount === 0) {
        setError("Media: At least 1 product photo is required.");
        return false;
      }
      if (totalImagesCount > 10) {
        setError("Media: Maximum 10 photos are allowed per listing.");
        return false;
      }
    }
    if (tabId === "variants") {
      const skuSet = new Set<string>();
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        if (!v.sku || !v.sku.trim()) {
          setError(`Variants: Row ${i + 1} must specify a SKU.`);
          return false;
        }
        if (v.price < 0) {
          setError(`Variants: Row ${i + 1} pricing cannot be negative.`);
          return false;
        }
        if (v.stock < 0) {
          setError(`Variants: Row ${i + 1} stock quantity cannot be negative.`);
          return false;
        }
        if (skuSet.has(v.sku)) {
          setError(`Variants: SKU "${v.sku}" is duplicated.`);
          return false;
        }
        skuSet.add(v.sku);
      }
    }
    return true;
  };

  const handleTabChange = (targetTabId: string) => {
    const currentIndex = TABS.findIndex((t) => t.id === activeTab);
    const targetIndex = TABS.findIndex((t) => t.id === targetTabId);

    if (targetIndex > currentIndex) {
      // Validate every tab from current up to targetIndex - 1
      for (let i = currentIndex; i < targetIndex; i++) {
        if (!validateTab(TABS[i].id)) {
          setActiveTab(TABS[i].id);
          return;
        }
      }
    }
    setError(null);
    setActiveTab(targetTabId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate all tabs sequentially before saving
    for (let i = 0; i < TABS.length; i++) {
      if (!validateTab(TABS[i].id)) {
        setActiveTab(TABS[i].id);
        return;
      }
    }

    // Compile specifications JSON
    const specifications = {
      fabricMaterial,
      gender,
      ageGroup,
      occasion,
      pattern,
      sleeveType,
      fitType,
      neckType,
      season,
      style,
      gsm,
      washCareInstructions,
    };

    const formData = new FormData();
    formData.append("name", name);
    formData.append("brand", brand);
    formData.append("description", longDescription);
    formData.append("categoryId", categoryId);
    formData.append("status", status);
    formData.append("isB2BEnabled", isB2BEnabled.toString());

    // Advanced fields
    formData.append("manufacturerName", manufacturerName);
    formData.append("modelNumber", modelNumber);
    formData.append("productCode", productCode);
    formData.append("shortDescription", shortDescription);
    formData.append("longDescription", longDescription);
    formData.append("careInstructions", careInstructions);
    formData.append("countryOfOrigin", countryOfOrigin);
    formData.append("specifications", JSON.stringify(specifications));

    formData.append("maxCapacity", maxCapacity);
    formData.append("dispatchTime", dispatchTime);
    formData.append("packagingDetails", packagingDetails);
    formData.append("bulkPriceTiers", JSON.stringify(bulkPriceTiers));

    formData.append("weight", weight.toString());
    formData.append("dimensions", dimensions);
    formData.append("shippingClass", shippingClass);

    formData.append("seoTitle", seoTitle);
    formData.append("seoDescription", seoDescription);
    formData.append("ogImage", ogImage);
    formData.append("slug", customSlug);

    formData.append("warrantyInfo", warrantyInfo);
    formData.append("returnPolicy", returnPolicy);
    formData.append("replacementPolicy", replacementPolicy);

    // Arrays
    tagsInput.split(",").map((t: string) => t.trim()).filter(Boolean).forEach((t: string) => formData.append("tags", t));
    seoKeywordsInput.split(",").map((k: string) => k.trim()).filter(Boolean).forEach((k: string) => formData.append("seoKeywords", k));
    certificationsInput.split(",").map((c: string) => c.trim()).filter(Boolean).forEach((c: string) => formData.append("certifications", c));

    // Append existing images
    existingImages.forEach((img) => formData.append("existingImages", img));

    // Append new images files
    newImages.forEach((img) => formData.append("imageFiles", img.file));

    // Append video file
    if (newVideoFile) {
      formData.append("videoFile", newVideoFile);
    } else if (existingVideo) {
      formData.append("keepExistingVideo", "true");
    }

    // Serialize variants - we pass indices for new files
    // In products.ts action, it resolves "new-file-idx" to the newly saved relative URL
    formData.append("variants", JSON.stringify(variants));

    // Extract default variant metrics to mirror parent listing columns
    const firstVariant = variants[0];
    if (firstVariant) {
      formData.append("price", firstVariant.price.toString());
      formData.append("stock", firstVariant.stock.toString());
      formData.append("sku", firstVariant.sku);
    }

    startTransition(async () => {
      let res;
      if (initialData?.id) {
        res = await updateProduct(initialData.id, formData);
      } else {
        res = await createProduct(formData);
      }

      if (res.success) {
        router.push("/seller/products");
        router.refresh();
      } else {
        setError(res.error || "An error occurred");
      }
    });
  };

  const currentTabIndex = TABS.findIndex((t) => t.id === activeTab);
  const isFirstTab = currentTabIndex === 0;
  const isLastTab = currentTabIndex === TABS.length - 1;

  return (
    <div className="space-y-6 max-w-4xl">
      {error && (
        <div className="rounded-md bg-red-50 p-4 border border-red-200 text-sm text-red-800 animate-fadeIn">
          {error}
        </div>
      )}

      {initialData?.status === "REJECTED" && initialData?.rejectionReason && (
        <div className="rounded-md bg-red-50 p-4 border border-red-200 text-sm text-red-800 animate-fadeIn">
          <strong className="font-semibold text-stone-900 block">This product listing was rejected by the administrator:</strong>
          <p className="mt-1 text-stone-700">{initialData.rejectionReason}</p>
        </div>
      )}

      {/* Tabs navigation bar */}
      <div className="flex border-b border-stone-200 overflow-x-auto whitespace-nowrap bg-white rounded-t-lg p-2 gap-1 scrollbar-hide">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-xs font-medium uppercase tracking-wider transition-colors ${active ? "bg-stone-900 text-white font-semibold" : "text-stone-600 hover:bg-stone-50"}`}
            >
              <Icon className="h-4 w-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-b-lg border-x border-b border-border p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* TAB 1: BASICS */}
          {activeTab === "basics" && (
            <div className="space-y-5 animate-fadeIn">
              <div className="border-b border-stone-100 pb-2">
                <h3 className="text-md font-semibold text-stone-900">Basic Garment Info</h3>
                <p className="text-xs text-muted-foreground">General catalog identifiers and listings copy.</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Product Title *</label>
                <input
                  type="text"
                  className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                  placeholder="e.g. Premium Cotton Denim Shirt"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Category *</label>
                  <select
                    className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none bg-background"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    required
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Brand Name</label>
                  <input
                    type="text"
                    className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                    placeholder="e.g. Atelier 21"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Manufacturer Name</label>
                  <input
                    type="text"
                    className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                    placeholder="e.g. Apex Apparel Ltd"
                    value={manufacturerName}
                    onChange={(e) => setManufacturerName(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Product Model Number</label>
                  <input
                    type="text"
                    className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                    placeholder="e.g. MOD-DNM-2026"
                    value={modelNumber}
                    onChange={(e) => setModelNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Product Code / Style Code</label>
                  <input
                    type="text"
                    className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                    placeholder="e.g. GH-DNM-SL01"
                    value={productCode}
                    onChange={(e) => setProductCode(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Short Description</label>
                <input
                  type="text"
                  className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                  placeholder="Summarize product highlight features in one line"
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Description (Long Details)</label>
                <textarea
                  className="w-full border border-input rounded-md p-3 text-sm focus:border-stone-900 focus:outline-none"
                  placeholder="Full description detailing fabric details, styling tips, fit, packaging etc."
                  rows={4}
                  value={longDescription}
                  onChange={(e) => setLongDescription(e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Country of Origin</label>
                  <input
                    type="text"
                    className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                    placeholder="e.g. India"
                    value={countryOfOrigin}
                    onChange={(e) => setCountryOfOrigin(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Tags / Keywords (Comma Separated)</label>
                  <input
                    type="text"
                    className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                    placeholder="denim, shirt, casual, cotton"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">General Wash/Care Instructions</label>
                <input
                  type="text"
                  className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                  placeholder="e.g. Machine wash cold, tumble dry low"
                  value={careInstructions}
                  onChange={(e) => setCareInstructions(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* TAB 2: SPECIFICATIONS */}
          {activeTab === "specs" && (
            <div className="space-y-5 animate-fadeIn">
              <div className="border-b border-stone-100 pb-2">
                <h3 className="text-md font-semibold text-stone-900">Garment Specifications</h3>
                <p className="text-xs text-muted-foreground">Standardized product spec definitions mapping to catalog filters.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Fabric Material</label>
                  <input
                    type="text"
                    className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                    placeholder="e.g. 100% Cotton, Linen"
                    value={fabricMaterial}
                    onChange={(e) => setFabricMaterial(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">GSM (Fabric Weight)</label>
                  <input
                    type="text"
                    className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                    placeholder="e.g. 180, 240"
                    value={gsm}
                    onChange={(e) => setGsm(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Gender</label>
                  <select
                    className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none bg-background"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="">Select Gender</option>
                    <option value="Men">Men</option>
                    <option value="Women">Women</option>
                    <option value="Unisex">Unisex</option>
                    <option value="Girls">Girls</option>
                    <option value="Boys">Boys</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Sleeve Type</label>
                  <input
                    type="text"
                    className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                    placeholder="e.g. Long Sleeve, Short Sleeve"
                    value={sleeveType}
                    onChange={(e) => setSleeveType(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Fit Type</label>
                  <input
                    type="text"
                    className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                    placeholder="e.g. Slim Fit, Oversized"
                    value={fitType}
                    onChange={(e) => setFitType(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Neck Type</label>
                  <input
                    type="text"
                    className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                    placeholder="e.g. Crew Neck, Collar"
                    value={neckType}
                    onChange={(e) => setNeckType(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Pattern</label>
                  <input
                    type="text"
                    className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                    placeholder="e.g. Solid, Striped, Checked"
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Occasion</label>
                  <input
                    type="text"
                    className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                    placeholder="e.g. Casual, Festive, Formal"
                    value={occasion}
                    onChange={(e) => setOccasion(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Season</label>
                  <input
                    type="text"
                    className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                    placeholder="e.g. Summer SS26, Winter"
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Age Group</label>
                  <input
                    type="text"
                    className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                    placeholder="e.g. Adults, Kids"
                    value={ageGroup}
                    onChange={(e) => setAgeGroup(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Style Type</label>
                  <input
                    type="text"
                    className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                    placeholder="e.g. Western, Indian Ethnic"
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Wash Care Label Instructions</label>
                <textarea
                  className="w-full border border-input rounded-md p-3 text-sm focus:border-stone-900 focus:outline-none"
                  placeholder="Detailed wash care specifications for product tags..."
                  rows={2}
                  value={washCareInstructions}
                  onChange={(e) => setWashCareInstructions(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* TAB 3: MEDIA */}
          {activeTab === "media" && (
            <div className="space-y-5 animate-fadeIn">
              <div className="border-b border-stone-100 pb-2">
                <h3 className="text-md font-semibold text-stone-900">Media Gallery</h3>
                <p className="text-xs text-muted-foreground">Manage and sort images (max 10). Reorder photos to set the Cover image.</p>
              </div>

              {/* Upload grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                {/* Existing images previews with reordering controls */}
                {existingImages.map((src, idx) => {
                  const isCover = idx === 0;
                  return (
                    <div key={`existing-${idx}`} className="relative aspect-[4/5] overflow-hidden rounded-md border border-border group bg-stone-50 flex flex-col justify-between">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} className="h-full w-full object-cover" alt="" />
                      
                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={() => removeExistingImage(idx)}
                        className="absolute right-1.5 top-1.5 p-1 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors z-10"
                        title="Remove image"
                      >
                        <X className="h-3 w-3" />
                      </button>

                      {/* Reorder Overlay */}
                      <div className="absolute inset-x-0 bottom-0 bg-black/75 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex justify-between gap-1 items-center z-10 text-white text-[10px]">
                        <button
                          type="button"
                          onClick={() => moveImage(idx, "left")}
                          disabled={idx === 0}
                          className="px-1 py-0.5 rounded hover:bg-white/20 disabled:opacity-35"
                        >
                          ← Left
                        </button>
                        
                        {!isCover && (
                          <button
                            type="button"
                            onClick={() => makeCoverImage(idx)}
                            className="bg-stone-900 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded hover:bg-stone-800"
                          >
                            Cover
                          </button>
                        )}
                        
                        <button
                          type="button"
                          onClick={() => moveImage(idx, "right")}
                          disabled={idx === existingImages.length - 1}
                          className="px-1 py-0.5 rounded hover:bg-white/20 disabled:opacity-35"
                        >
                          Right →
                        </button>
                      </div>

                      {isCover ? (
                        <span className="absolute left-1.5 top-1.5 text-[8px] bg-stone-950 text-white px-1.5 py-0.5 rounded font-mono uppercase tracking-wider flex items-center gap-0.5">
                          <Star className="h-2 w-2 fill-current text-amber-400" /> Cover
                        </span>
                      ) : (
                        <span className="absolute left-1.5 top-1.5 text-[8px] bg-black/50 text-white px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">Photo {idx + 1}</span>
                      )}
                    </div>
                  );
                })}

                {/* New images previews */}
                {newImages.map((img, idx) => (
                  <div key={img.id} className="relative aspect-[4/5] overflow-hidden rounded-md border border-border group bg-stone-50 animate-fadeIn">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.previewUrl} className="h-full w-full object-cover" alt="" />
                    <button
                      type="button"
                      onClick={() => removeNewImage(img.id, img.previewUrl, idx)}
                      className="absolute right-1.5 top-1.5 p-1 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors z-10"
                      title="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <span className="absolute left-1.5 top-1.5 text-[8px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">New Upload</span>
                  </div>
                ))}

                {/* Upload Trigger */}
                {existingImages.length + newImages.length < 10 && (
                  <label className="flex flex-col items-center justify-center aspect-[4/5] cursor-pointer rounded-md border border-dashed border-stone-300 text-stone-500 hover:border-stone-700 hover:text-stone-900 transition-colors bg-stone-50/50">
                    <UploadCloud className="h-6 w-6 text-stone-400" />
                    <span className="mt-2 text-xs font-semibold">Upload Photo</span>
                    <span className="text-[10px] text-stone-400 mt-0.5">({existingImages.length + newImages.length}/10)</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                  </label>
                )}
              </div>

              {/* Video upload section */}
              <div className="space-y-3 pt-4 border-t border-stone-100">
                <h4 className="text-sm font-semibold text-stone-900">Product Showcase Video</h4>
                {existingVideo || newVideoPreview ? (
                  <div className="relative w-full max-w-md aspect-video overflow-hidden rounded bg-black border border-border">
                    <video
                      src={newVideoPreview || existingVideo || undefined}
                      controls
                      className="h-full w-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={removeVideo}
                      className="absolute right-2 top-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors"
                      title="Remove video"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-6 border border-dashed border-stone-300 hover:border-stone-700 rounded-md cursor-pointer text-stone-500 hover:text-stone-900 transition-colors bg-stone-50/50 max-w-md">
                    <Film className="h-6 w-6 text-stone-400" />
                    <span className="mt-2 text-xs font-semibold">Select Video File</span>
                    <span className="text-[10px] text-stone-400 mt-0.5">MP4, WebM (Max 1 video, optional)</span>
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={handleVideoChange}
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: VARIANTS */}
          {activeTab === "variants" && (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                <div>
                  <h3 className="text-md font-semibold text-stone-900">Multi-Variant Manager</h3>
                  <p className="text-xs text-muted-foreground">Add rows for specific Size/Color SKUs, pricing, and stock.</p>
                </div>
                <button
                  type="button"
                  onClick={addVariantRow}
                  className="inline-flex items-center gap-1 bg-stone-900 text-white text-xs font-medium px-3 py-1.5 rounded hover:bg-stone-800 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Add Variant
                </button>
              </div>

              <div className="overflow-x-auto border border-border rounded-lg bg-card">
                <table className="w-full text-xs">
                  <thead className="bg-stone-50 text-stone-600 border-b border-border font-medium uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2 text-left">SKU *</th>
                      <th className="px-3 py-2 text-left">Size</th>
                      <th className="px-3 py-2 text-left">Color</th>
                      <th className="px-3 py-2 text-left">Price (₹) *</th>
                      <th className="px-3 py-2 text-left">Stock *</th>
                      <th className="px-3 py-2 text-left">Variant Photos</th>
                      <th className="px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {variants.map((v, idx) => (
                      <tr key={idx} className="hover:bg-muted/10">
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            className="border border-input rounded h-8 px-2 w-32 font-mono"
                            placeholder="SKU"
                            value={v.sku}
                            onChange={(e) => updateVariantRow(idx, "sku", e.target.value)}
                            required
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            className="border border-input rounded h-8 px-2 w-20"
                            placeholder="e.g. M, L"
                            value={v.size}
                            onChange={(e) => updateVariantRow(idx, "size", e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            className="border border-input rounded h-8 px-2 w-24"
                            placeholder="e.g. Red, Black"
                            value={v.color}
                            onChange={(e) => updateVariantRow(idx, "color", e.target.value)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="border border-input rounded h-8 px-2 w-24"
                            value={v.price}
                            onChange={(e) => updateVariantRow(idx, "price", parseFloat(e.target.value) || 0)}
                            required
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            className="border border-input rounded h-8 px-2 w-20"
                            value={v.stock}
                            onChange={(e) => updateVariantRow(idx, "stock", parseInt(e.target.value, 10) || 0)}
                            required
                          />
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => setEditingVariantIndex(editingVariantIndex === idx ? null : idx)}
                            className="h-8 border border-input rounded px-3 bg-stone-50 hover:bg-stone-100 flex items-center gap-1.5 transition-colors text-stone-600"
                          >
                            <ImageIcon className="h-3 w-3" /> Associate ({v.images?.length || 0})
                          </button>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeVariantRow(idx)}
                            className="p-1.5 rounded text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete variant"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Variant Images Association Sub-panel */}
              {editingVariantIndex !== null && (
                <div className="bg-stone-50 p-4 border border-border rounded-lg space-y-3 animate-fadeIn">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-stone-800">
                      Associate Photos for Variant: <span className="font-mono text-stone-600">&quot;{variants[editingVariantIndex]?.sku}&quot;</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingVariantIndex(null)}
                      className="text-stone-400 hover:text-stone-700 text-xs font-medium"
                    >
                      Done
                    </button>
                  </div>
                  
                  {/* Master list of uploaded and existing images */}
                  <div className="flex flex-wrap gap-2.5">
                    {/* Existing */}
                    {existingImages.map((src, idx) => {
                      const isSelected = variants[editingVariantIndex]?.images.includes(src);
                      return (
                        <button
                          key={`var-img-existing-${idx}`}
                          type="button"
                          onClick={() => toggleVariantImage(editingVariantIndex, src)}
                          className={`relative w-16 aspect-[4/5] overflow-hidden rounded border-2 transition-all ${isSelected ? "border-stone-900 ring-2 ring-stone-900/10 scale-95" : "border-border hover:border-stone-400"}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} className="h-full w-full object-cover" alt="" />
                          {isSelected && (
                            <div className="absolute inset-0 bg-stone-900/20 flex items-center justify-center">
                              <Star className="h-4 w-4 text-white fill-current" />
                            </div>
                          )}
                        </button>
                      );
                    })}

                    {/* New Images */}
                    {newImages.map((img, idx) => {
                      const mappingKey = `new-file-${idx}`;
                      const isSelected = variants[editingVariantIndex]?.images.includes(mappingKey);
                      return (
                        <button
                          key={`var-img-new-${idx}`}
                          type="button"
                          onClick={() => toggleVariantImage(editingVariantIndex, mappingKey)}
                          className={`relative w-16 aspect-[4/5] overflow-hidden rounded border-2 transition-all ${isSelected ? "border-stone-900 ring-2 ring-stone-900/10 scale-95" : "border-border hover:border-stone-400"}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.previewUrl} className="h-full w-full object-cover" alt="" />
                          {isSelected && (
                            <div className="absolute inset-0 bg-stone-900/20 flex items-center justify-center">
                              <Star className="h-4 w-4 text-white fill-current" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Tip: Select matching color photos for this variant. Selected photos will represent the variant on the detail pages.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: WHOLESALE & B2B */}
          {activeTab === "wholesale" && (
            <div className="space-y-5 animate-fadeIn">
              <div className="border-b border-stone-100 pb-2">
                <h3 className="text-md font-semibold text-stone-900">Wholesale & Bulk Metadata</h3>
                <p className="text-xs text-muted-foreground">Define B2B specifications. These remain optional wholesale parameters.</p>
              </div>

              <div className="flex items-center gap-2.5 p-4 bg-stone-50 rounded-xl border border-stone-200">
                <input
                  type="checkbox"
                  id="isB2BEnabled"
                  checked={isB2BEnabled}
                  onChange={(e) => setIsB2BEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 text-stone-950 focus:ring-stone-950 cursor-pointer"
                />
                <div className="grid gap-0.5">
                  <label htmlFor="isB2BEnabled" className="text-xs font-semibold text-stone-900 cursor-pointer select-none">
                    Enable B2B Wholesale Marketplace Visibility
                  </label>
                  <p className="text-[10px] text-stone-500">
                    This product will be eligible to show in the B2B catalog once approved by the administrator.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Minimum Order Quantity (MOQ)</label>
                  <input
                    type="number"
                    min="1"
                    className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                    value={moq}
                    onChange={(e) => setMoq(parseInt(e.target.value, 10) || 1)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Max Production Capacity</label>
                  <input
                    type="text"
                    className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                    placeholder="e.g. 5000 units / month"
                    value={maxCapacity}
                    onChange={(e) => setMaxCapacity(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Standard Dispatch Time</label>
                  <input
                    type="text"
                    className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                    placeholder="e.g. 3-5 business days"
                    value={dispatchTime}
                    onChange={(e) => setDispatchTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Packaging Details</label>
                <input
                  type="text"
                  className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                  placeholder="e.g. 1 unit per polybag, 50 polybags per carton"
                  value={packagingDetails}
                  onChange={(e) => setPackagingDetails(e.target.value)}
                />
              </div>

              {/* Bulk Price Tiers Editor */}
              <div className="space-y-3 pt-4 border-t border-stone-100">
                <h4 className="text-sm font-semibold text-stone-900">Bulk Price Tiers</h4>
                <div className="flex gap-2 items-end max-w-md">
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-semibold text-stone-500 uppercase">Min Quantity</label>
                    <input
                      type="number"
                      min="1"
                      className="w-full h-9 border border-input rounded px-2 text-xs focus:outline-none focus:border-stone-900"
                      placeholder="e.g. 50"
                      value={newTierQty}
                      onChange={(e) => setNewTierQty(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-semibold text-stone-500 uppercase">Unit Price (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full h-9 border border-input rounded px-2 text-xs focus:outline-none focus:border-stone-900"
                      placeholder="e.g. 899"
                      value={newTierPrice}
                      onChange={(e) => setNewTierPrice(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addPriceTier}
                    className="h-9 bg-stone-900 text-white text-xs px-4 rounded hover:bg-stone-800 transition-colors font-medium"
                  >
                    Add Tier
                  </button>
                </div>

                {/* Tiers List */}
                {bulkPriceTiers.length > 0 ? (
                  <div className="max-w-md border border-border rounded-lg bg-stone-50/50 p-3 divide-y divide-border">
                    {bulkPriceTiers.map((tier, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 text-xs">
                        <span className="text-stone-700 font-medium">Qty: {tier.quantity}+</span>
                        <span className="text-stone-900 font-bold">₹{Number(tier.price).toLocaleString("en-IN")} / unit</span>
                        <button
                          type="button"
                          onClick={() => removePriceTier(idx)}
                          className="text-red-500 hover:text-red-700 hover:underline font-semibold"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No bulk pricing tiers defined.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: SHIPPING, SEO & TRUST */}
          {activeTab === "shipping" && (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Shipping section */}
              <div className="space-y-4">
                <div className="border-b border-stone-100 pb-2">
                  <h3 className="text-md font-semibold text-stone-900">Shipping Specifications</h3>
                  <p className="text-xs text-muted-foreground">Dimensions and weight for shipping calculations (calculations configured later).</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Product Weight (grams)</label>
                    <input
                      type="number"
                      min="0"
                      className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                      placeholder="e.g. 350"
                      value={weight}
                      onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Dimensions (L x W x H in cm)</label>
                    <input
                      type="text"
                      className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                      placeholder="e.g. 30x20x5"
                      value={dimensions}
                      onChange={(e) => setDimensions(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Shipping Class</label>
                    <select
                      className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none bg-background"
                      value={shippingClass}
                      onChange={(e) => setShippingClass(e.target.value)}
                    >
                      <option value="">Standard Flat Rate</option>
                      <option value="GarmentSmall">Small Apparel</option>
                      <option value="GarmentLarge">Large Apparel / Bulk Box</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SEO section */}
              <div className="space-y-4 pt-4 border-t border-stone-100">
                <div className="border-b border-stone-100 pb-2">
                  <h3 className="text-md font-semibold text-stone-900">SEO & Metadata Optimization</h3>
                  <p className="text-xs text-muted-foreground">Optimize your listing for search engines.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Custom URL Slug</label>
                    <input
                      type="text"
                      className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none font-mono"
                      placeholder="e.g. premium-cotton-denim-shirt"
                      value={customSlug}
                      onChange={(e) => setCustomSlug(e.target.value)}
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Optional. Leave empty to auto-generate from title. Must be unique.</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">SEO Meta Title</label>
                    <input
                      type="text"
                      className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                      placeholder="Optimized page title tag"
                      value={seoTitle}
                      onChange={(e) => setSeoTitle(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">SEO Meta Description</label>
                  <input
                    type="text"
                    className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                    placeholder="Short description snippet showing in Google search results"
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">OpenGraph Preview Image URL</label>
                    <input
                      type="text"
                      className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                      placeholder="https://example.com/og-image.jpg"
                      value={ogImage}
                      onChange={(e) => setOgImage(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">SEO Keywords (Comma Separated)</label>
                    <input
                      type="text"
                      className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                      placeholder="buy denim shirt, handloom cotton wear"
                      value={seoKeywordsInput}
                      onChange={(e) => setSeoKeywordsInput(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Trust section */}
              <div className="space-y-4 pt-4 border-t border-stone-100">
                <div className="border-b border-stone-100 pb-2">
                  <h3 className="text-md font-semibold text-stone-900">Trust, Policies & Certifications</h3>
                  <p className="text-xs text-muted-foreground">Add certifications and listing guarantee guidelines.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Warranty Details</label>
                    <input
                      type="text"
                      className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                      placeholder="e.g. 6 months manufacturer stitching warranty"
                      value={warrantyInfo}
                      onChange={(e) => setWarrantyInfo(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Certifications (Comma Separated)</label>
                    <input
                      type="text"
                      className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                      placeholder="Organic Cotton certified, FairTrade, GOTS"
                      value={certificationsInput}
                      onChange={(e) => setCertificationsInput(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Return Policy</label>
                    <input
                      type="text"
                      className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                      placeholder="e.g. Easy 7-day hassle-free return policy"
                      value={returnPolicy}
                      onChange={(e) => setReturnPolicy(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-stone-600 uppercase tracking-wider block">Replacement Policy</label>
                    <input
                      type="text"
                      className="w-full h-10 border border-input rounded-md px-3 text-sm focus:border-stone-900 focus:outline-none"
                      placeholder="e.g. Size replacement available if request raised in 48 hours"
                      value={replacementPolicy}
                      onChange={(e) => setReplacementPolicy(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form Action Controls */}
          <div className="flex items-center justify-between border-t border-stone-200 pt-6 mt-8">
            <div className="flex gap-4 items-center">
              {/* Back Button (Middle & Final Stages) */}
              {!isFirstTab && (
                <button
                  type="button"
                  onClick={() => handleTabChange(TABS[currentTabIndex - 1].id)}
                  className="rounded-md border border-input px-6 py-2.5 text-xs uppercase tracking-wider font-semibold text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  Back
                </button>
              )}

              {/* Next Button (First & Middle Stages) */}
              {!isLastTab && (
                <button
                  type="button"
                  onClick={() => handleTabChange(TABS[currentTabIndex + 1].id)}
                  className="rounded-md bg-stone-900 px-6 py-2.5 text-xs uppercase tracking-wider font-semibold text-white hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stone-900 transition-colors"
                >
                  Next
                </button>
              )}

              {/* Submit / Create Button (Final Stage only) */}
              {isLastTab && (
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-md bg-stone-900 px-6 py-2.5 text-xs uppercase tracking-wider font-semibold text-white hover:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stone-900 disabled:opacity-50 transition-colors"
                >
                  {isPending ? "Saving..." : initialData ? "Save Changes" : "Create Product"}
                </button>
              )}

              {/* Cancel Button (All stages) */}
              <button
                type="button"
                onClick={() => router.push("/seller/products")}
                className="rounded-md border border-input px-6 py-2.5 text-xs uppercase tracking-wider font-semibold text-stone-600 hover:bg-stone-50 transition-colors"
              >
                Cancel
              </button>
            </div>
            
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <span className="text-stone-500">Moderation State:</span>
              <select
                className="h-9 border border-input rounded px-2 bg-stone-50 font-bold text-stone-900 uppercase"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProductStatus)}
                required
              >
                <option value="PENDING_REVIEW">Active (Awaiting Review)</option>
                <option value="DRAFT">Draft</option>
                <option value="INACTIVE">Inactive</option>
                {status === "ACTIVE" && (
                  <option value="ACTIVE" disabled>Active (Approved)</option>
                )}
                {status === "REJECTED" && (
                  <option value="REJECTED" disabled>Rejected</option>
                )}
              </select>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
