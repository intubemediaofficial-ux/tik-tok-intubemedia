import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.SITE_URL || "http://localhost:3340";
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/messages", "/inbox", "/settings", "/wallet", "/studio", "/upload"] }], sitemap: `${base}/sitemap.xml` };
}
