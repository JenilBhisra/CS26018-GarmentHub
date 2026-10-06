import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  // Static core routes
  const routes = [
    "",
    "/login",
    "/register",
    "/search",
    "/b2b",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: route === "" ? 1.0 : 0.8,
  }));

  // Dynamic dynamic product routes
  try {
    const products = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, updatedAt: true },
    });

    const productRoutes = products.map((p) => ({
      url: `${baseUrl}/product/${p.id}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    // Dynamic category routes
    const categories = await prisma.category.findMany({
      select: { slug: true, updatedAt: true },
    });

    const categoryRoutes = categories.map((c) => ({
      url: `${baseUrl}/category/${c.slug}`,
      lastModified: c.updatedAt || new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

    return [...routes, ...productRoutes, ...categoryRoutes];
  } catch (err) {
    console.error("Sitemap generation error:", err);
    return routes;
  }
}
