import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Convert Book Video to PDF – Free Scanner Tool | VidScan",
  description: "Film your book pages with a phone camera and convert the video to a clean, shareable PDF instantly. No app, no signup.",
  alternates: { canonical: "/convert-book-video-to-pdf" },
};

export default function ConvertBookPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 py-20 space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-extrabold text-gray-900">Convert Book Video to PDF</h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Scan an entire book in minutes — just film the pages and upload the video.
            VidScan extracts each page as a high-quality PDF image.
          </p>
          <Link href="/convert" id="cta-book" className="inline-flex rounded-xl bg-blue-600 px-8 py-4 font-semibold text-white transition hover:bg-blue-700">
            Scan My Book →
          </Link>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">How to scan a book to PDF with video</h2>
          <ol className="space-y-3 text-gray-500 text-sm list-decimal list-inside leading-relaxed">
            <li>Open your phone camera and record a video as you flip through the pages at a steady pace.</li>
            <li>Upload the video on the Convert page.</li>
            <li>Click Convert — each unique page is automatically extracted and bundled into a PDF.</li>
            <li>Download your PDF and share, print, or archive it.</li>
          </ol>
        </section>

        <section className="grid sm:grid-cols-2 gap-4">
          {[
            { e: "📖", t: "Full books", b: "Flip at 1 page per second — capture every page with no duplicates." },
            { e: "📋", t: "Handwritten notes", b: "Works great for A4/letter notebooks and paper notes." },
            { e: "🔍", t: "Smart deduplication", b: "Blurry or duplicate frames are filtered out automatically." },
            { e: "🔒", t: "Private & secure", b: "Videos are deleted immediately after PDF generation." },
          ].map(({ e, t, b }) => (
            <div key={t} className="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-1">
              <div className="text-2xl">{e}</div>
              <p className="font-semibold text-gray-900 text-sm">{t}</p>
              <p className="text-xs text-gray-500">{b}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
