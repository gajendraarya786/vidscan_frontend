import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Convert Screen Recording to PDF Slides – VidScan",
  description:
    "Turn any screen recording into a PDF slide deck instantly. Perfect for sharing tutorials, demos, and presentations without large video files.",
  alternates: { canonical: "/screen-recording-to-pdf" },
};

export default function ScreenRecordingToPdfPage() {
  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-20">
      <div className="w-full max-w-2xl space-y-10">

        <div className="text-center space-y-4">
          <span className="inline-block rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1 text-sm text-emerald-300">
            Perfect for tutorials &amp; demos
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">
            Convert Screen Recordings to PDF Slides
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Stop sending bulky video files. Upload your screen recording and
            VidScan converts it into a lightweight PDF slide deck — ideal for
            sharing with teams, students, or clients.
          </p>
          <Link
            href="/convert"
            id="cta-screen-recording"
            className="inline-flex rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-8 py-4 font-semibold text-white shadow-lg transition hover:scale-105"
          >
            Convert recording →
          </Link>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">Common use cases</h2>
          <ul className="space-y-3 text-gray-400 text-sm leading-relaxed list-disc list-inside">
            <li><strong className="text-gray-200">Software tutorials</strong> — export every meaningful step as a slide.</li>
            <li><strong className="text-gray-200">Product demos</strong> — create a shareable PDF summary for stakeholders.</li>
            <li><strong className="text-gray-200">Online lectures</strong> — turn recorded sessions into printable notes.</li>
            <li><strong className="text-gray-200">Bug reports</strong> — attach a concise visual timeline instead of a video.</li>
          </ul>
        </section>

        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-6 space-y-3">
          <h2 className="text-lg font-bold text-white">Browser camera recorder included</h2>
          <p className="text-sm text-gray-400">
            No screen-recording software? Use the built-in <strong className="text-gray-200">Record Camera</strong> mode
            on the convert page to capture directly from your webcam or
            device camera, then convert to PDF in one click.
          </p>
          <Link href="/convert" className="inline-block text-sm text-violet-400 hover:underline underline-offset-2 transition">
            Try the recorder →
          </Link>
        </section>

      </div>
    </div>
  );
}
