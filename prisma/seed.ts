import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CATEGORIES = [
  { slug: "women", name: "Women", image: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=600&h=800&q=80" },
  { slug: "men", name: "Men", image: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=600&h=800&q=80" },
  { slug: "kids", name: "Kids", image: "https://images.unsplash.com/photo-1495121605193-b116b5b9c5fe?auto=format&fit=crop&w=600&h=800&q=80" },
  { slug: "western", name: "Western Wear", image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=600&h=800&q=80" },
  { slug: "indian", name: "Indian Wear", image: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=600&h=800&q=80" },
  { slug: "sports", name: "Sportswear", image: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=600&h=800&q=80" },
  { slug: "accessories", name: "Accessories", image: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=600&h=800&q=80" },
  { slug: "footwear", name: "Footwear", image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&h=800&q=80" },
];

const STORES = [
  { name: "Aanya Studio", slug: "aanya-studio", loc: "Jaipur, RJ" },
  { name: "Khadi & Co.", slug: "khadi-co", loc: "Ahmedabad, GJ" },
  { name: "Threadwork", slug: "threadwork", loc: "Mumbai, MH" },
  { name: "Maison Noir", slug: "maison-noir", loc: "New Delhi, DL" },
  { name: "Loom House", slug: "loom-house", loc: "Bengaluru, KA" },
  { name: "Indigo Lane", slug: "indigo-lane", loc: "Pune, MH" },
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

const SEEDS = [
  "photo-1539109136881-3be0616acf4b",
  "photo-1503342217505-b0a15ec3261c",
  "photo-1583743814966-8936f5b7be1a",
  "photo-1591047139829-d91aecb6caea",
  "photo-1495121605193-b116b5b9c5fe",
  "photo-1542272604-787c3835535d",
  "photo-1469334031218-e382a71b716b",
  "photo-1556905055-8f358a7a47b2",
  "photo-1490481651871-ab68de25d43d",
  "photo-1483985988355-763728e1935b",
  "photo-1521572163474-6864f9cf17ab",
  "photo-1485518882345-15568b007407",
  "photo-1434389677669-e08b4cac3105",
  "photo-1572804013309-59a88b7e92f1",
  "photo-1617137968427-85924c800a22",
  "photo-1594633312681-425c7b97ccd1",
];

const img = (seed: string, w = 800, h = 1000) =>
  `https://images.unsplash.com/${seed}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

const CAT_LIST = Object.keys(NAMES_BY_CAT);

function priceFor(i: number, b2b: boolean) {
  const base = 599 + ((i * 137) % 4200);
  const mrp = Math.round(base * (1 + 0.2 + ((i * 17) % 40) / 100));
  return b2b
    ? { price: Math.round(base * 0.55), mrp, bulkPrice: Math.round(base * 0.45) }
    : { price: base, mrp };
}

async function main() {
  // Test account password comes from the environment so no credential lives in the repo.
  const testPassword = process.env.SEED_TEST_PASSWORD;
  if (!testPassword) {
    throw new Error("SEED_TEST_PASSWORD is not set. Add it to .env before running the seed.");
  }

  console.log("Seeding started...");

  // 0. Ensure the native GarmentHub sales channel exists (Phase 16 — multi-channel foundation)
  await prisma.salesChannel.upsert({
    where: { code: "GARMENTHUB" },
    update: {},
    create: {
      code: "GARMENTHUB",
      name: "GarmentHub",
      type: "NATIVE",
      isActive: true,
    },
  });

  // 1. Create Admin User
  await prisma.user.upsert({
    where: { email: "admin@garmenthub.com" },
    update: {},
    create: {
      email: "admin@garmenthub.com",
      name: "Super Admin",
      role: "ADMIN",
    },
  });

  // Test Accounts Password Hash
  const testPasswordHash = bcrypt.hashSync(testPassword, 12);

  // ADMIN Test User
  await prisma.user.upsert({
    where: { email: "admin@garmenthub.local" },
    update: {
      passwordHash: testPasswordHash,
    },
    create: {
      email: "admin@garmenthub.local",
      name: "Test Admin",
      role: "ADMIN",
      passwordHash: testPasswordHash,
    },
  });

  // CUSTOMER Test User
  await prisma.user.upsert({
    where: { email: "customer@garmenthub.local" },
    update: {
      passwordHash: testPasswordHash,
    },
    create: {
      email: "customer@garmenthub.local",
      name: "Test Customer",
      role: "CUSTOMER",
      passwordHash: testPasswordHash,
    },
  });

  // SELLER Test User & Profile & Wallet
  const sellerUser = await prisma.user.upsert({
    where: { email: "seller@garmenthub.local" },
    update: {
      passwordHash: testPasswordHash,
    },
    create: {
      email: "seller@garmenthub.local",
      name: "Test Seller",
      role: "SELLER",
      passwordHash: testPasswordHash,
    },
  });

  const sellerProfile = await prisma.sellerProfile.upsert({
    where: { userId: sellerUser.id },
    update: {
      approvalStatus: "APPROVED",
    },
    create: {
      userId: sellerUser.id,
      storeName: "Test Seller Store",
      storeSlug: "test-seller",
      pickupAddress: "123, Fashion Street, Jaipur, RJ",
      approvalStatus: "APPROVED",
      commissionRate: 0.10,
      GSTIN: "29AAAAA1111A1Z1",
      PAN: "ABCDE1234F",
      Aadhaar: "123456789012",
      bankAccountHolder: "Test Seller",
      bankAccountNumber: "99990123456789",
      bankIFSC: "UTIB0000123",
      bankName: "Axis Bank",
      verifiedAt: new Date(),
    },
  });

  await prisma.sellerWallet.upsert({
    where: { sellerId: sellerProfile.id },
    update: {},
    create: {
      sellerId: sellerProfile.id,
      availableBalance: 5000,
      pendingBalance: 5000,
      totalEarned: 5000,
    },
  });

  const existingSeedLedger = await prisma.ledgerEntry.findFirst({
    where: { reference: `seed_earning_${sellerProfile.id}_CUSTOMER_PAYMENTS` }
  });
  if (!existingSeedLedger) {
    await prisma.ledgerEntry.createMany({
      data: [
        {
          transactionId: `seed_tx_${sellerProfile.id}`,
          accountName: "CUSTOMER_PAYMENTS",
          debit: 5000,
          credit: 0,
          reference: `seed_earning_${sellerProfile.id}_CUSTOMER_PAYMENTS`,
          description: "Seeded initial customer payments",
        },
        {
          transactionId: `seed_tx_${sellerProfile.id}`,
          accountName: `SELLER_PENDING:${sellerProfile.id}`,
          debit: 0,
          credit: 5000,
          reference: `seed_earning_${sellerProfile.id}_SELLER_PENDING`,
          description: "Seeded initial pending balance",
        }
      ]
    });
  }

  // B2B_VENDOR Test User & Profile
  const b2bUser = await prisma.user.upsert({
    where: { email: "b2b@garmenthub.local" },
    update: {
      passwordHash: testPasswordHash,
    },
    create: {
      email: "b2b@garmenthub.local",
      name: "Test B2B Vendor",
      role: "B2B_VENDOR",
      passwordHash: testPasswordHash,
    },
  });

  await prisma.b2BProfile.upsert({
    where: { userId: b2bUser.id },
    update: {
      approvalStatus: "APPROVED",
    },
    create: {
      userId: b2bUser.id,
      companyName: "Test B2B Company",
      companySlug: "test-b2b",
      GSTIN: "29AAAAA1111A1Z1",
      PAN: "ABCDE1234F",
      address: "456, Business Road, Ahmedabad, GJ",
      approvalStatus: "APPROVED",
      verifiedAt: new Date(),
    },
  });

  // 2. Create Categories
  const dbCategories: Record<string, { id: string; name: string; slug: string }> = {};
  for (const cat of CATEGORIES) {
    const dbCat = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, image: cat.image },
      create: { name: cat.name, slug: cat.slug, image: cat.image },
    });
    dbCategories[cat.slug] = dbCat;
  }
  console.log(`Seeded ${Object.keys(dbCategories).length} categories.`);

  // 3. Create Sellers
  const dbSellers: Record<string, { id: string; userId: string; storeName: string; storeSlug: string }> = {};
  for (const store of STORES) {
    const user = await prisma.user.upsert({
      where: { email: `${store.slug}@garmenthub.com` },
      update: {},
      create: {
        email: `${store.slug}@garmenthub.com`,
        name: store.name,
        role: "SELLER",
      },
    });

    const profile = await prisma.sellerProfile.upsert({
      where: { userId: user.id },
      update: {
        storeName: store.name,
        storeSlug: store.slug,
        approvalStatus: "APPROVED",
      },
      create: {
        userId: user.id,
        storeName: store.name,
        storeSlug: store.slug,
        pickupAddress: `123, Fashion Street, ${store.loc}`,
        approvalStatus: "APPROVED",
        commissionRate: 0.10,
        GSTIN: "29AAAAA1111A1Z1",
        PAN: "ABCDE1234F",
        Aadhaar: "123456789012",
        bankAccountHolder: store.name,
        bankAccountNumber: "99990123456789",
        bankIFSC: "UTIB0000123",
        bankName: "Axis Bank",
      },
    });

    // Create wallet
    await prisma.sellerWallet.upsert({
      where: { sellerId: profile.id },
      update: {},
      create: {
        sellerId: profile.id,
        availableBalance: 12400,
        pendingBalance: 12400,
        totalEarned: 12400,
      },
    });

    const existingLoopLedger = await prisma.ledgerEntry.findFirst({
      where: { reference: `seed_earning_${profile.id}_CUSTOMER_PAYMENTS` }
    });
    if (!existingLoopLedger) {
      await prisma.ledgerEntry.createMany({
        data: [
          {
            transactionId: `seed_tx_${profile.id}`,
            accountName: "CUSTOMER_PAYMENTS",
            debit: 12400,
            credit: 0,
            reference: `seed_earning_${profile.id}_CUSTOMER_PAYMENTS`,
            description: `Seeded initial customer payments for ${store.name}`,
          },
          {
            transactionId: `seed_tx_${profile.id}`,
            accountName: `SELLER_PENDING:${profile.id}`,
            debit: 0,
            credit: 12400,
            reference: `seed_earning_${profile.id}_SELLER_PENDING`,
            description: `Seeded initial pending balance for ${store.name}`,
          }
        ]
      });
    }

    dbSellers[store.name] = profile;
  }
  console.log(`Seeded ${Object.keys(dbSellers).length} sellers with wallets.`);

  // 4. Create Products & Variants
  let productsCount = 0;
  let variantsCount = 0;

  for (let i = 0; i < 48; i++) {
    const catSlug = CAT_LIST[i % CAT_LIST.length];
    const names = NAMES_BY_CAT[catSlug];
    const name = names[i % names.length];
    const seed = SEEDS[i % SEEDS.length];
    const store = STORES[i % STORES.length];
    const sellerProfile = dbSellers[store.name];
    const category = dbCategories[catSlug];

    const isB2B = i % 7 === 0;
    const { price, mrp, bulkPrice } = priceFor(i, isB2B);

    const images = [
      img(seed, 900, 1100),
      img(SEEDS[(i + 3) % SEEDS.length], 900, 1100),
      img(SEEDS[(i + 6) % SEEDS.length], 900, 1100),
    ];

    const productSlug = name.toLowerCase().replace(/[^a-z]/g, "-") + `-${i}`;

    const dbProduct = await prisma.product.upsert({
      where: { id: `p-${i + 1}` },
      update: {
        name,
        brand: BRANDS[i % BRANDS.length],
        images,
        status: "ACTIVE",
        isB2BEnabled: isB2B,
      },
      create: {
        id: `p-${i + 1}`,
        sellerId: sellerProfile.id,
        categoryId: category.id,
        name,
        slug: productSlug,
        brand: BRANDS[i % BRANDS.length],
        description: `Crafted in small batches with premium fabrics. Garment-washed for a soft hand-feel. Designed in India.`,
        images,
        status: "ACTIVE",
        isB2BEnabled: isB2B,
        isFeatured: i % 5 === 0,
        rating: 3.8 + ((i * 13) % 12) / 10,
        reviewsCount: 12 + ((i * 47) % 980),
      },
    });

    productsCount++;

    const colors = ["#1a1a1a", "#c9a27a", "#2d4a3e", "#a83232"].slice(0, 2 + (i % 3));
    const sizes = ["XS", "S", "M", "L", "XL"].slice(0, 3 + (i % 3));

    for (const color of colors) {
      for (const size of sizes) {
        const sku = `SKU-P${i + 1}-${color.replace("#", "")}-${size}`;
        await prisma.productVariant.upsert({
          where: { sku },
          update: {
            mrp,
            sellingPrice: price,
            stock: 25,
          },
          create: {
            productId: dbProduct.id,
            sku,
            size,
            color,
            mrp,
            sellingPrice: price,
            stock: 25,
            moq: isB2B ? 25 + (i % 4) * 25 : null,
            bulkPrice: isB2B ? bulkPrice : null,
          },
        });
        variantsCount++;
      }
    }
  }

  console.log(`Seeded ${productsCount} products and ${variantsCount} variants.`);
  console.log("Seeding completed successfully.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
