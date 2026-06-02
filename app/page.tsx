import type { Metadata } from "next";
import LandingPageClient from "@/components/LandingPageClient";

export const metadata: Metadata = {
  title: "VidScan Video to PDF Scanner – Free Online Scanner Tool",
  description:
    "Convert video lectures, screen recordings, or book pages into clean PDFs instantly. Free, no signup required.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return <LandingPageClient />;
}
