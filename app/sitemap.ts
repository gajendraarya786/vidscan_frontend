import { MetadataRoute } from "next";

const BASE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://vidscan.app").replace(/\/$/, "");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`,                        lastModified: now, changeFrequency: "monthly", priority: 1.0 },
    { url: `${BASE}/convert`,                 lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/convert-book-video-to-pdf`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/scan-document-to-pdf`,    lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/video-notes-to-pdf`,      lastModified: now, changeFrequency: "monthly", priority: 0.7 },
  ];
}
