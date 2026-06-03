"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { pageStore, type ScannedPageItem } from "@/lib/pageStore";
import PerspectiveCropOverlay, { type PerspectivePoints } from "@/components/PerspectiveCropOverlay";

// ─── Interfaces ──────────────────────────────────────────────────────────────

type ScanFilter = "original" | "magic" | "grayscale" | "whiteboard" | "autocolor" | "docgrayscale" | "adobe_bw" | "sharp_color" | "soft_bw" | "marker" | "vintage";

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
  { id: "autocolor", label: "Auto Color", description: "Clean natural scan", icon: "🪄" },
  { id: "sharp_color", label: "Sharp Color", description: "Remove shadow & keep ink", icon: "🎨" },
  { id: "adobe_bw", label: "Adobe B&W", description: "Crisp adaptive B&W", icon: "📰" },
  { id: "soft_bw", label: "Soft B&W", description: "Faint text clarifier", icon: "✏️" },
  { id: "docgrayscale", label: "Doc Grayscale", description: "Clean paper & gray text", icon: "📄" },
  { id: "marker", label: "Marker Boost", description: "Whiteboard & ink pop", icon: "🖍️" },
  { id: "vintage", label: "Vintage Note", description: "Warm retro look", icon: "📜" },
  { id: "grayscale", label: "Grayscale", description: "Smooth gray tones", icon: "🖤" },
  { id: "whiteboard", label: "Whiteboard", description: "Crisp black & white", icon: "🌓" },
];



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
      } else if (filter === "sharp_color") {
        const W = canvas.width;
        const H = canvas.height;
        const g = new Uint8Array(W * H);
        for (let i = 0; i < len; i += 4) {
          g[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }

        const S = new Uint32Array(W * H);
        for (let y = 0; y < H; y++) {
          let rowSum = 0;
          for (let x = 0; x < W; x++) {
            const idx = y * W + x;
            rowSum += g[idx];
            if (y === 0) {
              S[idx] = rowSum;
            } else {
              S[idx] = S[(y - 1) * W + x] + rowSum;
            }
          }
        }

        const s = Math.floor(W / 12);
        const s2 = Math.floor(s / 2);
        const gain = 1.0 + (intensity / 100) * 0.4;

        for (let y = 0; y < H; y++) {
          const y1 = Math.max(0, y - s2);
          const y2 = Math.min(H - 1, y + s2);
          for (let x = 0; x < W; x++) {
            const x1 = Math.max(0, x - s2);
            const x2 = Math.min(W - 1, x + s2);
            
            const idx = y * W + x;
            const br = y2 * W + x2;
            const tr = (y1 - 1) * W + x2;
            const bl = y2 * W + (x1 - 1);
            const tl = (y1 - 1) * W + (x1 - 1);
            
            let sum = S[br];
            if (y1 > 0) sum -= S[tr];
            if (x1 > 0) sum -= S[bl];
            if (y1 > 0 && x1 > 0) sum += S[tl];
            
            const count = (x2 - x1 + 1) * (y2 - y1 + 1);
            const avg = sum / count;
            
            const pixelIdx = idx * 4;
            const r = data[pixelIdx];
            const g_val = data[pixelIdx + 1];
            const b = data[pixelIdx + 2];
            
            const scale = 255 / (avg + 1);
            
            let nr = r * scale * gain;
            let ng = g_val * scale * gain;
            let nb = b * scale * gain;
            
            nr = Math.max(0, Math.min(255, nr));
            ng = Math.max(0, Math.min(255, ng));
            nb = Math.max(0, Math.min(255, nb));
            
            data[pixelIdx] = (1 - w) * r + w * nr;
            data[pixelIdx + 1] = (1 - w) * g_val + w * ng;
            data[pixelIdx + 2] = (1 - w) * b + w * nb;
          }
        }
      } else if (filter === "soft_bw") {
        const W = canvas.width;
        const H = canvas.height;
        const g = new Uint8Array(W * H);
        for (let i = 0; i < len; i += 4) {
          g[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }

        const S = new Uint32Array(W * H);
        for (let y = 0; y < H; y++) {
          let rowSum = 0;
          for (let x = 0; x < W; x++) {
            const idx = y * W + x;
            rowSum += g[idx];
            if (y === 0) {
              S[idx] = rowSum;
            } else {
              S[idx] = S[(y - 1) * W + x] + rowSum;
            }
          }
        }

        const s = Math.floor(W / 12);
        const s2 = Math.floor(s / 2);
        const t = 0.05 + (intensity / 100) * 0.22;

        for (let y = 0; y < H; y++) {
          const y1 = Math.max(0, y - s2);
          const y2 = Math.min(H - 1, y + s2);
          for (let x = 0; x < W; x++) {
            const x1 = Math.max(0, x - s2);
            const x2 = Math.min(W - 1, x + s2);
            
            const idx = y * W + x;
            const br = y2 * W + x2;
            const tr = (y1 - 1) * W + x2;
            const bl = y2 * W + (x1 - 1);
            const tl = (y1 - 1) * W + (x1 - 1);
            
            let sum = S[br];
            if (y1 > 0) sum -= S[tr];
            if (x1 > 0) sum -= S[bl];
            if (y1 > 0 && x1 > 0) sum += S[tl];
            
            const count = (x2 - x1 + 1) * (y2 - y1 + 1);
            const avg = sum / count;
            const target = avg * (1.0 - t);
            
            let value = 255;
            if (g[idx] < target) {
              value = 0;
            } else if (g[idx] > avg) {
              value = 255;
            } else {
              const diff = avg - target;
              value = ((g[idx] - target) / (diff + 1)) * 255;
            }
            
            const pixelIdx = idx * 4;
            const r = data[pixelIdx];
            const g_val = data[pixelIdx + 1];
            const b = data[pixelIdx + 2];
            
            data[pixelIdx] = (1 - w) * r + w * value;
            data[pixelIdx + 1] = (1 - w) * g_val + w * value;
            data[pixelIdx + 2] = (1 - w) * b + w * value;
          }
        }
      } else if (filter === "marker") {
        const contrastFactor = 1.35;
        const brightnessOffset = 25;

        for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g_val = data[i + 1];
          const b = data[i + 2];

          const maxVal = Math.max(r, g_val, b);
          const minVal = Math.min(r, g_val, b);
          const sat = maxVal - minVal;

          if (sat < 35 && maxVal > 110) {
            const gray = 0.299 * r + 0.587 * g_val + 0.114 * b;
            let ng = (gray - 128) * contrastFactor + 128 + brightnessOffset + 15;
            ng = Math.max(0, Math.min(255, ng));
            
            data[i] = (1 - w) * r + w * ng;
            data[i + 1] = (1 - w) * g_val + w * ng;
            data[i + 2] = (1 - w) * b + w * ng;
          } else {
            const gray = 0.299 * r + 0.587 * g_val + 0.114 * b;
            let rs = gray + (r - gray) * 1.5;
            let gs = gray + (g_val - gray) * 1.5;
            let bs = gray + (b - gray) * 1.5;

            rs = (rs - 128) * contrastFactor + 128 + brightnessOffset;
            gs = (gs - 128) * contrastFactor + 128 + brightnessOffset;
            bs = (bs - 128) * contrastFactor + 128 + brightnessOffset;

            data[i] = Math.max(0, Math.min(255, (1 - w) * r + w * rs));
            data[i + 1] = Math.max(0, Math.min(255, (1 - w) * g_val + w * gs));
            data[i + 2] = Math.max(0, Math.min(255, (1 - w) * b + w * bs));
          }
        }
      } else if (filter === "vintage") {
        for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g_val = data[i + 1];
          const b = data[i + 2];

          const tr = (r * 0.393) + (g_val * 0.769) + (b * 0.189);
          const tg = (r * 0.349) + (g_val * 0.686) + (b * 0.168);
          const tb = (r * 0.272) + (g_val * 0.534) + (b * 0.131);

          const cr = Math.max(0, Math.min(255, (tr - 128) * 1.1 + 128 + 10));
          const cg = Math.max(0, Math.min(255, (tg - 128) * 1.1 + 128 + 5));
          const cb = Math.max(0, Math.min(255, (tb - 128) * 1.1 + 128));

          data[i] = (1 - w) * r + w * cr;
          data[i + 1] = (1 - w) * g_val + w * cg;
          data[i + 2] = (1 - w) * b + w * cb;
        }
      } else if (filter === "docgrayscale") {
        const contrastFactor = 1.35;
        const brightnessOffset = 25;

        for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g_val = data[i + 1];
          const b = data[i + 2];
          const gray = 0.299 * r + 0.587 * g_val + 0.114 * b;

          // Enhancing grayscale contrast and brightness
          let dg = (gray - 128) * contrastFactor + 128 + brightnessOffset;
          dg = Math.max(0, Math.min(255, dg));

          data[i] = (1 - w) * r + w * dg;
          data[i + 1] = (1 - w) * g_val + w * dg;
          data[i + 2] = (1 - w) * b + w * dg;
        }
      } else if (filter === "adobe_bw") {
        const W = canvas.width;
        const H = canvas.height;
        const g = new Uint8Array(W * H);
        for (let i = 0; i < len; i += 4) {
          g[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }

        const S = new Uint32Array(W * H);
        for (let y = 0; y < H; y++) {
          let rowSum = 0;
          for (let x = 0; x < W; x++) {
            const idx = y * W + x;
            rowSum += g[idx];
            if (y === 0) {
              S[idx] = rowSum;
            } else {
              S[idx] = S[(y - 1) * W + x] + rowSum;
            }
          }
        }

        const s = Math.floor(W / 8); // Window size
        const s2 = Math.floor(s / 2);
        // Map intensity 0..100 to sensitivity tolerance 2%..30%
        const t = 0.02 + (intensity / 100) * 0.28;

        for (let y = 0; y < H; y++) {
          const y1 = Math.max(0, y - s2);
          const y2 = Math.min(H - 1, y + s2);
          for (let x = 0; x < W; x++) {
            const x1 = Math.max(0, x - s2);
            const x2 = Math.min(W - 1, x + s2);
            
            const idx = y * W + x;
            const br = y2 * W + x2;
            const tr = (y1 - 1) * W + x2;
            const bl = y2 * W + (x1 - 1);
            const tl = (y1 - 1) * W + (x1 - 1);
            
            let sum = S[br];
            if (y1 > 0) sum -= S[tr];
            if (x1 > 0) sum -= S[bl];
            if (y1 > 0 && x1 > 0) sum += S[tl];
            
            const count = (x2 - x1 + 1) * (y2 - y1 + 1);
            const avg = sum / count;
            
            // Adaptive threshold
            const value = g[idx] < avg * (1.0 - t) ? 0 : 255;
            
            const pixelIdx = idx * 4;
            data[pixelIdx] = value;
            data[pixelIdx + 1] = value;
            data[pixelIdx + 2] = value;
          }
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

    // Lock scrolling on document/body for preview editor page
    const origOverflow = document.body.style.overflow;
    const origHeight = document.body.style.height;
    document.body.style.overflow = "hidden";
    document.body.style.height = "100%";
    if (document.documentElement) {
      document.documentElement.style.overflow = "hidden";
      document.documentElement.style.height = "100%";
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      // Restore scrolling when leaving preview editor
      document.body.style.overflow = origOverflow;
      document.body.style.height = origHeight;
      if (document.documentElement) {
        document.documentElement.style.overflow = "";
        document.documentElement.style.height = "";
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
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
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
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
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
      const defaultIntensity = (
        filterType === "whiteboard" ||
        filterType === "adobe_bw" ||
        filterType === "soft_bw" ||
        filterType === "sharp_color"
      ) ? 50 : 100;
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
          tl: crop.tl,
          tr: crop.tr,
          br: crop.br,
          bl: crop.bl,
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
      <div className="min-h-dvh bg-[#f4f5f9] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-600" />
          <p className="text-sm text-slate-550 font-medium">Loading VidScan Workspace...</p>
        </div>
      </div>
    );
  }

  return (

    <div className="h-dvh bg-[#f0f2f7] text-slate-800 flex flex-col overflow-hidden font-sans select-none">

      {/* ─── Navbar ──────────────────────────────────────────────────────────── */}
      <nav className="bg-gradient-to-r from-pink-600 to-indigo-700 text-white shadow-lg px-4 py-3 flex-shrink-0 z-10">
        <div className="flex items-center justify-between">
          <Link href="/convert" className="text-sm text-pink-100 hover:text-white transition flex items-center gap-1.5 font-semibold group">
            <svg className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to scanner
          </Link>
          <span className="font-bold text-white text-sm flex items-center gap-2 tracking-tight">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            VidScan Editor
          </span>
          <span className="w-32" />
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
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden" style={{height: 'calc(100dvh - 52px)'}}>

          {/* ─── DESKTOP LEFT PANEL: Thumbnails Strip (Hidden on mobile) ───────── */}
          <div className="hidden md:flex flex-col bg-white border-r border-slate-200/80 flex-shrink-0 overflow-hidden shadow-sm" style={{width: '220px'}}>
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-pink-500"></div>
                <h3 className="font-bold text-slate-600 text-xs uppercase tracking-widest">Pages</h3>
              </div>
              <span className="text-[11px] bg-pink-600 text-white font-bold px-2 py-0.5 rounded-full font-mono shadow-sm">
                {pages.length}
              </span>
            </div>

            {/* Scrollable thumbnail list — only thumbnails scroll */}
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
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
                    onClick={() => setActiveIdx(idx)}
                    className={`relative group shrink-0 rounded-xl border-2 cursor-pointer transition-all duration-200
                      ${isSelected
                        ? 'border-pink-500 shadow-[0_0_0_3px_rgba(236,72,153,0.15)] bg-white'
                        : 'border-slate-200 hover:border-pink-300 bg-white hover:shadow-md'
                      }
                      ${dragOverIdx === idx ? 'border-dashed border-pink-400 bg-pink-50/50 scale-[0.97]' : ''}
                    `}
                  >
                    {/* Selected indicator stripe */}
                    {isSelected && (
                      <div className="absolute left-0 top-3 bottom-3 w-0.5 bg-pink-500 rounded-r-full" />
                    )}

                    {/* Thumbnail image */}
                    <div className="aspect-[3/4] w-full relative bg-slate-50 rounded-[10px] overflow-hidden flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`data:image/jpeg;base64,${p.image}`}
                        alt={`Page ${idx + 1}`}
                        className="max-h-full max-w-full object-contain pointer-events-none"
                        style={{
                          transform: `rotate(${p.rotation}deg)`,
                          filter: `brightness(${100 + p.brightness * 2}%) contrast(${100 + p.contrast * 2}%)`,
                        }}
                      />
                      {/* Page number badge */}
                      <span className="absolute bottom-1 left-1 bg-slate-900/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                        {idx + 1}
                      </span>
                    </div>

                    {/* Page label */}
                    <div className="px-2 py-1.5 flex items-center justify-between">
                      <span className={`text-[10px] font-semibold truncate ${isSelected ? 'text-pink-600' : 'text-slate-500'}`}>
                        Page {idx + 1}
                      </span>
                      {/* Drag icon */}
                      <svg className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDelete(e, idx)}
                      aria-label={`Delete Page ${idx + 1}`}
                      className="absolute top-1.5 right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* ── Add Page Footer (fixed, never scrolls) ─────────────────── */}
            <div className="flex-shrink-0 p-3 border-t border-slate-100 bg-gradient-to-t from-slate-50 to-white">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 text-center">Add Page</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="group flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-pink-200 bg-pink-50/50 py-2.5 transition-all hover:border-pink-400 hover:bg-pink-50 hover:shadow-sm focus:outline-none"
                >
                  <svg className="h-4 w-4 text-pink-400 group-hover:text-pink-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="text-[10px] font-bold text-slate-500 group-hover:text-pink-600 transition-colors">Upload</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setCaptureMode("add"); openCamera(); }}
                  className="group flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 py-2.5 transition-all hover:border-indigo-400 hover:bg-indigo-50 hover:shadow-sm focus:outline-none"
                >
                  <svg className="h-4 w-4 text-indigo-400 group-hover:text-indigo-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" /></svg>
                  <span className="text-[10px] font-bold text-slate-500 group-hover:text-indigo-600 transition-colors">Camera</span>
                </button>
              </div>
            </div>
          </div>

          {/* ─── CENTER: Canvas Viewport ─────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden relative bg-[#f0f2f7]">
            {activePage ? (
              <div className="flex-1 flex flex-col w-full h-full overflow-hidden">

                {/* Canvas area */}
                <div className="flex-1 flex flex-col items-stretch relative overflow-hidden">

                  {/* Crop active banner (desktop only) */}
                  {isCropping && (
                    <div className="hidden md:flex items-center justify-center gap-2 bg-pink-600 text-white text-xs font-bold py-2 px-4 flex-shrink-0">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 2v14a2 2 0 002 2h14M18 22V8a2 2 0 00-2-2H2" /></svg>
                      Drag the corners to adjust perspective — click <span className="bg-white/20 px-1.5 py-0.5 rounded ml-1 mr-1">Confirm</span> when done
                    </div>
                  )}

                  {/* Main canvas viewport */}
                  <div className="flex-1 flex items-center justify-center relative overflow-hidden p-6 pb-6 md:pb-20">
                    {/* Applying crop overlay */}
                    {isCropApplying && (
                      <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/80 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-3 bg-white rounded-2xl px-8 py-6 shadow-2xl border border-slate-200">
                          <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-pink-600" />
                          <p className="text-sm text-slate-600 font-semibold">Applying perspective crop…</p>
                        </div>
                      </div>
                    )}

                    {isCropping ? (
                      <div className="w-full h-full relative z-20">
                        <PerspectiveCropOverlay
                          imageUrl={`data:image/jpeg;base64,${activePage.originalImage}`}
                          imageAlt={`Page ${activeIdx + 1} Editor`}
                          initialPoints={activePage.crop}
                          onConfirm={handleCropConfirm}
                          onCancel={() => setIsCropping(false)}
                        />
                      </div>
                    ) : (
                      <div className="relative flex items-center justify-center w-full h-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`data:image/jpeg;base64,${activePage.image}`}
                          alt="Active Preview"
                          className="max-h-full max-w-full object-contain rounded-xl border border-slate-200/80 bg-white shadow-[0_8px_40px_rgba(0,0,0,0.12)] transition-all duration-300 ease-out hidden md:block"
                          style={{
                            filter: `brightness(${100 + activePage.brightness * 2}%) contrast(${100 + activePage.contrast * 2}%)`,
                            transform: `rotate(${activePage.rotation}deg)`,
                          }}
                        />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`data:image/jpeg;base64,${activePage.image}`}
                          alt="Active Preview"
                          className="max-h-[50vh] max-w-full object-contain rounded-xl border border-slate-200/80 bg-white shadow-md transition-all duration-300 ease-out md:hidden"
                          style={{
                            filter: `brightness(${100 + activePage.brightness * 2}%) contrast(${100 + activePage.contrast * 2}%)`,
                            transform: `rotate(${activePage.rotation}deg)`,
                          }}
                        />

                        {/* Desktop page info badge */}
                        <div className="hidden md:flex absolute top-3 left-3 items-center gap-1.5 bg-slate-900/80 border border-white/10 backdrop-blur text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shadow">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          Page {activeIdx + 1} of {pages.length}
                          <span className="ml-1 bg-white/20 rounded px-1">{activePage.filter.toUpperCase()}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── DESKTOP FLOATING BOTTOM TOOLBAR ── always visible, never scrolls */}
                  <div className="hidden md:flex absolute bottom-4 left-1/2 -translate-x-1/2 items-center bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.10)] px-2 py-1.5 gap-0.5 z-20">
                    {/* Rotate Left */}
                    <button
                      onClick={handleRotateLeft}
                      disabled={isCropping}
                      title="Rotate Left"
                      className="group flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:text-slate-900"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Rotate
                    </button>

                    <div className="w-px h-6 bg-slate-200 mx-0.5" />

                    {/* Crop toggle */}
                    <button
                      onClick={() => { setIsCropping((v) => !v); }}
                      title={isCropping ? 'Exit Crop Mode' : 'Crop & Perspective'}
                      className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all
                        ${isCropping
                          ? 'bg-pink-600 text-white shadow-md'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 2v14a2 2 0 002 2h14M18 22V8a2 2 0 00-2-2H2" />
                      </svg>
                      {isCropping ? 'Exit Crop' : 'Crop'}
                    </button>

                    <div className="w-px h-6 bg-slate-200 mx-0.5" />

                    {/* Rotate Right */}
                    <button
                      onClick={handleRotateRight}
                      disabled={isCropping}
                      title="Rotate Right"
                      className="group flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:text-slate-900"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{transform: 'scaleX(-1)'}}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Rotate
                    </button>

                    <div className="w-px h-6 bg-slate-200 mx-0.5" />

                    {/* Page counter */}
                    <div className="flex items-center gap-1 px-3 py-2 text-xs text-slate-400 font-semibold">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      <span className="font-bold text-slate-600">{activeIdx + 1}</span>
                      <span>/ {pages.length}</span>
                    </div>
                  </div>
                </div>

                {/* Mobile top page indicator overlay */}
                <div className="md:hidden text-center text-xs text-slate-500 py-1.5 font-medium">
                  Page {activeIdx + 1} of {pages.length}
                </div>

                {/* Mobile horizontal thumbnails strip */}
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
                          onClick={() => setActiveIdx(idx)}
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
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="shrink-0 w-16 aspect-[3/4] border border-dashed border-pink-200 bg-gradient-to-b from-white to-pink-50/20 rounded-xl flex flex-col items-center justify-center gap-1 transition-all text-pink-600 active:scale-95 shadow-sm"
                    >
                      <span className="text-base leading-none">📁</span>
                      <span className="text-[9px] font-bold text-slate-600 font-medium">Upload</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCaptureMode("add"); openCamera(); }}
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

            {/* ─── MOBILE BOTTOM SHEETS ─────────────────────────────────────────── */}
            {activeSheet !== "none" && !isCropping && (
              <>
                <div onClick={() => setActiveSheet("none")} className="absolute inset-0 bg-transparent z-30" />
                <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-250 rounded-t-3xl p-5 pb-[calc(env(safe-area-inset-bottom)+24px)] z-40 animate-in slide-in-from-bottom duration-200 max-h-[85vh] overflow-y-auto shadow-2xl text-slate-800">
                  <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
                  {activeSheet === "filters" && activePage && (
                    <div className="space-y-4 max-h-[60vh] flex flex-col">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block flex-shrink-0">
                        Choose Scan Enhancement
                      </span>
                      <div className="space-y-2 overflow-y-auto flex-1 pb-4">
                        {FILTERS.map((f) => {
                          const isActive = activePage.filter === f.id;
                          const hasIntensity = f.id !== "original";
                          return (
                            <div
                              key={f.id}
                              className={`group flex flex-col rounded-xl overflow-hidden border transition-all duration-200
                                ${isActive
                                  ? 'border-pink-500 shadow-sm bg-white'
                                  : 'border-slate-150 bg-slate-50 text-slate-650'
                                }`}
                            >
                              {/* Filter click header */}
                              <div
                                onClick={() => handleFilterSelect(f.id)}
                                className={`w-full flex items-center gap-3 px-3.5 py-3 cursor-pointer select-none text-xs font-semibold
                                  ${isActive
                                    ? 'bg-gradient-to-r from-pink-600 to-indigo-600 text-white'
                                    : 'text-slate-700 active:bg-slate-100'
                                  }`}
                              >
                                <span className="text-base flex-shrink-0">{f.icon}</span>
                                <div className="text-left flex-1 min-w-0">
                                  <div className="font-bold text-xs">{f.label}</div>
                                  <div className={`text-[10px] ${isActive ? 'text-white/80' : 'text-slate-450'}`}>
                                    {f.description}
                                  </div>
                                </div>
                                {isActive && (
                                  <svg className="h-3.5 w-3.5 flex-shrink-0 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>

                              {/* Nested Intensity Dropdown Slider */}
                              {isActive && hasIntensity && (
                                <div className="px-4 pb-3.5 pt-2.5 bg-slate-50 border-t border-slate-100 text-slate-800 animate-in slide-in-from-top duration-200">
                                  <div className="flex justify-between items-center mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    <span>
                                      {f.id === "whiteboard" ? "Line Thickness" : "Enhancement Intensity"}
                                    </span>
                                    <span className="text-pink-600 font-bold font-mono text-[11px]">{activePage.filterIntensity}%</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={activePage.filterIntensity}
                                    onChange={(e) => handleIntensityChange(parseInt(e.target.value))}
                                    className="w-full h-1.5 appearance-none rounded-full bg-slate-200 accent-pink-600 cursor-pointer focus:outline-none"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {activeSheet === "adjust" && activePage && (
                    <div className="space-y-4">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Manual Adjustments</span>
                      <div className="space-y-3.5">
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 font-semibold">Brightness</span>
                            <span className="text-pink-700 font-bold font-mono">{activePage.brightness}</span>
                          </div>
                          <input type="range" min="-50" max="50" value={activePage.brightness} onChange={(e) => updateActivePage({ brightness: parseInt(e.target.value) })} className="w-full h-1.5 appearance-none rounded-full bg-slate-100 border border-slate-205 accent-pink-600 cursor-pointer focus:outline-none" />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500 font-semibold">Contrast</span>
                            <span className="text-pink-700 font-bold font-mono">{activePage.contrast}</span>
                          </div>
                          <input type="range" min="-50" max="50" value={activePage.contrast} onChange={(e) => updateActivePage({ contrast: parseInt(e.target.value) })} className="w-full h-1.5 appearance-none rounded-full bg-slate-100 border border-slate-205 accent-pink-600 cursor-pointer focus:outline-none" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ─── MOBILE ONLY: BOTTOM DOCK TOOLBAR ────────────────────────────── */}
            {activePage && (
              <footer className="md:hidden flex justify-around bg-white border-t border-slate-200 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] px-2 select-none shrink-0 z-20 shadow-[0_-8px_30px_rgb(0,0,0,0.06)]">
                <button onClick={() => { setIsCropping((v) => !v); setActiveSheet("none"); }} className={`flex flex-col items-center gap-1 text-[10px] font-bold w-14 ${isCropping ? "text-pink-600" : "text-slate-500 hover:text-slate-800"}`}>
                  <span className="text-base">✂️</span><span>Crop</span>
                </button>
                <button onClick={() => { setActiveSheet(activeSheet === "filters" ? "none" : "filters"); setIsCropping(false); }} className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-colors w-14 ${activeSheet === "filters" && !isCropping ? "text-pink-600" : "text-slate-500 hover:text-slate-800"}`}>
                  <span className="text-base">🎨</span><span>Filters</span>
                </button>
                <button onClick={() => { setActiveSheet(activeSheet === "adjust" ? "none" : "adjust"); setIsCropping(false); }} className={`flex flex-col items-center gap-1 text-[10px] font-bold transition-colors w-14 ${activeSheet === "adjust" && !isCropping ? "text-pink-600" : "text-slate-500 hover:text-slate-800"}`}>
                  <span className="text-base">⚙️</span><span>Adjust</span>
                </button>
                <button onClick={handleRotateRight} className="flex flex-col items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 w-14">
                  <span className="text-base">🔄</span><span>Rotate</span>
                </button>
                <button onClick={() => { setCaptureMode("recapture"); openCamera(); }} className="flex flex-col items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 w-14 transition-colors">
                  <span className="text-base">📷</span><span>Recapture</span>
                </button>
              </footer>
            )}
          </div>

          {/* ─── DESKTOP RIGHT PANEL: Tools Sidebar (Hidden on mobile) ────────── */}
          {activePage && (
            <div className="hidden md:flex flex-col bg-white border-l border-slate-200/80 flex-shrink-0 overflow-hidden" style={{width: '264px'}}>

              {/* ── TOP: Header + Download PDF always visible ──────────────────── */}
              <div className="flex-shrink-0 border-b border-slate-100">
                {/* Page info header */}
                <div className="px-4 py-3 bg-gradient-to-r from-white to-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Tools</span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400">Page {activeIdx + 1} / {pages.length}</span>
                </div>

                {/* Primary Actions — always visible */}
                <div className="px-3 pb-3 space-y-2">
                  <button
                    id="generate-pdf-btn"
                    disabled={isGenerating}
                    onClick={handleDownloadPdf}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-pink-500/25 transition-all hover:shadow-xl hover:shadow-pink-500/30 hover:-translate-y-0.5"
                  >
                    {isGenerating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white flex-shrink-0" />
                        Generating PDF…
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        Download PDF
                      </>
                    )}
                  </button>
                  <Link
                    href="/convert"
                    className="flex items-center justify-center gap-2 w-full rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500 transition-all hover:shadow-sm hover:border-slate-300 hover:text-slate-700"
                  >
                    <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                    Rescan Document
                  </Link>
                </div>
              </div>

              {/* ── MIDDLE: Scrollable Tools ─────────────────────────────────── */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-3 space-y-4">

                  {/* Recapture + Reset — first thing user sees in tools */}
                  <div className="space-y-1.5">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Page Actions</p>
                    <button
                      onClick={() => { setCaptureMode("recapture"); openCamera(); }}
                      className="group w-full flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 px-3 py-2.5 text-xs font-bold text-slate-600 transition-all hover:shadow-sm"
                    >
                      <svg className="h-4 w-4 text-slate-400 group-hover:text-indigo-500 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" /></svg>
                      Recapture This Page
                    </button>
                    <button
                      onClick={resetEdits}
                      disabled={isCropping}
                      className="group w-full flex items-center gap-2.5 rounded-xl border border-red-100 bg-red-50/80 hover:bg-red-100 px-3 py-2.5 text-xs font-bold text-red-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm"
                    >
                      <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      Reset All Edits
                    </button>
                  </div>

                  <div className="border-t border-slate-100" />

                  {/* Transform */}
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Transform</p>
                    <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                      <button
                        onClick={handleRotateLeft}
                        disabled={isCropping}
                        className="group flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 px-2 py-2.5 text-xs font-semibold text-slate-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm"
                      >
                        <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Rotate L
                      </button>
                      <button
                        onClick={handleRotateRight}
                        disabled={isCropping}
                        className="group flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 px-2 py-2.5 text-xs font-semibold text-slate-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-sm"
                      >
                        <svg className="h-3.5 w-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} style={{transform: 'scaleX(-1)'}}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Rotate R
                      </button>
                    </div>
                    <button
                      onClick={() => { setIsCropping((v) => !v); }}
                      className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all
                        ${isCropping
                          ? 'bg-pink-600 text-white shadow-md shadow-pink-200'
                          : 'border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:border-slate-300 hover:shadow-sm'
                        }`}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 2v14a2 2 0 002 2h14M18 22V8a2 2 0 00-2-2H2" /></svg>
                      {isCropping ? 'Cropping Active…' : 'Crop & Perspective'}
                    </button>
                  </div>

                  <div className="border-t border-slate-100" />

                  {/* Scan Filters */}
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Scan Filter</p>
                    <div className="space-y-1.5">
                      {FILTERS.map((f) => {
                        const isActive = activePage.filter === f.id;
                        const hasIntensity = f.id !== "original";
                        return (
                          <div
                            key={f.id}
                            className={`group flex flex-col rounded-xl overflow-hidden border transition-all duration-200
                              ${isActive
                                ? 'border-pink-500 shadow-sm'
                                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300'
                              } ${isCropping ? 'opacity-40 pointer-events-none' : ''}`}
                          >
                            {/* Filter click header */}
                            <div
                              onClick={() => !isCropping && handleFilterSelect(f.id)}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 cursor-pointer select-none text-xs font-semibold
                                ${isActive
                                  ? 'bg-gradient-to-r from-pink-600 to-indigo-600 text-white'
                                  : 'text-slate-600'
                                }`}
                            >
                              <span className="text-sm flex-shrink-0">{f.icon}</span>
                              <div className="text-left flex-1 min-w-0">
                                <div className="font-bold truncate">{f.label}</div>
                                <div className={`text-[9px] truncate ${isActive ? 'text-white/75' : 'text-slate-400'}`}>
                                  {f.description}
                                </div>
                              </div>
                              {isActive && (
                                <svg className="h-3 w-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>

                            {/* Nested Intensity Dropdown Slider */}
                            {isActive && hasIntensity && (
                              <div className="px-3 pb-3 pt-2 bg-slate-50 border-t border-slate-100/80 animate-in slide-in-from-top duration-200 text-slate-800">
                                <div className="flex justify-between items-center mb-1 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                                  <span>
                                    {f.id === "whiteboard" ? "Threshold" : "Intensity"}
                                  </span>
                                  <span className="text-pink-600 font-bold font-mono text-[10px]">{activePage.filterIntensity}%</span>
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
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-slate-100" />

                  {/* Adjustments */}
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Adjustments</p>
                    <div className="space-y-2">
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-600 font-semibold">Brightness</span>
                          <span className="text-pink-600 font-bold font-mono text-[11px]">{activePage.brightness > 0 ? `+${activePage.brightness}` : activePage.brightness}</span>
                        </div>
                        <input type="range" min="-50" max="50" value={activePage.brightness}
                          onChange={(e) => updateActivePage({ brightness: parseInt(e.target.value) })}
                          disabled={isCropping}
                          className="w-full h-1.5 appearance-none rounded-full bg-slate-200 accent-pink-600 cursor-pointer focus:outline-none disabled:opacity-40"
                        />
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-slate-600 font-semibold">Contrast</span>
                          <span className="text-pink-600 font-bold font-mono text-[11px]">{activePage.contrast > 0 ? `+${activePage.contrast}` : activePage.contrast}</span>
                        </div>
                        <input type="range" min="-50" max="50" value={activePage.contrast}
                          onChange={(e) => updateActivePage({ contrast: parseInt(e.target.value) })}
                          disabled={isCropping}
                          className="w-full h-1.5 appearance-none rounded-full bg-slate-200 accent-pink-600 cursor-pointer focus:outline-none disabled:opacity-40"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bottom spacer */}
                  <div className="h-2" />
                </div>
              </div>
            </div>
          )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 md:backdrop-blur-sm p-0 md:p-4 animate-in fade-in duration-200">
          <div className="relative w-full h-full md:h-auto md:max-w-lg md:rounded-3xl bg-black md:bg-slate-900 md:border md:border-slate-800 text-white shadow-2xl overflow-hidden flex flex-col justify-between">

            {/* Modal Header */}
            <div className="absolute md:relative top-0 left-0 right-0 z-10 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent md:bg-slate-900 md:border-b md:border-slate-800/80">
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
            <div className="relative flex-1 md:flex-none w-full h-full md:h-auto md:aspect-[4/3] bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                playsInline
                className="w-full h-full object-cover"
              />

              {isRequestingCamera && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 z-20">
                  <div className="w-8 h-8 rounded-full border-4 border-pink-500 border-t-transparent animate-spin" />
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Requesting Camera Access…</p>
                </div>
              )}
            </div>

            {/* Error Message */}
            {cameraError && (
              <div className="absolute md:relative bottom-28 md:bottom-auto left-4 right-4 md:left-auto md:right-auto z-20 bg-red-950/90 md:bg-red-950/80 border border-red-900/50 rounded-xl px-4 py-3 text-xs text-red-300 font-medium flex gap-2 shadow-2xl">
                <span>⚠️</span>
                <span>{cameraError}</span>
              </div>
            )}

            {/* Control Buttons */}
            <div className="absolute md:relative bottom-0 left-0 right-0 z-10 p-8 md:p-6 bg-gradient-to-t from-black/90 via-black/55 to-transparent md:bg-slate-900 md:from-transparent md:to-transparent flex justify-center items-center gap-4">
              <button
                type="button"
                onClick={capturePhoto}
                disabled={isRequestingCamera || !!cameraError}
                className="w-20 h-20 md:w-full md:h-auto rounded-full md:rounded-2xl bg-gradient-to-r from-pink-600 to-indigo-700 hover:from-pink-500 hover:to-indigo-655 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-extrabold shadow-lg shadow-pink-600/20 active:scale-95 transition-all text-center flex flex-col md:flex-row items-center justify-center gap-2 border-4 border-white/20 md:border-0"
              >
                <span className="text-2xl md:text-base">📸</span>
                <span className="md:inline hidden">Capture Photo</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}




