import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://vidscan.app").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Video to PDF Converter – Free Online Scanner Tool",
    template: "%s | VidScan",
  },
  description:
    "Convert a video of book pages or documents into a clean PDF instantly. Free, no signup required.",
  keywords: [
    "video to pdf",
    "scan book pages to pdf",
    "document scanner",
    "video scanner",
    "convert video to pdf",
    "free pdf converter",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Video to PDF Converter – Free Online Scanner Tool",
    description:
      "Convert a video of book pages or documents into a clean PDF instantly. Free, no signup required.",
    url: SITE_URL,
    siteName: "VidScan",
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "VidScan – Video to PDF Converter",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Video to PDF Converter – Free Online Scanner Tool",
    description:
      "Convert a video of book pages or documents into a clean PDF instantly. Free, no signup required.",
    images: [`${SITE_URL}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

// JSON-LD WebApplication schema — evaluated once at module load
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "VidScan – Video to PDF Converter",
  url: SITE_URL,
  description:
    "Convert a video of book pages or documents into a clean PDF instantly. Free, no signup required.",
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "Video to PDF conversion",
    "Drag and drop upload",
    "Live camera recording",
    "Frame sensitivity control",
    "No signup required",
  ],
};

// Stable year — module-scope so server and client always agree
const YEAR = new Date().getFullYear();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const adsenseId = process.env.NEXT_PUBLIC_ADSENSE_ID;
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.className} bg-white text-gray-900 antialiased`}>
        {/* JSON-LD structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <main>{children}</main>

        <footer className="border-t border-gray-200 bg-gray-50 py-8 text-center text-sm text-gray-500">
          <p>© {YEAR} VidScan. All rights reserved.</p>
          <p className="mt-1">
            Free online tool — no account, no limits.
          </p>
        </footer>

        {/* Google AdSense — afterInteractive keeps it off the critical path */}
        {adsenseId ? (
          <Script
            id="adsense-init"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}`}
            strategy="afterInteractive"
            crossOrigin="anonymous"
          />
        ) : null}

        {/* Google Analytics 4 */}
        {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
      </body>
    </html>
  );
}
