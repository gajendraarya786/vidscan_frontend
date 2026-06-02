import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Free Video to PDF Converter Online – VidScan",
  description:
    "Convert any video file to a PDF of its unique frames — completely free, no sign-up required. Supports MP4, MOV, AVI, and WebM.",
  alternates: { canonical: "/video-to-pdf" },
};

export default function VideoToPdfPage() {
  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-20">
      <div className="w-full max-w-2xl space-y-10">

        <div className="text-center space-y-4">
          <span className="inline-block rounded-full border border-violet-500/40 bg-violet-500/10 px-4 py-1 text-sm text-violet-300">
            Free · No sign-up · Instant download
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">
            Free Video to PDF Converter Online
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            VidScan extracts visually unique frames from your video automatically
            and bundles them into a clean, shareable PDF — completely free.
          </p>
          <Link
            href="/convert"
            id="cta-video-to-pdf"
            className="inline-flex rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-8 py-4 font-semibold text-white shadow-lg transition hover:scale-105"
          >
            Convert a video now →
          </Link>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">Why convert video to PDF?</h2>
          <ul className="space-y-3 text-gray-400 list-disc list-inside text-sm leading-relaxed">
            <li>Share lecture or tutorial highlights without sending a large video file.</li>
            <li>Archive training videos as printable slide decks.</li>
            <li>Create visual summaries of product demos or walkthroughs.</li>
            <li>Extract storyboard frames from film or animation projects.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6 space-y-3">
          <h2 className="text-lg font-bold text-white">Supported formats</h2>
          <div className="flex flex-wrap gap-2">
            {["MP4", "MOV", "AVI", "WebM"].map((f) => (
              <span key={f} className="rounded-lg bg-gray-800 border border-gray-700 px-3 py-1 text-sm font-mono text-gray-300">
                {f}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-500">Files up to 500 MB. Processing happens server-side and files are deleted immediately.</p>
        </section>

      </div>
    </div>
  );
}
