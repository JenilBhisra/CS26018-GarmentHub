import { SmartImage } from "@/components/site/smart-image";
import Link from "next/link";
import { ArrowRight, Truck, Store, Package, ShieldCheck } from "lucide-react";
import { CustomerLayout } from "@/components/site/layout";
import { ProductCard } from "@/components/site/product-card";
import { prisma } from "@/lib/prisma";
import { mapDbProductToMockProduct } from "@/lib/db-mappers";
import { CATEGORIES, HERO_SLIDES, LOCAL_STORES, type Product } from "@/lib/mock-data";
import { trackPageView } from "@/actions/analytics";
import { unstable_cache } from "next/cache";

export default Home;

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

const getCachedTrending = unstable_cache(
  async () => {
    const dbProducts = await prisma.product.findMany({
      where: { status: "ACTIVE", isB2BEnabled: false },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: productSelect,
    });
    return dbProducts.map((p) => mapDbProductToMockProduct(p as any));
  },
  ["homepage-trending-v2"],
  { revalidate: 30, tags: ["products", "homepage"] }
);

const getCachedBestsellers = unstable_cache(
  async () => {
    const dbProducts = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { isFeatured: true },
          { tags: { has: "bestseller" } }
        ]
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: productSelect,
    });
    return dbProducts.map((p) => mapDbProductToMockProduct(p as any));
  },
  ["homepage-bestsellers-v2"],
  { revalidate: 30, tags: ["products", "homepage"] }
);

const getCachedNewArrivals = unstable_cache(
  async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dbProducts = await prisma.product.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { createdAt: { gte: thirtyDaysAgo } },
          { tags: { has: "new" } }
        ]
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: productSelect,
    });
    return dbProducts.map((p) => mapDbProductToMockProduct(p as any));
  },
  ["homepage-new-arrivals-v2"],
  { revalidate: 30, tags: ["products", "homepage"] }
);

const getCachedB2B = unstable_cache(
  async () => {
    const dbProducts = await prisma.product.findMany({
      where: { status: "ACTIVE", isB2BEnabled: true },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: productSelect,
    });
    return dbProducts.map((p) => mapDbProductToMockProduct(p as any));
  },
  ["homepage-b2b-v2"],
  { revalidate: 30, tags: ["products", "homepage"] }
);

async function Home() {
  await trackPageView("HOMEPAGE");
  const [trending, bestsellers, newArrivals, b2b] = await Promise.all([
    getCachedTrending(),
    getCachedBestsellers(),
    getCachedNewArrivals(),
    getCachedB2B(),
  ]);

  const hero = HERO_SLIDES[0];

  return (
    <CustomerLayout>
      {/* Hero */}
      <section className="container-page pt-6">
        <div className="relative overflow-hidden rounded-xl h-[60vh] min-h-[420px] w-full">
          <SmartImage
            src={hero.image}
            alt=""
            priority
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-background/10 to-transparent" />
          <div className="absolute inset-0 flex items-center">
            <div className="container-page">
              <div className="max-w-md">
                <span className="text-xs uppercase tracking-[0.2em] text-foreground/70">Curated for SS26</span>
                <h1 className="mt-3 font-display text-4xl leading-[1.05] sm:text-5xl md:text-6xl">{hero.title}</h1>
                <p className="mt-3 text-sm text-foreground/70 sm:text-base">{hero.subtitle}</p>
                <Link href={hero.href} className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90">
                  {hero.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="container-page mt-6 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        {[
          { Icon: Truck, label: "Free shipping over ₹999" },
          { Icon: Store, label: "1,200+ local sellers" },
          { Icon: Package, label: "Easy 7-day returns" },
          { Icon: ShieldCheck, label: "Verified brands" },
        ].map(({ Icon, label }) => (
          <div key={label} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2.5">
            <Icon className="h-4 w-4 text-accent" /><span>{label}</span>
          </div>
        ))}
      </section>

      {/* Featured categories */}
      <Section title="Shop by category" link={{ to: "/category/women", label: "View all" }}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {CATEGORIES.map((c) => (
            <Link key={c.slug} href="/category/$slug"  className="group">
              <div className="aspect-square overflow-hidden rounded-full bg-muted">
                <SmartImage src={c.image} alt={c.label} className="h-full w-full object-cover transition group-hover:scale-105" />
              </div>
              <div className="mt-2 text-center text-xs">{c.label}</div>
            </Link>
          ))}
        </div>
      </Section>

      {/* Trending */}
      <Section title="Trending now">
        <ProductGrid products={trending} />
      </Section>

      {/* Promo split */}
      <section className="container-page mt-16 grid gap-3 md:grid-cols-2">
        {[
          { tag: "Festive", title: "Handloom Banarasi Edit", img: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=1200&q=80", href: "/category/indian" },
          { tag: "Everyday", title: "Workwear Refresh", img: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80", href: "/category/western" },
        ].map((p) => (
          <Link key={p.title} href={p.href} className="group relative block overflow-hidden rounded-xl">
            <SmartImage src={p.img} alt="" className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-foreground/10 to-transparent" />
            <div className="absolute bottom-5 left-5 text-background">
              <div className="text-xs uppercase tracking-widest opacity-80">{p.tag}</div>
              <div className="font-display text-2xl">{p.title}</div>
            </div>
          </Link>
        ))}
      </section>

      <Section title="Bestsellers"><ProductGrid products={bestsellers} /></Section>
      <Section title="New arrivals"><ProductGrid products={newArrivals} /></Section>

      {/* Local stores */}
      <Section title="Local stores you'll love" subtitle="Independent ateliers and small-batch makers across India">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {LOCAL_STORES.map((s) => (
            <div key={s.slug} className="group cursor-pointer">
              <div className="aspect-[4/5] overflow-hidden rounded-md bg-muted">
                <SmartImage src={s.image} alt={s.name} className="h-full w-full object-cover transition group-hover:scale-105" />
              </div>
              <div className="mt-2">
                <div className="text-sm">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.loc} · {s.products} items</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* B2B */}
      <section className="container-page mt-16">
        <div className="rounded-xl bg-muted/40 p-6 sm:p-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-widest text-accent">For businesses</div>
              <h2 className="mt-1 font-display text-3xl">B2B Wholesale</h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">Source garments in bulk from verified manufacturers. Custom MOQs, factory pricing, GST invoices.</p>
            </div>
            <Link href="/b2b" className="inline-flex items-center gap-2 rounded-full border border-foreground/20 px-5 py-2 text-sm hover:bg-foreground hover:text-background">
              Explore B2B <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {b2b.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      </section>
    </CustomerLayout>
  );
}

function Section({ title, subtitle, link, children }: { title: string; subtitle?: string; link?: { to: string; label: string }; children: React.ReactNode }) {
  return (
    <section className="container-page mt-16">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl sm:text-3xl">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {link && <Link href={link.to as never} className="text-sm text-muted-foreground hover:text-foreground">{link.label} →</Link>}
      </div>
      {children}
    </section>
  );
}

function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}
