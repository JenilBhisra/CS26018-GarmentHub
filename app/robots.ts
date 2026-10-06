import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/product/", "/category/", "/search"],
      disallow: [
        "/account/",
        "/admin/",
        "/seller/",
        "/b2b/",
        "/api/",
        "/checkout/",
        "/cart/",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
