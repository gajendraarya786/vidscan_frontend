"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  DragEvent,
  ChangeEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdUnit from "@/components/AdUnit";
import ProgressBar from "@/components/ProgressBar";
import { pageStore } from "@/lib/pageStore";
import type { ScannedPageItem } from "@/lib/pageStore";
import { supabase } from "@/lib/supabaseClient";
import VidScanLogo from "@/components/VidScanLogo";


/* ─── constants ─── */
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const AD_SLOT_BOTTOM = process.env.NEXT_PUBLIC_AD_SLOT_BOTTOM ?? "";
const ACCEPTED_MIME = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"];
const ACCEPTED_EXT  = ".mp4,.mov,.avi,.webm";
const MAX_MB        = 500;

/* ─── types ─── */
type Tab          = "upload" | "record";
type RecordState  = "idle" | "requesting" | "recording" | "stopped";
type ConvertState = "idle" | "uploading" | "processing" | "success" | "error";

/* ─── helpers ─── */
function fmtSize(b: number) {
  return b >= 1_048_576 ? (b / 1_048_576).toFixed(1) + " MB" : (b / 1024).toFixed(0) + " KB";
}
function fmtTime(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/* ═══════════════════════════════════════════════════════════════ */
export default function ConvertPage() {
  const router = useRouter();

  /* ── tab ── */
  const [tab, setTab] = useState<Tab>("upload");

  /* ── shared file state ── */
  const [file, setFile]       = useState<File | null>(null);
  const [isDrag, setIsDrag]   = useState(false);
  const fileInputRef          = useRef<HTMLInputElement>(null);

  /* ── camera / recorder ── */
  const [recState, setRecState]   = useState<RecordState>("idle");
  const [recSecs, setRecSecs]     = useState(0);
  const streamRef                 = useRef<MediaStream | null>(null);
  const mrRef                     = useRef<MediaRecorder | null>(null);
  const chunksRef                 = useRef<Blob[]>([]);
  const timerRef                  = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoPreviewRef           = useRef<HTMLVideoElement>(null);

  /* ── conversion ── */
  const [convState, setConvState]   = useState<ConvertState>("idle");
  const [progress, setProgress]     = useState(0);
  const [progressLabel, setProgressLabel] = useState("Uploading…");
  const [errorMsg, setErrorMsg]     = useState("");
  const [pdfUrl, setPdfUrl]         = useState("");
  const [pdfName]       = useState("vidscan.pdf");
  const [pageCount, setPageCount]   = useState<number | null>(null);

  /* ─── file validation ─── */
  const validate = (f: File): string | null => {
    if (!ACCEPTED_MIME.includes(f.type) && f.type !== "") return "Unsupported format. Use MP4, MOV, AVI, or WebM.";
    if (f.size > MAX_MB * 1_048_576) return `File exceeds ${MAX_MB} MB.`;
    return null;
  };

  const acceptFile = useCallback((f: File) => {
    const err = validate(f);
    if (err) { setErrorMsg(err); return; }
    setFile(f);
    setErrorMsg("");
    setConvState("idle");
    setPdfUrl("");
  }, []);

  /* ─── drag-drop ─── */
  const onDragOver  = useCallback((e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDrag(true); }, []);
  const onDragLeave = useCallback(() => setIsDrag(false), []);
  const onDrop      = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) acceptFile(f);
  }, [acceptFile]);
  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) acceptFile(f);
  };

  /* ─── camera ─── */
  const openCamera = async () => {
    setRecState("requesting");
    setErrorMsg("");

    // Try to request the highest resolution the device camera supports.
    // Using { ideal } lets the browser pick the best it can — it never rejects.
    const highQualityConstraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: "environment" }, // prefer rear camera on mobile
        width:       { ideal: 3840, min: 640 },  // 4K → 1080p → 720p → whatever fits
        height:      { ideal: 2160, min: 480 },
        frameRate:   { ideal: 30, min: 15 },
        // Ask for the sharpest focus mode available
        // @ts-ignore — advanced constraints not in all TS lib versions
        focusMode:   { ideal: "continuous" },
      },
      audio: false,
    };

    const fallbackConstraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: "environment" },
        width:  { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    };

    const tryOpen = async (constraints: MediaStreamConstraints) => {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Log the actual track settings so we can debug in the console
      const track = stream.getVideoTracks()[0];
      console.info("[VidScan] Camera track settings:", track.getSettings());

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.muted = true;
        videoPreviewRef.current.play();
      }
      setRecState("idle");
    };

    try {
      await tryOpen(highQualityConstraints);
    } catch (err) {
      console.warn("[VidScan] High-quality constraints failed, falling back:", err);
      try {
        await tryOpen(fallbackConstraints);
      } catch {
        setErrorMsg("Camera access denied. Please allow camera permissions and try again.");
        setRecState("idle");
      }
    }
  };

  const startRec = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];

    // Pick best supported codec — VP9 is highest quality, fall back to VP8 / H.264
    const mime = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4",
    ].find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm";

    // Detect the actual resolution being captured so we can set an appropriate bitrate
    const track = streamRef.current.getVideoTracks()[0];
    const { width = 1280, height = 720 } = track.getSettings();
    const pixels = (width ?? 1280) * (height ?? 720);

    // Scale bitrate with resolution: ~8 Mbps for 1080p, ~20 Mbps for 4K
    const videoBitsPerSecond = Math.round((pixels / (1920 * 1080)) * 8_000_000);

    const mr = new MediaRecorder(streamRef.current, {
      mimeType: mime,
      videoBitsPerSecond: Math.max(4_000_000, Math.min(videoBitsPerSecond, 25_000_000)),
    });

    console.info(`[VidScan] Recording ${width}x${height} @ ~${Math.round(videoBitsPerSecond / 1_000_000)} Mbps | codec: ${mime}`);

    mrRef.current = mr;
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      const ext  = mime.includes("mp4") ? "mp4" : "webm";
      acceptFile(new File([blob], `recording.${ext}`, { type: mime }));
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
    };
    mr.start(250);
    setRecState("recording");
    setRecSecs(0);
    timerRef.current = setInterval(() => setRecSecs((s) => s + 1), 1000);
  };

  const stopRec = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mrRef.current?.stop();
    setRecState("stopped");
  };

  /* ─── cleanup ─── */
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  /* ─── initialization ─── */
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab") as Tab | null;
      if (tabParam === "record") {
        setTab("record");
        openCamera();
      } else if (tabParam === "upload") {
        setTab("upload");
      }

      const pending = pageStore.getPendingFile();
      if (pending) {
        setTab("upload");
        acceptFile(pending);
        pageStore.clearPendingFile();
        handleConvert(pending);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const switchTab = (t: Tab) => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recState === "recording") mrRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setRecState("idle");
    setRecSecs(0);
    setTab(t);
    setFile(null);
    setErrorMsg("");
    setConvState("idle");
    setPdfUrl("");
  };

  /* ─── convert ─── */
  const handleConvert = async (fileOverride?: File) => {
    const fileToUse = (fileOverride instanceof File) ? fileOverride : file;
    if (!fileToUse) return;
    setConvState("uploading");
    setProgress(0);
    setProgressLabel("Uploading…");
    setErrorMsg("");
    setPdfUrl("");
    setPageCount(null);

    try {
      const fileExt = fileToUse.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(4)}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Supabase is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.");
      }

      // Step 1: Upload directly to Supabase Storage with progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${supabaseUrl}/storage/v1/object/vidscan/${filePath}`);
        xhr.setRequestHeader("Authorization", `Bearer ${supabaseAnonKey}`);
        xhr.setRequestHeader("apikey", supabaseAnonKey);

        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setProgress(Math.round((ev.loaded / ev.total) * 70));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Storage upload failed: ${xhr.statusText} (${xhr.status})`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during file upload."));
        
        const form = new FormData();
        form.append("file", fileToUse);
        xhr.send(form);
      });

      // Step 2: Create a job row in Supabase 'jobs' table
      setProgress(75);
      setProgressLabel("Registering job…");

      const videoUrl = `${supabaseUrl}/storage/v1/object/public/vidscan/${filePath}`;

      const { data: job, error: dbError } = await supabase
        .from("jobs")
        .insert({
          video_url: videoUrl,
          status: "pending",
        })
        .select()
        .single();

      if (dbError || !job) {
        throw new Error(dbError?.message || "Failed to create database record for this job.");
      }

      const jobId = job.id;

      // Step 3: Trigger the FastAPI background processing endpoint
      setProgress(80);
      setProgressLabel("Initiating processing…");

      const triggerRes = await fetch(`${API_URL}/jobs/${jobId}/process`, {
        method: "POST",
      });

      if (!triggerRes.ok) {
        const errObj = await triggerRes.json().catch(() => ({}));
        throw new Error(errObj.detail || `Failed to start processing job (${triggerRes.status})`);
      }

      // Step 4: Poll status in Supabase Database until completion
      setConvState("processing");
      setProgressLabel("Processing…");
      setProgress(85);

      const maxPollAttempts = 120; // 5 minutes max
      let attempts = 0;
      let pages: ScannedPageItem[] | null = null;

      while (attempts < maxPollAttempts) {
        // Sleep for 2.5 seconds
        await new Promise((resolve) => setTimeout(resolve, 2500));
        attempts++;

        const { data: currentJob, error: pollError } = await supabase
          .from("jobs")
          .select("status, pages_json_url, error_message")
          .eq("id", jobId)
          .single();

        if (pollError) {
          console.error("Polling error:", pollError);
          continue;
        }

        if (currentJob.status === "completed") {
          setProgress(95);
          setProgressLabel("Loading results…");
          
          if (!currentJob.pages_json_url) {
            throw new Error("Job completed but no pages JSON URL was generated.");
          }

          // Fetch the public pages.json
          const jsonRes = await fetch(currentJob.pages_json_url);
          if (!jsonRes.ok) {
            throw new Error(`Failed to fetch pages JSON data from storage (${jsonRes.status})`);
          }
          pages = (await jsonRes.json()) as ScannedPageItem[];
          break;
        }

        if (currentJob.status === "failed") {
          throw new Error(currentJob.error_message || "Video processing failed on server.");
        }
      }

      if (!pages) {
        throw new Error("Job timed out. The server is taking too long to process this video.");
      }

      setProgress(100);
      pageStore.set(pages);
      setConvState("idle");
      router.push("/preview");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Conversion failed.");
      setConvState("error");
    }
  };

  const reset = () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setFile(null);
    setConvState("idle");
    setProgress(0);
    setErrorMsg("");
    setPdfUrl("");
    setPageCount(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ─── derived ─── */
  const isConverting = convState === "uploading" || convState === "processing";
  const canConvert   = !!file && !isConverting && convState !== "success";

  /* ══════════════════════════════ RENDER ══════════════════════════ */
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── top bar ── */}
      <nav className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link href="/" className="text-sm text-gray-500 hover:text-pink-600 transition">
            ← Back
          </Link>
          <span className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            <VidScanLogo size={20} />
            <span>VidScan</span>
          </span>
        </div>
      </nav>

      <div className="mx-auto max-w-2xl px-4 py-10 space-y-6">

        {/* ── heading ── */}
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-gray-900">
            Convert Video to PDF
          </h1>
          <p className="mt-2 text-gray-500 text-sm">
            Upload a video or record with your camera — get a clean PDF of every page.
          </p>
        </div>

        {/* ── card ── */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">

          {/* ── tabs ── */}
          <div role="tablist" className="flex border-b border-gray-200">
            {(["upload", "record"] as Tab[]).map((t) => (
              <button
                key={t}
                id={`tab-${t}`}
                role="tab"
                aria-selected={tab === t}
                onClick={() => switchTab(t)}
                className={`flex-1 py-3.5 text-sm font-medium transition-colors
                  ${tab === t
                    ? "border-b-2 border-pink-600 text-pink-600 bg-pink-50/40"
                    : "text-gray-500 hover:text-gray-700"
                  }`}
              >
                {t === "upload" ? "📂 Upload Video" : "📷 Record with Camera"}
              </button>
            ))}
          </div>

          <div className="p-6 space-y-5">

            {/* ══ UPLOAD TAB ══ */}
            {tab === "upload" && (
              <div
                id="drop-zone"
                role="button"
                tabIndex={0}
                aria-label="Drop a video file here or click to browse"
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => !file && fileInputRef.current?.click()}
                onKeyDown={(e) => e.key === "Enter" && !file && fileInputRef.current?.click()}
                className={`flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all
                  ${isDrag
                    ? "border-pink-500 bg-pink-50 scale-[1.01]"
                    : file
                    ? "border-green-500 bg-green-50 cursor-default"
                    : "border-gray-300 hover:border-pink-400 hover:bg-pink-50/30"
                  }`}
              >
                <input
                  ref={fileInputRef}
                  id="file-input"
                  type="file"
                  accept={ACCEPTED_EXT}
                  multiple
                  className="sr-only"
                  onChange={onFileChange}
                />

                {file ? (
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-2xl shrink-0">
                      🎬
                    </div>
                    <div className="text-left min-w-0">
                      <p className="font-semibold text-gray-900 truncate max-w-xs">{file.name}</p>
                      <p className="text-sm text-gray-500">{fmtSize(file.size)}</p>
                    </div>
                    <button
                      id="remove-file-btn"
                      aria-label="Remove file"
                      onClick={(e) => { e.stopPropagation(); reset(); }}
                      className="ml-2 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-100 text-3xl">
                      📹
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">
                        Drag &amp; drop your video
                      </p>
                      <p className="text-sm text-gray-500">
                        or{" "}
                        <span className="text-pink-600 underline underline-offset-2">
                          browse files
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        MP4 · MOV · AVI · WebM · max {MAX_MB} MB
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ══ RECORD TAB ══ */}
            {tab === "record" && (
              <div className="space-y-4">
                {/* live preview */}
                <div className="relative aspect-video overflow-hidden rounded-xl bg-gray-900 flex items-center justify-center">
                  <video
                    ref={videoPreviewRef}
                    id="camera-preview"
                    playsInline
                    muted
                    className="w-full h-full object-cover rounded-xl"
                  />
                  {!streamRef.current && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500">
                      <span className="text-5xl">📷</span>
                      <p className="text-sm">Camera preview</p>
                    </div>
                  )}
                  {recState === "recording" && (
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                      REC {fmtTime(recSecs)}
                    </div>
                  )}
                  {recState === "stopped" && file && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 rounded-xl">
                      <span className="text-4xl">🎬</span>
                      <p className="text-sm font-semibold text-white">{file.name}</p>
                      <p className="text-xs text-gray-300">{fmtSize(file.size)}</p>
                    </div>
                  )}
                </div>

                {/* controls */}
                <div className="flex gap-3 justify-center flex-wrap">
                  {!streamRef.current && recState === "idle" && (
                    <button
                      id="open-camera-btn"
                      onClick={openCamera}
                      className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      📷 Open Camera
                    </button>
                  )}
                  {recState === "requesting" && (
                    <p className="text-sm text-gray-500">Requesting camera access…</p>
                  )}
                  {streamRef.current && recState === "idle" && (
                    <button
                      id="start-rec-btn"
                      onClick={startRec}
                      className="flex items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500"
                    >
                      <span className="h-2 w-2 rounded-full bg-white" />
                      Start Recording
                    </button>
                  )}
                  {recState === "recording" && (
                    <button
                      id="stop-rec-btn"
                      onClick={stopRec}
                      className="flex items-center gap-2 rounded-lg border-2 border-red-400 px-5 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />
                      Stop ({fmtTime(recSecs)})
                    </button>
                  )}
                  {recState === "stopped" && (
                    <button
                      id="re-record-btn"
                      onClick={() => {
                        setFile(null);
                        setRecState("idle");
                        setRecSecs(0);
                        setConvState("idle");
                      }}
                      className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      Re-record
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ══ ERROR ══ */}
            {errorMsg && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <span aria-hidden className="shrink-0 mt-0.5">⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* ══ PROGRESS BAR ══ */}
            {isConverting && (
              <ProgressBar
                value={progress}
                label={progressLabel}
                ariaLabel={`Conversion progress: ${progress}%`}
              />
            )}

            {/* ══ SUCCESS ══ */}
            {convState === "success" && pdfUrl && (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-4 rounded-xl border border-green-200 bg-green-50 px-6 py-6 text-center">
                  <div className="text-5xl">✅</div>
                  <div>
                    <p className="font-semibold text-gray-900">
                      {pageCount !== null
                        ? `Found ${pageCount} page${pageCount === 1 ? "" : "s"} — your PDF is ready`
                        : "Your PDF is ready!"}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      Click below to download your file.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3 justify-center">
                    <a
                      id="download-btn"
                      href={pdfUrl}
                      download={pdfName}
                      className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-pink-600 to-indigo-700 hover:from-pink-500 hover:to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-pink-600/20 transition"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Download PDF
                    </a>
                    <button
                      id="convert-another-btn"
                      onClick={reset}
                      className="rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      Convert another
                    </button>
                  </div>
                </div>

                {/* ── Ad below download ── */}
                <AdUnit
                  slot={AD_SLOT_BOTTOM}
                  format="rectangle"
                  responsive={true}
                  className="mt-2"
                />
              </div>
            )}

            {/* ══ CONVERT BUTTON ══ */}
            {canConvert && (
              <button
                id="convert-btn"
                onClick={() => handleConvert()}
                className="w-full rounded-xl bg-gradient-to-r from-pink-600 to-indigo-700 hover:from-pink-500 hover:to-indigo-600 py-4 text-sm font-semibold text-white shadow-md shadow-pink-600/20 transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500"
              >

                Scan & Preview Pages
              </button>
            )}
          </div>
        </div>

        {/* ── tips ── */}
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-sm text-gray-500">
          <p className="font-semibold text-gray-700 mb-1.5">💡 Tips</p>
          <ul className="space-y-1 list-disc list-inside text-xs">
            <li>Film pages at a slow, steady pace, showing each page clearly for about 1 second.</li>
            <li>Use good lighting so all text is readable in the PDF.</li>
            <li>Your video is deleted from our servers immediately after conversion.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
