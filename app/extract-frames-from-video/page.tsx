import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Extract Frames from Video as PDF – VidScan",
  description:
    "Automatically extract unique frames from any video and save them as a multi-page PDF. Set the frame interval and download in seconds.",
  alternates: { canonical: "/extract-frames-from-video" },
};

export default function ExtractFramesPage() {
  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-20">
      <div className="w-full max-w-2xl space-y-10">

        <div className="text-center space-y-4">
          <span className="inline-block rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-1 text-sm text-fuchsia-300">
            Smart frame deduplication
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">
            Extract Frames from Video &amp; Save as PDF
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            VidScan automatically samples your video, drops near-duplicate
            frames using pixel-difference analysis, and compiles the unique
            frames into a single PDF document.
          </p>
          <Link
            href="/convert"
            id="cta-extract-frames"
            className="inline-flex rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-8 py-4 font-semibold text-white shadow-lg transition hover:scale-105"
          >
            Extract frames now →
          </Link>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">How frame extraction works</h2>
          <ol className="space-y-3 text-gray-400 text-sm leading-relaxed list-decimal list-inside">
            <li>Upload your video or record directly from the browser camera.</li>
            <li>The tool automatically processes your frames at the optimal rate.</li>
            <li>The backend samples frames and computes pixel differences to skip duplicates.</li>
            <li>Unique frames are bundled into a PDF using the img2pdf library.</li>
            <li>Download the PDF — your file is deleted from our server immediately.</li>
          </ol>
        </section>

        <section className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: "⚡", title: "Fast processing", body: "Frames are extracted server-side in seconds, even for long videos." },
            { icon: "🎯", title: "Smart deduplication", body: "Only visually distinct frames end up in the PDF — no blurry copies." },
            { icon: "🔒", title: "Privacy first", body: "Videos are processed and permanently deleted after conversion." },
            { icon: "📐", title: "Perspective warping", body: "Warp skewed angles back into flat, document-style layouts." },
          ].map(({ icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-gray-800 bg-gray-900 p-5 space-y-1">
              <div className="text-2xl">{icon}</div>
              <h3 className="font-semibold text-white text-sm">{title}</h3>
              <p className="text-xs text-gray-400">{body}</p>
            </div>
          ))}
        </section>

      </div>
    </div>
  );
}
