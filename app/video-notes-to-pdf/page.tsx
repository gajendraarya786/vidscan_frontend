import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Convert Video Notes to PDF – Lecture & Tutorial Converter | VidScan",
  description: "Turn lecture recordings, tutorial videos, or whiteboard sessions into PDF slide notes. Free, fast, and browser-based.",
  alternates: { canonical: "/video-notes-to-pdf" },
};

export default function VideoNotesPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 py-20 space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-extrabold text-gray-900">Convert Video Notes to PDF</h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Recorded a lecture, tutorial, or whiteboard session? Upload the video and
            get a PDF of the key slides and notes — ready to study or share.
          </p>
          <Link href="/convert" id="cta-notes" className="inline-flex rounded-xl bg-blue-600 px-8 py-4 font-semibold text-white transition hover:bg-blue-700">
            Convert My Notes →
          </Link>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Perfect for students and professionals</h2>
          <ul className="space-y-3 text-gray-500 text-sm list-disc list-inside leading-relaxed">
            <li><strong className="text-gray-700">Lecture recordings</strong> — convert class videos into printable PDF notes.</li>
            <li><strong className="text-gray-700">Tutorial videos</strong> — extract each step as a visual reference slide.</li>
            <li><strong className="text-gray-700">Whiteboard sessions</strong> — capture brainstorm diagrams before the board is erased.</li>
            <li><strong className="text-gray-700">Screen recordings</strong> — convert software walkthroughs into documentation PDFs.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-6 space-y-3">
          <h2 className="font-bold text-gray-900">Best practices for video notes</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>🎯 <strong>Deduplication</strong> — our engine automatically skips redundant video sections to keep only distinct slides.</p>
            <p>📐 <strong>Landscape video</strong> — works best for slide-based content like PowerPoint or Google Slides recordings.</p>
            <p>🎬 <strong>Format: MP4 or WebM</strong> — most screen recorders output these by default.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
