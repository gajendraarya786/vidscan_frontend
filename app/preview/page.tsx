"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { pageStore, type ScannedPageItem } from "@/lib/pageStore";
import PerspectiveCropOverlay, { type PerspectivePoints } from "@/components/PerspectiveCropOverlay";

// ─── Interfaces ──────────────────────────────────────────────────────────────

type ScanFilter = "original" | "magic" | "grayscale" | "whiteboard" | "autocolor";

interface EditorPage {
  id: string;
  originalImage: string; // Raw base64 source (used for filters)
  image: string;         // Active filtered base64 source
  rotation: number;      // 0, 90, 180, 270
  filter: ScanFilter;
  filterIntensity: number; // 0 to 100
  brightness: number;    // -50 to +50
  contrast: number;      // -50 to +50
  crop?: PerspectivePoints;
}

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

const FILTERS: { id: ScanFilter; label: string; description: string; icon: string }[] = [
  { id: "original", label: "Original", description: "No enhancement", icon: "🖼️" },
  { id: "magic", label: "Magic Color", description: "Vibrant scan", icon: "✨" },
  { id: "grayscale", label: "Grayscale", description: "Smooth gray tones", icon: "🎨" },
  { id: "whiteboard", label: "Whiteboard", description: "Crisp black & white", icon: "🌓" },
  { id: "autocolor", label: "Auto Color", description: "Clean natural scan", icon: "🪄" },
];

type ActivePanel = "none" | "filters" | "adjust";

// ─── Canvas Filtering Helper ──────────────────────────────────────────────────

function applyCanvasFilter(
  rawBase64: string,
  filter: ScanFilter,
  intensity: number = 100
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (filter === "original") {
      resolve(rawBase64);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(rawBase64);
        return;
      }
      ctx.drawImage(img, 0, 0);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const len = data.length;

      const w = intensity / 100.0; // blend weight [0, 1]

      if (filter === "grayscale") {
        for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;

          data[i] = (1 - w) * r + w * gray;
          data[i + 1] = (1 - w) * g + w * gray;
          data[i + 2] = (1 - w) * b + w * gray;
        }
      } else if (filter === "whiteboard") {
        let totalLuminance = 0;
        const totalPixels = len / 4;
        for (let i = 0; i < len; i += 4) {
          totalLuminance += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        const dynamicMidpoint = totalLuminance / totalPixels;

        // intensity slider controls threshold directly (centered at midpoint when intensity=50)
        const threshold = dynamicMidpoint + (intensity - 50) * 1.5;

        for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          const value = gray < threshold ? 0 : 255;
          data[i] = value;
          data[i + 1] = value;
          data[i + 2] = value;
        }
      } else if (filter === "magic") {
        const contrastFactor = 1.22;
        const brightnessOffset = 10;
        const saturationFactor = 1.35;

        for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;

          let rs = gray + (r - gray) * saturationFactor;
          let gs = gray + (g - gray) * saturationFactor;
          let bs = gray + (b - gray) * saturationFactor;

          rs = (rs - 128) * contrastFactor + 128 + brightnessOffset;
          gs = (gs - 128) * contrastFactor + 128 + brightnessOffset;
          bs = (bs - 128) * contrastFactor + 128 + brightnessOffset;

          // Blend based on intensity slider
          data[i] = Math.max(0, Math.min(255, (1 - w) * r + w * rs));
          data[i + 1] = Math.max(0, Math.min(255, (1 - w) * g + w * gs));
          data[i + 2] = Math.max(0, Math.min(255, (1 - w) * b + w * bs));
        }
      } else if (filter === "autocolor") {
        const contrastFactor = 1.12;
        const brightnessOffset = 15;

        for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const rs = (r - 128) * contrastFactor + 128 + brightnessOffset;
          const gs = (g - 128) * contrastFactor + 128 + brightnessOffset;
          const bs = (b - 128) * contrastFactor + 128 + brightnessOffset;

          data[i] = Math.max(0, Math.min(255, (1 - w) * r + w * rs));
          data[i + 1] = Math.max(0, Math.min(255, (1 - w) * g + w * gs));
          data[i + 2] = Math.max(0, Math.min(255, (1 - w) * b + w * bs));
        }
      }

      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };

    img.onerror = () => reject(new Error("Failed to load image for rendering"));
    // Ensure base64 prefix
    img.src = rawBase64.startsWith("data:") ? rawBase64 : `data:image/jpeg;base64,${rawBase64}`;
  });
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function PreviewPage() {
  const [pages, setPages] = useState<EditorPage[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Editor states
  const [isCropping, setIsCropping] = useState(true);
  const [isCropApplying, setIsCropApplying] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>("none");
  const [activeSheet, setActiveSheet] = useState<"none" | "thumbnails" | "filters" | "adjust">("none");

  // Drag & Drop thumbnails
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Undo delete
  const [deletedPage, setDeletedPage] = useState<{ page: EditorPage; index: number } | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Camera capture states & refs
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [captureMode, setCaptureMode] = useState<"add" | "recapture">("add");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load from in-memory pageStore on mount
  useEffect(() => {
    const stored = pageStore.get();
    if (stored.length > 0) {
      const mapped = stored.map((p: ScannedPageItem, idx: number) => ({
        id: `page-${idx}-${Math.random().toString(36).substring(4)}`,
        originalImage: p.image,
        image: p.image,
        rotation: 0,
        filter: "original" as ScanFilter,
        filterIntensity: 100,
        brightness: 0,
        contrast: 0,
      }));
      setPages(mapped);
    }
    setIsLoaded(true);

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Show crop by default when switching active page if it hasn't been cropped yet
  useEffect(() => {
    const page = pages[activeIdx];
    if (page) {
      setIsCropping(!page.crop);
    } else {
      setIsCropping(true);
    }
    setActivePanel("none");
    setActiveSheet("none");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx]);

  const activePage = pages[activeIdx];

  const updateActivePage = (updates: Partial<EditorPage>) => {
    if (!activePage) return;
    setPages((prev) =>
      prev.map((p, idx) => (idx === activeIdx ? { ...p, ...updates } : p))
    );
  };

  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  // ── Drag & Drop Thumbnail Handlers ──────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIdx(index);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) {
      setDragOverIdx(null);
      return;
    }
    const updated = [...pages];
    const [moved] = updated.splice(draggedIdx, 1);
    updated.splice(index, 0, moved);
    setPages(updated);

    // Track active page
    const activeItem = pages[activeIdx];
    const newActiveIdx = updated.findIndex((p) => p.id === activeItem?.id);
    if (newActiveIdx !== -1) {
      setActiveIdx(newActiveIdx);
    }

    setDraggedIdx(null);
    setDragOverIdx(null);
    showToast("Reordered page");
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleRotateLeft = () => {
    const nextRot = (activePage.rotation - 90) % 360;
    updateActivePage({ rotation: nextRot < 0 ? nextRot + 360 : nextRot });
    showToast("Rotated left");
  };

  const handleRotateRight = () => {
    const nextRot = (activePage.rotation + 90) % 360;
    updateActivePage({ rotation: nextRot });
    showToast("Rotated right");
  };

  const handleDelete = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    const pageToDelete = pages[index];
    const updated = pages.filter((_, i) => i !== index);
    setPages(updated);

    setDeletedPage({ page: pageToDelete, index });
    setShowUndo(true);

    if (updated.length === 0) {
      setActiveIdx(0);
    } else if (index === activeIdx) {
      setActiveIdx(Math.min(activeIdx, updated.length - 1));
    } else if (index < activeIdx) {
      setActiveIdx((prev) => prev - 1);
    }

    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setShowUndo(false);
      setDeletedPage(null);
    }, 5000);
  };

  const handleUndo = () => {
    if (!deletedPage) return;
    setPages((prev) => {
      const copy = [...prev];
      copy.splice(deletedPage.index, 0, deletedPage.page);
      return copy;
    });
    setActiveIdx(deletedPage.index);
    setShowUndo(false);
    setDeletedPage(null);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    showToast("Deletion undone");
  };

  const handleAddPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(",")[1];
      const newPage: EditorPage = {
        id: `page-added-${Date.now()}-${Math.random().toString(36).substring(4)}`,
        originalImage: b64,
        image: b64,
        rotation: 0,
        filter: "original",
        filterIntensity: 100,
        brightness: 0,
        contrast: 0,
      };
      setPages((prev) => {
        const next = [...prev, newPage];
        setActiveIdx(next.length - 1);
        return next;
      });
      showToast("Added new page");
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openCamera = async () => {
    setIsCameraOpen(true);
    setIsRequestingCamera(true);
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.play().catch((err) => {
            console.error("Video play failed:", err);
          });
        }
      }, 100);
      setIsRequestingCamera(false);
    } catch (err) {
      console.error(err);
      // Fallback to lower resolution
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;

        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.muted = true;
            videoRef.current.play().catch((e) => {
              console.error("Video play failed:", e);
            });
          }
        }, 100);
        setIsRequestingCamera(false);
      } catch {
        setCameraError("Camera access denied or unavailable. Please check permissions.");
        setIsRequestingCamera(false);
      }
    }
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
    setCameraError("");
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = video.videoWidth || video.width || 1280;
    const height = video.videoHeight || video.height || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    const b64 = dataUrl.split(",")[1];

    if (captureMode === "recapture" && activePage) {
      let filteredB64 = b64;
      try {
        const filtered = await applyCanvasFilter(b64, activePage.filter, activePage.filterIntensity);
        filteredB64 = filtered.split(",")[1] || filtered;
      } catch (e) {
        console.error("Failed to apply filter on recapture:", e);
      }

      setPages((prev) =>
        prev.map((p, idx) =>
          idx === activeIdx
            ? {
              ...p,
              originalImage: b64,
              image: filteredB64,
              crop: undefined,
              rotation: 0,
              brightness: 0,
              contrast: 0,
            }
            : p
        )
      );

      setIsCropping(true);
      showToast("Recaptured active page");
    } else {
      const newPage: EditorPage = {
        id: `page-added-${Date.now()}-${Math.random().toString(36).substring(4)}`,
        originalImage: b64,
        image: b64,
        rotation: 0,
        filter: "original",
        filterIntensity: 100,
        brightness: 0,
        contrast: 0,
      };

      setPages((prev) => {
        const next = [...prev, newPage];
        setActiveIdx(next.length - 1);
        return next;
      });

      showToast("Captured and added new page");
    }

    closeCamera();
  };

  // ── Apply canvas filter client-side ─────────────────────────────────────────

  const handleFilterSelect = async (filterType: ScanFilter) => {
    if (!activePage) return;
    try {
      const defaultIntensity = filterType === "whiteboard" ? 50 : 100;
      const filtered = await applyCanvasFilter(activePage.originalImage, filterType, defaultIntensity);
      const cleanB64 = filtered.split(",")[1] || filtered;
      updateActivePage({
        filter: filterType,
        filterIntensity: defaultIntensity,
        image: cleanB64,
      });
      showToast(`Applied ${filterType} filter`);
    } catch (e) {
      console.error(e);
      setErrorMsg("Failed to apply visual filter.");
    }
  };

  const handleIntensityChange = async (intensity: number) => {
    if (!activePage) return;
    try {
      const filtered = await applyCanvasFilter(activePage.originalImage, activePage.filter, intensity);
      const cleanB64 = filtered.split(",")[1] || filtered;
      updateActivePage({
        filterIntensity: intensity,
        image: cleanB64,
      });
    } catch (e) {
      console.error(e);
    }
  };

  // ── Apply perspective crop server-side ─────────────────────────────────────

  const handleCropConfirm = async (crop: PerspectivePoints) => {
    if (!activePage) return;
    setIsCropApplying(true);
    setErrorMsg("");
    try {
      const res = await fetch(`${API_URL}/apply-crop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: activePage.originalImage,
          crop_x: crop.tl.x,
          crop_y: crop.tl.y,
          crop_width: crop.tr.x - crop.tl.x,
          crop_height: crop.bl.y - crop.tl.y,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error: ${res.status}`);
      }

      const { image: croppedB64 } = (await res.json()) as { image: string };

      const filtered = await applyCanvasFilter(croppedB64, activePage.filter, activePage.filterIntensity);
      const cleanB64 = filtered.split(",")[1] || filtered;

      updateActivePage({
        originalImage: croppedB64,
        image: cleanB64,
        crop,
      });

      setIsCropping(false);
      showToast("Crop applied successfully");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Crop failed. Is the backend running?";
      setErrorMsg(msg);
    } finally {
      setIsCropApplying(false);
    }
  };

  const resetEdits = async () => {
    if (!activePage) return;
    try {
      const original = activePage.originalImage;
      updateActivePage({
        image: original,
        rotation: 0,
        filter: "original",
        filterIntensity: 100,
        brightness: 0,
        contrast: 0,
        crop: undefined,
      });
      showToast("Reset all adjustments");
    } catch (e) {
      console.error(e);
    }
  };

  // ── PDF Compilation ────────────────────────────────────────────────────────

  const handleDownloadPdf = async () => {
    if (pages.length === 0) return;
    setIsGenerating(true);
    setErrorMsg("");

    try {
      const res = await fetch(`${API_URL}/generate-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pages: pages.map((p) => ({
            image: p.image, // Sends the fully filtered/cropped base64 image directly
            rotation: p.rotation,
            brightness: p.brightness,
            contrast: p.contrast,
          })),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error: ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      a.download = "vidscan_document.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("PDF Downloaded successfully!");
    } catch (e: unknown) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "Failed to generate PDF. Is the backend API running?";
      setErrorMsg(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#f4f5f9] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-600" />
          <p className="text-sm text-slate-550 font-medium">Loading VidScan Workspace...</p>
        </div>
      </div>
    );
  }

  return (

    <div className="min-h-screen bg-[#f4f5f9] text-slate-800 flex flex-col overflow-hidden font-sans select-none">

      {/* ─── Navbar ──────────────────────────────────────────────────────────── */}
      <nav className="bg-gradient-to-r from-pink-600 to-indigo-700 text-white shadow-md px-4 py-3 flex-shrink-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/convert" className="text-sm text-pink-100 hover:text-white transition flex items-center gap-1 font-semibold">
            ← Back to scanner
          </Link>
          <span className="font-semibold text-white text-sm flex items-center gap-1.5">
            📄 VidScan Editor
          </span>
          <span className="w-16" />
        </div>
      </nav>

      {pages.length === 0 ? (
        <div className="flex-1 bg-[#f4f5f9] flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto">
          <div className="text-6xl mb-4">🗂️</div>
          <h2 className="text-xl font-bold text-slate-850">No pages scanned yet</h2>
          <p className="text-sm text-slate-500 mt-2">
            Please capture or upload a video of document pages first to edit.
          </p>
          <Link href="/convert" className="mt-6 inline-flex rounded-xl bg-pink-600 px-6 py-3 font-semibold text-white transition hover:bg-pink-500 shadow-md">
            Go to Scanner
          </Link>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:grid md:grid-cols-3 overflow-hidden h-[calc(100vh-60px)] md:h-[calc(100vh-124px)] relative bg-[#f4f5f9]">

          {/* ─── DESKTOP LEFT PANEL: Thumbnails Strip (Hidden on mobile) ───────── */}
          <div className="hidden md:flex border-r border-slate-200 bg-white flex-col md:col-span-1 h-full overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 flex-shrink-0">
              <h3 className="font-semibold text-slate-500 text-xs uppercase tracking-wider">Scanned Pages</h3>
              <span className="text-xs bg-pink-50 text-pink-700 border border-pink-100 font-semibold px-2 py-0.5 rounded-full font-mono">
                {pages.length} total
              </span>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {pages.map((p, idx) => {
                const isSelected = idx === activeIdx;

                return (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDrop={(e) => handleDrop(e, idx)}
                    onDragEnd={handleDragEnd}
                    onClick={() => {
                      setActiveIdx(idx);
                    }}
                    className={`relative group shrink-0 bg-white rounded-xl border p-1.5 cursor-pointer shadow-sm transition-all flex flex-col justify-between
                      ${isSelected ? "border-pink-600 ring-4 ring-pink-500/10" : "border-slate-200 hover:border-slate-350"}
                      ${dragOverIdx === idx ? "border-dashed border-pink-400 bg-pink-50/50 scale-[0.98]" : ""}
                    `}
                  >
                    {/* Page image container */}
                    <div className="aspect-[4/3] w-full relative bg-slate-50 rounded-lg overflow-hidden flex items-center justify-center border border-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`data:image/jpeg;base64,${p.image}`}
                        alt={`Page ${idx + 1}`}
                        className="max-h-full max-w-full object-contain pointer-events-none transition-transform duration-200"
                        style={{
                          transform: `rotate(${p.rotation}deg)`,
                          filter: `brightness(${100 + p.brightness * 2}%) contrast(${100 + p.contrast * 2}%)`,
                        }}
                      />
                      {/* Page badge */}
                      <span className="absolute bottom-1.5 left-1.5 bg-slate-900/75 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        Page {idx + 1}
                      </span>
                    </div>

                    {/* Delete badge */}
                    <div className="absolute top-2.5 right-2.5 flex gap-1">
                      <button
                        onClick={(e) => handleDelete(e, idx)}
                        aria-label={`Delete Page ${idx + 1}`}
                        className="bg-red-500 hover:bg-red-650 text-white rounded-full p-1 shadow-md opacity-90 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:scale-105"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Drag Handle indicator */}
                    <div className="absolute bottom-2.5 right-2.5 opacity-40 md:opacity-0 md:group-hover:opacity-60 transition-opacity pointer-events-none">
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </div>
                  </div>
                );
              })}

              {/* Add Page Options */}
              <div className="grid grid-cols-2 gap-3 shrink-0 mt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative flex flex-col items-center justify-center gap-2 rounded-2xl border border-pink-200/50 bg-gradient-to-br from-white to-pink-50/30 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-pink-300 hover:shadow-[0_8px_20px_-6px_rgba(219,39,119,0.15)] focus:outline-none"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-100/80 text-pink-650 transition-transform group-hover:scale-110">
                    <span className="text-lg">📁</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-600 tracking-wide">Upload Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCaptureMode("add");
                    openCamera();
                  }}
                  className="group relative flex flex-col items-center justify-center gap-2 rounded-2xl border border-indigo-200/50 bg-gradient-to-br from-white to-indigo-50/30 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-300 hover:shadow-[0_8px_20px_-6px_rgba(67,56,202,0.15)] focus:outline-none"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100/80 text-indigo-650 transition-transform group-hover:scale-110">
                    <span className="text-lg">📷</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-600 tracking-wide">Capture Photo</span>
                </button>
              </div>

            </div>
          </div>

          {/* ─── DESKTOP/MOBILE SHARED VIEWPORT STAGE ─────────────────────────── */}
          <div className="flex-1 md:col-span-2 bg-[#f4f5f9] flex flex-col overflow-hidden relative">
            {activePage ? (
              <div className="flex-1 flex flex-col w-full h-full p-4 md:p-6 justify-between overflow-hidden">

                {/* ─── DESKTOP ONLY: Top Editor controls ─────────────────────── */}
                <div className="hidden md:flex bg-white border border-slate-200 rounded-2xl p-4 mb-4 shadow-sm flex-col gap-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleRotateLeft}
                        disabled={isCropping}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold transition flex items-center gap-1"
                      >
                        ↩️ Rotate Left
                      </button>
                      <button
                        onClick={handleRotateRight}
                        disabled={isCropping}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold transition flex items-center gap-1"
                      >
                        ↪️ Rotate Right
                      </button>

                      {/* Crop Toggle */}
                      <button
                        onClick={() => {
                          setIsCropping((v) => !v);
                          setActivePanel("none");
                        }}
                        className={`rounded-xl px-4 py-2 text-xs font-semibold transition flex items-center gap-1.5
                          ${isCropping
                            ? "bg-pink-600 text-white shadow-sm"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                          }`}
                      >
                        Crop
                      </button>

                      {/* Filters Toggle */}
                      <button
                        onClick={() => {
                          setActivePanel(activePanel === "filters" ? "none" : "filters");
                          setIsCropping(false);
                        }}
                        disabled={isCropping}
                        className={`rounded-xl px-4 py-2 text-xs font-semibold transition flex items-center gap-1.5
                          ${activePanel === "filters"
                            ? "bg-pink-600 text-white shadow-sm"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40"
                          }`}
                      >
                        🎨 Filters
                      </button>

                      {/* Adjust Toggle */}
                      <button
                        onClick={() => {
                          setActivePanel(activePanel === "adjust" ? "none" : "adjust");
                          setIsCropping(false);
                        }}
                        disabled={isCropping}
                        className={`rounded-xl px-4 py-2 text-xs font-semibold transition flex items-center gap-1.5
                          ${activePanel === "adjust"
                            ? "bg-pink-600 text-white shadow-sm"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-750 disabled:opacity-40"
                          }`}
                      >
                        ⚙️ Adjust
                      </button>

                      {/* Recapture Photo */}
                      <button
                        onClick={() => {
                          setCaptureMode("recapture");
                          openCamera();
                        }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold transition flex items-center gap-1"
                      >
                        📷 Recapture
                      </button>
                    </div>

                    <button
                      onClick={resetEdits}
                      disabled={isCropping}
                      className="bg-red-50 hover:bg-red-100 border border-red-200 text-red-650 rounded-xl px-4 py-2 text-xs font-semibold transition"
                    >
                      Reset All
                    </button>
                  </div>

                  {/* Desktop panel option rows */}
                  {activePanel === "filters" && (
                    <div className="border-t border-slate-100 pt-4 animate-in slide-in-from-top-2 duration-150">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">
                        Scan Enhancement Filter
                      </span>
                      <div className="grid grid-cols-5 gap-1.5">
                        {FILTERS.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => handleFilterSelect(f.id)}
                            className={`flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl text-[10px] font-bold transition-all
                              ${activePage.filter === f.id
                                ? "bg-pink-600 text-white shadow-sm"
                                : "bg-slate-50 border border-slate-200 text-slate-650 hover:text-slate-900 hover:bg-slate-100"
                              }
                            `}
                          >
                            <span className="text-sm">{f.icon}</span>
                            <span className="truncate w-full text-center px-0.5">{f.label}</span>
                          </button>
                        ))}
                      </div>

                      {activePage.filter !== "original" && (
                        <div className="mt-4 border-t border-slate-100 pt-4">
                          <div className="flex justify-between items-center text-xs mb-1.5">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                              {activePage.filter === "whiteboard" ? "Threshold Level" : "Filter Intensity"}
                            </span>
                            <span className="text-pink-600 font-bold font-mono">{activePage.filterIntensity}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={activePage.filterIntensity}
                            onChange={(e) => handleIntensityChange(parseInt(e.target.value))}
                            className="w-full h-1 appearance-none rounded-full bg-slate-200 accent-pink-600 cursor-pointer focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {activePanel === "adjust" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-550 font-semibold">Brightness</span>
                          <span className="text-pink-600 font-bold font-mono">{activePage.brightness}</span>
                        </div>
                        <input
                          type="range"
                          min="-50"
                          max="50"
                          value={activePage.brightness}
                          onChange={(e) => updateActivePage({ brightness: parseInt(e.target.value) })}
                          className="w-full h-1 appearance-none rounded-full bg-slate-200 accent-pink-600 cursor-pointer focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-550 font-semibold">Contrast</span>
                          <span className="text-pink-600 font-bold font-mono">{activePage.contrast}</span>
                        </div>
                        <input
                          type="range"
                          min="-50"
                          max="50"
                          value={activePage.contrast}
                          onChange={(e) => updateActivePage({ contrast: parseInt(e.target.value) })}
                          className="w-full h-1 appearance-none rounded-full bg-slate-200 accent-pink-600 cursor-pointer focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Viewport Canvas (Centered Preview Area) */}
                <div className="flex-1 bg-slate-200/30 border border-slate-200/80 md:rounded-2xl rounded-xl p-4 flex items-center justify-center relative overflow-hidden min-h-[300px] shadow-inner">
                  {isCropApplying && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/80 backdrop-blur-[1px] md:rounded-2xl rounded-xl">
                      <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-pink-600" />
                        <p className="text-sm text-slate-600 font-medium">Applying perspective crop…</p>
                      </div>
                    </div>
                  )}

                  {isCropping ? (
                    <div className="w-full max-h-full relative z-20">
                      <PerspectiveCropOverlay
                        imageUrl={`data:image/jpeg;base64,${activePage.originalImage}`}
                        imageAlt={`Page ${activeIdx + 1} Editor`}
                        initialPoints={activePage.crop}
                        onConfirm={handleCropConfirm}
                        onCancel={() => setIsCropping(false)}
                      />
                    </div>
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`data:image/jpeg;base64,${activePage.image}`}
                        alt="Active Preview"
                        className="max-h-[50vh] md:max-h-[60vh] max-w-full object-contain shadow-md transition-all duration-300 ease-out rounded-lg border border-slate-200 bg-white"
                        style={{
                          filter: `brightness(${100 + activePage.brightness * 2}%) contrast(${100 + activePage.contrast * 2}%)`,
                          transform: `rotate(${activePage.rotation}deg)`,
                        }}
                      />
                      <div className="absolute top-4 left-4 bg-slate-900/75 border border-slate-800 backdrop-blur text-slate-200 text-[10px] font-bold px-2.5 py-1 rounded-lg">
                        Page {activeIdx + 1} ({activePage.filter.toUpperCase()})
                      </div>
                    </>
                  )}
                </div>

                {/* Mobile top page indicator overlay */}
                <div className="md:hidden text-center text-xs text-slate-500 py-1.5 font-medium">
                  Page {activeIdx + 1} of {pages.length}
                </div>

                {/* Mobile horizontal thumbnails strip (shown by default on normal view) */}
                <div className="md:hidden mt-2 mb-1 w-full bg-white border border-slate-200 rounded-2xl p-3 shadow-sm shrink-0">
                  <div className="flex justify-between items-center mb-1.5 px-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">Document Pages</span>
                    <span className="text-[10px] text-slate-500 font-semibold font-mono">{pages.length} Pages</span>
                  </div>

                  <div className="flex gap-3 overflow-x-auto py-1 shrink-0 scrollbar-none">
                    {pages.map((p, idx) => {
                      const isSelected = idx === activeIdx;
                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            setActiveIdx(idx);
                          }}
                          className={`relative group shrink-0 w-16 bg-slate-50 rounded-xl border-2 p-0.5 cursor-pointer transition-all
                              ${isSelected ? "border-pink-600 bg-pink-50/10" : "border-slate-100"}
                            `}
                        >
                          <div className="aspect-[3/4] relative bg-white border border-slate-205 rounded-lg overflow-hidden flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`data:image/jpeg;base64,${p.image}`}
                              alt={`Page ${idx + 1}`}
                              className="max-h-full max-w-full object-contain"
                              style={{ transform: `rotate(${p.rotation}deg)` }}
                            />
                            <span className="absolute bottom-0.5 left-0.5 bg-slate-900/75 text-white text-[8px] font-bold px-1 rounded">
                              {idx + 1}
                            </span>
                          </div>

                          <button
                            onClick={(e) => handleDelete(e, idx)}
                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow-md hover:bg-red-650"
                          >
                            <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}

                    {/* Inline upload card inside mobile strip */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="shrink-0 w-16 aspect-[3/4] border border-dashed border-pink-200 bg-gradient-to-b from-white to-pink-50/20 rounded-xl flex flex-col items-center justify-center gap-1 transition-all text-pink-600 active:scale-95 shadow-sm"
                    >
                      <span className="text-base leading-none">📁</span>
                      <span className="text-[9px] font-bold text-slate-600 font-medium">Upload</span>
                    </button>

                    {/* Inline camera capture card inside mobile strip */}
                    <button
                      type="button"
                      onClick={() => {
                        setCaptureMode("add");
                        openCamera();
                      }}
                      className="shrink-0 w-16 aspect-[3/4] border border-dashed border-indigo-200 bg-gradient-to-b from-white to-indigo-50/20 rounded-xl flex flex-col items-center justify-center gap-1 transition-all text-indigo-655 active:scale-95 shadow-sm"
                    >
                      <span className="text-base leading-none">📷</span>
                      <span className="text-[9px] font-bold text-slate-655 font-medium">Capture</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 font-medium">
                Select a page from the left panel to edit.
              </div>
            )}

            {/* ─── MOBILE BOTTOM SHEETS (Slide Up Modals) ──────────────────────── */}
            {activeSheet !== "none" && !isCropping && (
              <>
                {/* Backdrop overlay (Transparent & No Blur) */}
                <div
                  onClick={() => setActiveSheet("none")}
                  className="absolute inset-0 bg-transparent z-30"
                />

                {/* Modal Container */}
                <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-250 rounded-t-3xl p-5 pb-8 z-40 animate-in slide-in-from-bottom duration-200 max-h-[85vh] overflow-y-auto shadow-2xl text-slate-800">
                  <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-4" />

                  {/* Filters Sheet */}
                  {activeSheet === "filters" && activePage && (
                    <div className="space-y-4">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Choose Scan Enhancement</span>
                      <div className="grid grid-cols-5 gap-1.5">
                        {FILTERS.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => handleFilterSelect(f.id)}
                            className={`flex flex-col items-center gap-1.5 py-3.5 px-0.5 rounded-xl text-[10px] font-bold transition-all
                              ${activePage.filter === f.id
                                ? "bg-pink-600 text-white shadow-sm"
                                : "bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900"
                              }
                            `}
                          >
                            <span className="text-sm">{f.icon}</span>
                            <span className="truncate w-full text-center px-0.5">{f.label}</span>
                          </button>
                        ))}
                      </div>

                      {activePage.filter !== "original" && (
                        <div className="mt-4 border-t border-slate-100 pt-4">
                          <div className="flex justify-between items-center text-xs mb-1.5">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                              {activePage.filter === "whiteboard" ? "Threshold Level (Line Thickness)" : "Enhancement Intensity"}
                            </span>
                            <span className="text-pink-600 font-bold font-mono">{activePage.filterIntensity}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={activePage.filterIntensity}
                            onChange={(e) => handleIntensityChange(parseInt(e.target.value))}
                            className="w-full h-1.5 appearance-none rounded-full bg-slate-100 border border-slate-200 accent-pink-600 cursor-pointer focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Adjustments Sheet */}
                  {activeSheet === "adjust" && activePage && (
                    <div className="space-y-4">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Manual Adjustments</span>
                      <div className="space-y-3.5">
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 font-semibold">Brightness</span>
                            <span className="text-pink-700 font-bold font-mono">{activePage.brightness}</span>
                          </div>
                          <input
                            type="range"
                            min="-50"
                            max="50"
                            value={activePage.brightness}
                            onChange={(e) => updateActivePage({ brightness: parseInt(e.target.value) })}
                            className="w-full h-1.5 appearance-none rounded-full bg-slate-100 border border-slate-205 accent-pink-600 cursor-pointer focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 font-semibold">Contrast</span>
                            <span className="text-pink-700 font-bold font-mono">{activePage.contrast}</span>
                          </div>
                          <input
                            type="range"
                            min="-50"
                            max="50"
                            value={activePage.contrast}
                            onChange={(e) => updateActivePage({ contrast: parseInt(e.target.value) })}
                            className="w-full h-1.5 appearance-none rounded-full bg-slate-100 border border-slate-205 accent-pink-600 cursor-pointer focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ─── MOBILE ONLY: BOTTOM DOCK TOOLBAR ────────────────────────────── */}
            {activePage && (
              <footer className="md:hidden flex justify-around bg-white border-t border-slate-200 py-3.5 px-2 select-none shrink-0 z-20 shadow-[0_-8px_30px_rgb(0,0,0,0.06)]">
                {/* Crop toggle */}
                <button
                  onClick={() => {
                    setIsCropping((v) => !v);
                    setActiveSheet("none");
                  }}
                  className={`flex flex-col items-center gap-1 text-[10px] font-bold w-14
                    ${isCropping ? "text-pink-600" : "text-slate-500 hover:text-slate-800"}`}
                >
                  <span className="text-base">✂️</span>
                  <span>Crop</span>
                </button>

                {/* Filters Sheet trigger */}
                <button
                  onClick={() => {
                    setActiveSheet(activeSheet === "filters" ? "none" : "filters");
                    setIsCropping(false);
                  }}
                  className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-colors w-14
                    ${activeSheet === "filters" && !isCropping ? "text-pink-600" : "text-slate-500 hover:text-slate-800"}`}
                >
                  <span className="text-base">🎨</span>
                  <span>Filters</span>
                </button>

                {/* Adjust Sheet trigger */}
                <button
                  onClick={() => {
                    setActiveSheet(activeSheet === "adjust" ? "none" : "adjust");
                    setIsCropping(false);
                  }}
                  className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-colors w-14
                    ${activeSheet === "adjust" && !isCropping ? "text-pink-600" : "text-slate-500 hover:text-slate-800"}`}
                >
                  <span className="text-base">⚙️</span>
                  <span>Adjust</span>
                </button>

                {/* Rotate active page instantly */}
                <button
                  onClick={handleRotateRight}
                  className="flex flex-col items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 w-14"
                >
                  <span className="text-base">🔄</span>
                  <span>Rotate</span>
                </button>

                {/* Recapture active page */}
                <button
                  onClick={() => {
                    setCaptureMode("recapture");
                    openCamera();
                  }}
                  className="flex flex-col items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 w-14 transition-colors"
                >
                  <span className="text-base">📷</span>
                  <span>Recapture</span>
                </button>
              </footer>
            )}
          </div>
        </div>
      )}

      {/* Sticky Bottom Desktop Action Bar (Hidden on Mobile) */}
      {pages.length > 0 && (
        <div className="hidden md:block border-t border-slate-200 bg-white/90 backdrop-blur-sm px-4 py-4 flex-shrink-0 z-10 shadow-lg">
          <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm font-semibold text-slate-655">
              {pages.length} page{pages.length === 1 ? "" : "s"} selected
            </div>

            <div>
              <Link
                href="/convert"
                className="inline-flex rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-5 py-3 text-sm font-medium text-slate-700 transition shadow-sm"
              >
                🔄 Rescan
              </Link>
            </div>

            <div>
              <button
                id="generate-pdf-btn"
                disabled={isGenerating}
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-indigo-700 hover:from-pink-500 hover:to-indigo-600 disabled:opacity-40 px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    Download PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button (FAB) on Mobile to compile/download PDF */}
      {pages.length > 0 && !isCropping && (
        <button
          onClick={handleDownloadPdf}
          disabled={isGenerating}
          className="md:hidden fixed bottom-24 right-5 z-20 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-r from-pink-600 to-indigo-700 text-white shadow-2xl active:scale-95 transition-all border border-pink-500/20"
          aria-label="Download compiled PDF"
        >
          {isGenerating ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
          ) : (
            <svg
              className="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
        </button>
      )}

      {/* Undo deletion toast */}
      {showUndo && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center justify-between gap-6 z-50 animate-bounce">
          <span className="text-xs font-semibold text-slate-300">Page deleted.</span>
          <button
            onClick={handleUndo}
            className="text-xs font-bold text-pink-500 hover:text-pink-400 hover:underline transition"
          >
            Undo
          </button>
        </div>
      )}

      {/* Global Toast messages */}
      {successMsg && (
        <div className="fixed bottom-36 right-6 bg-slate-900 border border-slate-800 text-white px-4 py-2.5 rounded-xl shadow-2xl z-50 flex items-center gap-2 animate-in fade-in duration-200">
          <span className="text-green-400">✓</span>
          <span className="text-xs font-semibold">{successMsg}</span>
        </div>
      )}

      {/* Error alert toast */}
      {errorMsg && (
        <div className="fixed bottom-36 right-6 bg-red-950 border border-red-800 text-white px-5 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-2 max-w-sm animate-in fade-in duration-200">
          <span className="text-sm">⚠️</span>
          <span className="text-xs font-semibold">{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="ml-auto text-white/60 hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* Hidden file input for adding pages */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleAddPage}
        className="hidden"
        aria-hidden="true"
      />

      {/* Hidden canvas for video frames capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* ─── Camera Photo Capture Modal ─── */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 text-white shadow-2xl overflow-hidden flex flex-col">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80">
              <span className="font-bold text-sm tracking-tight flex items-center gap-1.5 text-pink-400">
                📷 Capture Document Page
              </span>
              <button
                type="button"
                onClick={closeCamera}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Video Preview viewport */}
            <div className="relative aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                playsInline
                className="w-full h-full object-cover"
              />

              {isRequestingCamera && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950">
                  <div className="w-8 h-8 rounded-full border-4 border-pink-500 border-t-transparent animate-spin" />
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Requesting Camera Access…</p>
                </div>
              )}
            </div>

            {/* Error Message */}
            {cameraError && (
              <div className="bg-red-950/80 border-t border-red-900/50 px-6 py-3.5 text-xs text-red-300 font-medium flex gap-2">
                <span>⚠️</span>
                <span>{cameraError}</span>
              </div>
            )}

            {/* Control Buttons */}
            <div className="p-6 bg-slate-900 flex justify-center items-center gap-4">
              <button
                type="button"
                onClick={capturePhoto}
                disabled={isRequestingCamera || !!cameraError}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-pink-600 to-indigo-700 hover:from-pink-500 hover:to-indigo-655 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-extrabold shadow-lg shadow-pink-600/20 active:scale-95 transition-all text-center flex items-center justify-center gap-2"
              >
                <span>📸</span> Capture Photo
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}




