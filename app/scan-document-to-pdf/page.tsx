import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Scan Document to PDF – Free Online Tool | VidScan",
  description: "Record a video of any document — contracts, forms, receipts — and convert it to PDF instantly. No scanner hardware needed.",
  alternates: { canonical: "/scan-document-to-pdf" },
};

export default function ScanDocumentPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-4 py-20 space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-extrabold text-gray-900">Scan Document to PDF</h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            No scanner? No problem. Use your phone camera to record any document and
            convert it to a clean PDF — contracts, receipts, forms, and more.
          </p>
          <Link href="/convert" id="cta-doc" className="inline-flex rounded-xl bg-blue-600 px-8 py-4 font-semibold text-white transition hover:bg-blue-700">
            Scan a Document →
          </Link>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900">Best practices for clean scans</h2>
          <ul className="space-y-3 text-gray-500 text-sm list-disc list-inside leading-relaxed">
            <li>Use bright, even lighting — avoid shadows across the document.</li>
            <li>Hold the camera directly above the document, parallel to the surface.</li>
            <li>Film slowly — hold each page still for about 1 second.</li>
            <li>Make sure the document is flat and readable.</li>
          </ul>
        </section>

        <div className="rounded-xl border border-blue-100 bg-blue-50 px-6 py-5 space-y-2">
          <h2 className="font-bold text-gray-900">Works with any document type</h2>
          <div className="flex flex-wrap gap-2 text-sm text-blue-700">
            {["Contracts", "Receipts", "Forms", "IDs", "Letters", "Notebooks", "Invoices", "Certificates"].map((d) => (
              <span key={d} className="rounded-lg bg-white border border-blue-200 px-3 py-1">{d}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
