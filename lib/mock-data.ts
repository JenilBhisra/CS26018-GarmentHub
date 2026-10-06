// Centralized mock data. Replace with API calls when backend is wired.
export type Product = {
  id: string;
  name: string;
  brand: string;
  store: string;
  storeLocation: string;
  price: number;
  mrp: number;
  rating: number;
  reviews: number;
  image: string;
  images?: string[];
  description?: string;
  videoUrl?: string;
  category: string;
  subcategory?: string;
  colors: string[];
  sizes: string[];
  isB2B?: boolean;
  moq?: number;
  bulkPrice?: number;
  tags?: string[];
  sellerProfileId?: string;
  variants?: {
    id: string;
    sku: string | null;
    size: string | null;
    color: string | null;
    mrp: number;
    sellingPrice: number;
    stock: number;
    images: string[];
  }[];

  // Advanced listing optional fields
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
};

const img = (seed: string, w = 800, h = 1000) =>
  `https://images.unsplash.com/${seed}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

// Curated fashion editorial photos
const SEEDS = [
  "photo-1539109136881-3be0616acf4b", // women dress
  "photo-1503342217505-b0a15ec3261c", // men shirt
  "photo-1583743814966-8936f5b7be1a", // saree
  "photo-1591047139829-d91aecb6caea", // sneakers
  "photo-1495121605193-b116b5b9c5fe", // kids
  "photo-1542272604-787c3835535d", // jeans
  "photo-1469334031218-e382a71b716b", // jacket
  "photo-1556905055-8f358a7a47b2", // accessories
  "photo-1490481651871-ab68de25d43d", // editorial
  "photo-1483985988355-763728e1935b", // women coat
  "photo-1521572163474-6864f9cf17ab", // tshirt
  "photo-1485518882345-15568b007407", // bag
  "photo-1434389677669-e08b4cac3105", // shoes
  "photo-1572804013309-59a88b7e92f1", // sportswear
  "photo-1617137968427-85924c800a22", // kurta
  "photo-1594633312681-425c7b97ccd1", // earrings
];

const STORES = [
  { name: "Aanya Studio", loc: "Jaipur, RJ" },
  { name: "Khadi & Co.", loc: "Ahmedabad, GJ" },
  { name: "Threadwork", loc: "Mumbai, MH" },
  { name: "Maison Noir", loc: "New Delhi, DL" },
  { name: "Loom House", loc: "Bengaluru, KA" },
  { name: "Indigo Lane", loc: "Pune, MH" },
];

const BRANDS = ["Aanya", "Loom", "Noir", "Khadi Co.", "Indigo", "Atelier 21"];

const NAMES_BY_CAT: Record<string, string[]> = {
  women: ["Linen Wrap Dress", "Cotton Anarkali", "Pleated Midi Skirt", "Silk Blouse", "Block Print Kurta", "Tailored Blazer"],
  men: ["Oxford Shirt", "Slim Chinos", "Linen Kurta", "Denim Jacket", "Polo Tee", "Wool Overshirt"],
  kids: ["Cotton Romper", "Printed Tee", "Festive Lehenga", "Soft Joggers", "Cord Dungarees", "Knit Cardigan"],
  western: ["Maxi Dress", "Crop Blazer", "Cargo Trouser", "Knit Top", "Pleated Trouser", "Wrap Top"],
  indian: ["Banarasi Saree", "Chikankari Kurta", "Lehenga Set", "Sherwani", "Bandhgala", "Dupatta Set"],
  sports: ["Run Tee", "Training Shorts", "Compression Tights", "Track Jacket", "Yoga Set", "Tennis Skirt"],
  accessories: ["Leather Belt", "Silk Scarf", "Gold Hoops", "Canvas Tote", "Felt Hat", "Linen Stole"],
  footwear: ["White Sneaker", "Kolhapuri Sandal", "Loafer", "Block Heel", "Mojari", "Running Shoe"],
};

const CAT_LIST = Object.keys(NAMES_BY_CAT);

function priceFor(i: number, b2b: boolean) {
  const base = 599 + ((i * 137) % 4200);
  const mrp = Math.round(base * (1 + 0.2 + ((i * 17) % 40) / 100));
  return b2b
    ? { price: Math.round(base * 0.55), mrp, bulkPrice: Math.round(base * 0.45) }
    : { price: base, mrp };
}

export const PRODUCTS: Product[] = Array.from({ length: 48 }, (_, i) => {
  const cat = CAT_LIST[i % CAT_LIST.length];
  const names = NAMES_BY_CAT[cat];
  const name = names[i % names.length];
  const seed = SEEDS[i % SEEDS.length];
  const store = STORES[i % STORES.length];
  const isB2B = i % 7 === 0;
  const { price, mrp, bulkPrice } = priceFor(i, isB2B);
  return {
    id: `p-${i + 1}`,
    name,
    brand: BRANDS[i % BRANDS.length],
    store: store.name,
    storeLocation: store.loc,
    price,
    mrp,
    rating: 3.8 + ((i * 13) % 12) / 10,
    reviews: 12 + ((i * 47) % 980),
    image: img(seed, 700, 900),
    images: [img(seed, 900, 1100), img(SEEDS[(i + 3) % SEEDS.length], 900, 1100), img(SEEDS[(i + 6) % SEEDS.length], 900, 1100)],
    category: cat,
    colors: ["#1a1a1a", "#c9a27a", "#2d4a3e", "#a83232"].slice(0, 2 + (i % 3)),
    sizes: ["XS", "S", "M", "L", "XL"].slice(0, 3 + (i % 3)),
    isB2B,
    moq: isB2B ? 25 + (i % 4) * 25 : undefined,
    bulkPrice,
    tags: i % 5 === 0 ? ["new"] : i % 4 === 0 ? ["bestseller"] : undefined,
  };
});

export const CATEGORIES = [
  { slug: "women", label: "Women", image: img(SEEDS[0], 600, 800) },
  { slug: "men", label: "Men", image: img(SEEDS[1], 600, 800) },
  { slug: "kids", label: "Kids", image: img(SEEDS[4], 600, 800) },
  { slug: "western", label: "Western Wear", image: img(SEEDS[9], 600, 800) },
  { slug: "indian", label: "Indian Wear", image: img(SEEDS[2], 600, 800) },
  { slug: "sports", label: "Sportswear", image: img(SEEDS[13], 600, 800) },
  { slug: "accessories", label: "Accessories", image: img(SEEDS[7], 600, 800) },
  { slug: "footwear", label: "Footwear", image: img(SEEDS[3], 600, 800) },
];

export const LOCAL_STORES = STORES.map((s, i) => ({
  ...s,
  slug: s.name.toLowerCase().replace(/[^a-z]/g, "-"),
  image: img(SEEDS[(i + 8) % SEEDS.length], 500, 600),
  products: 24 + i * 11,
}));

export const HERO_SLIDES = [
  {
    title: "The Linen Edit",
    subtitle: "Summer-ready essentials from independent ateliers",
    cta: "Shop Women",
    href: "/category/women",
    image: img("photo-1490481651871-ab68de25d43d", 1600, 900),
  },
  {
    title: "Handloom, reimagined",
    subtitle: "Curated weaves from Jaipur, Banaras & Kanchipuram",
    cta: "Explore Indian Wear",
    href: "/category/indian",
    image: img("photo-1583743814966-8936f5b7be1a", 1600, 900),
  },
];

export const findProduct = (id: string) => PRODUCTS.find((p) => p.id === id);
export const productsByCategory = (slug: string) =>
  PRODUCTS.filter((p) => p.category === slug);
