"use client";

import { useState, useRef, ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { pageStore } from "@/lib/pageStore";
import VidScanLogo from "@/components/VidScanLogo";
import CameraRecorderModal from "@/components/CameraRecorderModal";




interface FAQItem {
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    question: "How do I scan book pages to PDF with this tool?",
    answer: "Simply record a video of your book pages using your phone camera, then upload the video here. The tool extracts one frame per page and stitches them into a PDF. You can also record live directly from your browser camera.",
  },
  {
    question: "What video formats are supported?",
    answer: "The tool supports MP4, MOV, AVI, and WebM files — the most common formats recorded by smartphones, tablets, and webcams.",
  },
  {
    question: "How long can the video be?",
    answer: "Videos up to 500 MB are supported. For long documents, we recommend recording at a steady pace — one page every 1–2 seconds — so no pages are missed.",
  },
  {
    question: "Is my video stored on your servers?",
    answer: "No. Videos are processed in memory and deleted immediately after the PDF is generated. Nothing is stored or shared.",
  },
  {
    question: "Can I convert a screen recording or lecture video to PDF notes?",
    answer: "Yes! The tool automatically detects distinct slides or frame changes. It works great for converting lecture recordings, tutorial videos, or slide presentations into shareable PDF notes.",
  },
];

export default function LandingPageClient() {
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const toggleFaq = (idx: number) => {
    setOpenFaqIdx((prev) => (prev === idx ? null : idx));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      pageStore.setPendingFile(f);
      router.push("/convert");
    }
  };

  const openCamera = () => {
    setIsCameraOpen(true);
  };

  const closeCamera = () => {
    setIsCameraOpen(false);
  };

  const handleRecordComplete = (file: File) => {
    setIsCameraOpen(false);
    pageStore.setPendingFile(file);
    router.push("/convert");
  };



  return (
    <div className="min-h-screen bg-white text-slate-800 flex flex-col font-sans select-none overflow-x-hidden relative">
      
      {/* ─── Background Blur Spots ─── */}
      <div className="absolute top-20 left-1/2 -translate-x-[250px] w-80 h-80 rounded-full bg-pink-300/10 blur-3xl pointer-events-none" />
      <div className="absolute top-40 left-1/2 translate-x-[150px] w-96 h-96 rounded-full bg-indigo-300/10 blur-3xl pointer-events-none" />
      <div className="absolute top-[60vh] left-1/2 -translate-x-10 w-96 h-96 rounded-full bg-pink-200/10 blur-3xl pointer-events-none" />

      {/* ─── Navigation Bar ─── */}
      <nav className="border-b border-slate-100 bg-white/70 backdrop-blur-md sticky top-0 z-30 transition-all">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <span className="font-extrabold text-slate-900 tracking-tight text-base flex items-center gap-2">
            <VidScanLogo size={24} />
            <span>VidScan</span>
          </span>
          <Link
            href="/convert"
            id="nav-cta"
            className="rounded-xl bg-gradient-to-r from-pink-600 to-indigo-700 hover:from-pink-500 hover:to-indigo-600 text-white px-5 py-2.5 text-xs font-extrabold transition-all shadow-md shadow-pink-600/20 active:scale-95"
          >
            Try It Free
          </Link>
        </div>
      </nav>

      {/* ─── Hero Section ─── */}
      <section className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center relative z-10">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-pink-50/80 border border-pink-100/50 px-4 py-1.5 text-xs font-semibold text-pink-700 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-pink-500 animate-pulse" />
          Free · No signup · Instant download
        </div>

        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-900 sm:text-6xl leading-[1.1]">
          Video to PDF Converter
          <span className="block mt-2.5 bg-gradient-to-r from-pink-600 to-indigo-600 bg-clip-text text-transparent">
            Free Online Tool
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-base text-slate-500 leading-relaxed font-medium">
          Point your camera at book pages, documents, or a screen — record a
          video, upload it here, and get a clean, cropped PDF in seconds.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={openCamera}
            id="capture-video-cta"
            className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-pink-600 to-indigo-700 hover:from-pink-500 hover:to-indigo-600 text-white px-9 py-5 text-sm md:text-base font-extrabold shadow-lg shadow-pink-600/25 transition-all active:scale-95 hover:shadow-xl"
          >
            <svg className="h-5.5 w-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2-2V8a2 2 0 002 2z" />
            </svg>
            Capture Video
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            id="upload-video-cta"
            className="inline-flex items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white/50 backdrop-blur-sm px-9 py-5 text-sm md:text-base font-extrabold text-slate-700 transition-all hover:border-slate-350 hover:bg-white active:scale-95 shadow-sm hover:shadow-md"
          >
            <svg className="h-5.5 w-5.5 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload Video
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>



      </section>

      {/* ─── Features Grid Section ─── */}
      <section className="bg-slate-50/50 border-y border-slate-100 py-20 relative z-10" aria-labelledby="features-heading">
        <div className="mx-auto max-w-5xl px-6">
          <h2 id="features-heading" className="sr-only">Features</h2>
          
          <div className="grid gap-6 sm:grid-cols-3">
            
            {/* Feature 1 */}
            <div className="rounded-3xl border border-slate-200/60 bg-white p-7 shadow-sm hover:shadow-md transition-all group hover:-translate-y-1">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-50/80 group-hover:scale-105 transition-transform">
                <svg className="h-5.5 w-5.5 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">No Signup Required</h3>
              <p className="mt-2.5 text-xs leading-relaxed text-slate-500 font-medium">
                Jump straight in — no account, no email, no friction. Your privacy stays intact.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-3xl border border-slate-200/60 bg-white p-7 shadow-sm hover:shadow-md transition-all group hover:-translate-y-1">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-50/80 group-hover:scale-105 transition-transform">
                <svg className="h-5.5 w-5.5 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">Lightning Fast</h3>
              <p className="mt-2.5 text-xs leading-relaxed text-slate-500 font-medium">
                Smart frame detection extracts page transitions in real-time, compiling documents in seconds.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-3xl border border-slate-200/60 bg-white p-7 shadow-sm hover:shadow-md transition-all group hover:-translate-y-1">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-50/80 group-hover:scale-105 transition-transform">
                <svg className="h-5.5 w-5.5 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">Works on Any Device</h3>
              <p className="mt-2.5 text-xs leading-relaxed text-slate-500 font-medium">
                Use it on your phone, tablet, or desktop. Runs fully inside your browser with instant processing.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ─── How It Works Section ─── */}
      <section id="how-it-works" className="mx-auto max-w-5xl px-6 py-20 relative z-10" aria-labelledby="how-heading">
        <div className="text-center">
          <h2 id="how-heading" className="text-3xl font-black text-slate-900 tracking-tight">
            How It Works
          </h2>
          <p className="mt-3 text-slate-450 font-semibold text-xs uppercase tracking-wider">
            Three simple steps. Done in under a minute.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          
          {/* Step 1 */}
          <div className="rounded-3xl border border-slate-200/60 bg-white p-7 shadow-sm hover:shadow-md transition-shadow relative">
            <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-pink-200 to-indigo-100 select-none block leading-none">
              01
            </span>
            <h3 className="mt-4 font-bold text-slate-900 text-sm">Record or Upload</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 font-medium">
              Film your book pages or documents, or upload an existing video file from your device.
            </p>
          </div>

          {/* Step 2 */}
          <div className="rounded-3xl border border-slate-200/60 bg-white p-7 shadow-sm hover:shadow-md transition-shadow relative">
            <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-pink-200 to-indigo-100 select-none block leading-none">
              02
            </span>
            <h3 className="mt-4 font-bold text-slate-900 text-sm">Auto-Extraction</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 font-medium">
              Our engine automatically scans the video, filters out blurry frames, and keeps only visually unique pages.
            </p>
          </div>

          {/* Step 3 */}
          <div className="rounded-3xl border border-slate-200/60 bg-white p-7 shadow-sm hover:shadow-md transition-shadow relative">
            <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-pink-200 to-indigo-100 select-none block leading-none">
              03
            </span>
            <h3 className="mt-4 font-bold text-slate-900 text-sm">Download Your PDF</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 font-medium">
              Hit Convert. Instantly preview pages, crop them to edges, apply enhancement filters, and download.
            </p>
          </div>

        </div>

        <div className="mt-14 text-center">
          <Link
            href="/convert"
            id="steps-cta"
            className="inline-flex rounded-2xl bg-gradient-to-r from-pink-600 to-indigo-700 hover:from-pink-500 hover:to-indigo-600 text-white px-9 py-5 text-sm md:text-base font-extrabold shadow-lg shadow-pink-600/25 transition-all active:scale-95"
          >
            Get Started — It&apos;s Free
          </Link>
        </div>
      </section>

      {/* ─── Frequently Asked Questions Section ─── */}
      <section className="bg-slate-50/50 border-t border-slate-100 py-20 relative z-10" aria-labelledby="faq-heading">
        <div className="mx-auto max-w-3xl px-6">
          <h2 id="faq-heading" className="text-center text-3xl font-black text-slate-900 tracking-tight mb-10">
            Frequently Asked Questions
          </h2>

          <div className="space-y-3.5">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaqIdx === idx;
              return (
                <div 
                  key={idx} 
                  className="rounded-2xl border border-slate-200/70 bg-white overflow-hidden shadow-sm transition-all"
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full px-6 py-4.5 text-left flex justify-between items-center text-slate-800 hover:text-slate-900 font-bold text-xs.5 md:text-sm transition-colors"
                  >
                    <span>{faq.question}</span>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center transition-transform duration-200 bg-slate-50 text-slate-500 ${isOpen ? "rotate-180 bg-pink-50 text-pink-650" : ""}`}>
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 text-slate-500 text-xs font-medium leading-relaxed animate-in fade-in duration-200">
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Bottom CTA Banner ─── */}
      <section className="mx-auto max-w-3xl px-6 py-24 text-center relative z-10">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">
          Ready to scan your documents?
        </h2>
        <p className="mt-3 text-slate-500 font-medium text-sm">
          No account needed. Upload a video and download your PDF in seconds.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={openCamera}
            id="bottom-capture-cta"
            className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-pink-600 to-indigo-700 hover:from-pink-500 hover:to-indigo-600 text-white px-9 py-5 text-sm md:text-base font-extrabold shadow-lg shadow-pink-600/25 transition-all active:scale-95 hover:shadow-xl"
          >
            <svg className="h-5.5 w-5.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2-2V8a2 2 0 002 2z" />
            </svg>
            Capture Video
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            id="bottom-upload-cta"
            className="inline-flex items-center justify-center gap-2.5 rounded-2xl border border-slate-200 bg-white/50 backdrop-blur-sm px-9 py-5 text-sm md:text-base font-extrabold text-slate-700 transition-all hover:border-slate-350 hover:bg-white active:scale-95 shadow-sm hover:shadow-md"
          >
            <svg className="h-5.5 w-5.5 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload Video
          </button>
        </div>

      </section>

      {/* ─── Footer Section ─── */}
      <footer className="border-t border-slate-100 bg-slate-50/50 py-8 relative z-10 text-center">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
          &copy; {new Date().getFullYear()} VidScan. All rights reserved.
        </p>
      </footer>

      {/* ─── Camera Recorder Modal ─── */}
      {isCameraOpen && (
        <CameraRecorderModal
          onClose={closeCamera}
          onRecordComplete={handleRecordComplete}
        />
      )}

    </div>
  );
}

