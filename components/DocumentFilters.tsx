"use client";

import { useEffect, useRef, useState } from "react";

// ─── Types & Interfaces ──────────────────────────────────────────────────────

export type DocumentFilterType = "original" | "grayscale" | "b&w" | "magic";

export interface DocumentFiltersProps {
  /** The source URL or base64 data string of the image. */
  imageUrl: string;
  /** Callback returned when the user clicks the "Save" button. Passes the base64 filtered image. */
  onSave: (filteredBase64: string) => void;
  /** Initial selected filter. Defaults to "original". */
  initialFilter?: DocumentFilterType;
  /** Optional class styling for the outer wrapper. */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DocumentFilters({
  imageUrl,
  onSave,
  initialFilter = "original",
  className = "",
}: DocumentFiltersProps) {
  const [selectedFilter, setSelectedFilter] = useState<DocumentFilterType>(initialFilter);
  const [processedImageUrl, setProcessedImageUrl] = useState<string>(imageUrl);
  const [loading, setLoading] = useState<boolean>(true);
  const [processing, setProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceImageRef = useRef<HTMLImageElement | null>(null);

  // ── Load Source Image ──────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    setErrorMsg("");

    const img = new Image();
    // Allow cross-origin image data fetching for canvas rendering if URL is external
    if (!imageUrl.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }

    img.onload = () => {
      sourceImageRef.current = img;
      setLoading(false);
      // Apply the currently selected filter to the newly loaded image
      applyFilter(selectedFilter, img);
    };

    img.onerror = () => {
      setErrorMsg("Failed to load document image for filtering.");
      setLoading(false);
    };

    img.src = imageUrl;
  }, [imageUrl]);

  // ── Dynamic Canvas Filtering Math ──────────────────────────────────────────

  const applyFilter = (filterType: DocumentFilterType, customImg?: HTMLImageElement) => {
    const img = customImg || sourceImageRef.current;
    if (!img) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setProcessing(true);

    // Set canvas dimensions equal to original image dimensions to preserve quality
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    // Draw original image onto canvas
    ctx.drawImage(img, 0, 0);

    if (filterType === "original") {
      setProcessedImageUrl(canvas.toDataURL("image/jpeg", 0.92));
      setProcessing(false);
      return;
    }

    // Retrieve pixel array
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const len = data.length;

    // Mathematical processing of pixels
    switch (filterType) {
      case "grayscale": {
        for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Luma formula for grayscale conversion
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;

          data[i] = gray;     // R
          data[i + 1] = gray; // G
          data[i + 2] = gray; // B
        }
        break;
      }

      case "b&w": {
        // High-contrast local adaptive thresholding simulation
        // First compute average brightness of the document to get dynamic threshold midpoint
        let totalLuminance = 0;
        const totalPixels = len / 4;
        
        for (let i = 0; i < len; i += 4) {
          totalLuminance += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        
        const dynamicMidpoint = totalLuminance / totalPixels;
        // Standard threshold offset to keep text legible and background white
        const threshold = Math.max(100, Math.min(dynamicMidpoint - 12, 140));

        for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          // Clean thresholding: Under threshold -> black, Over -> white
          const value = gray < threshold ? 0 : 255;

          data[i] = value;
          data[i + 1] = value;
          data[i + 2] = value;
        }
        break;
      }

      case "magic": {
        // Magic Color Enhancements:
        // 1. Contrast increase: (val - 128) * factor + 128 + brightnessOffset
        // 2. Color saturation boost in RGB: val + (val - gray) * saturationFactor
        const contrastFactor = 1.22;
        const brightnessOffset = 10;
        const saturationFactor = 1.35;

        for (let i = 0; i < len; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Gray representation for saturation baseline
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;

          // Apply Saturation Boost
          let rs = gray + (r - gray) * saturationFactor;
          let gs = gray + (g - gray) * saturationFactor;
          let bs = gray + (b - gray) * saturationFactor;

          // Apply Contrast & Brightness Enhancement
          rs = (rs - 128) * contrastFactor + 128 + brightnessOffset;
          gs = (gs - 128) * contrastFactor + 128 + brightnessOffset;
          bs = (bs - 128) * contrastFactor + 128 + brightnessOffset;

          // Clamp values to valid 0-255 range
          data[i] = Math.max(0, Math.min(255, rs));
          data[i + 1] = Math.max(0, Math.min(255, gs));
          data[i + 2] = Math.max(0, Math.min(255, bs));
        }
        break;
      }
    }

    // Write processed pixels back to canvas
    ctx.putImageData(imgData, 0, 0);
    setProcessedImageUrl(canvas.toDataURL("image/jpeg", 0.92));
    setProcessing(false);
  };

  const handleFilterClick = (filterType: DocumentFilterType) => {
    setSelectedFilter(filterType);
    applyFilter(filterType);
  };

  // ── Save action ────────────────────────────────────────────────────────────

  const handleSave = () => {
    if (processing || loading) return;
    onSave(processedImageUrl);
  };

  return (
    <div className={`flex flex-col items-center gap-6 w-full ${className}`}>
      
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Main Image viewport */}
      <div className="relative w-full aspect-[3/4] max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-xl flex items-center justify-center overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            <span className="text-xs">Loading image...</span>
          </div>
        ) : errorMsg ? (
          <div className="text-center text-red-400 p-4">
            <span className="text-2xl">⚠️</span>
            <p className="text-xs font-semibold mt-2">{errorMsg}</p>
          </div>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={processedImageUrl}
              alt="Processed Document Preview"
              className="max-h-full max-w-full object-contain transition-opacity duration-150"
              style={{ opacity: processing ? 0.5 : 1 }}
            />
            {processing && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20 backdrop-blur-[1px]">
                <div className="bg-slate-900/90 border border-slate-800 px-4 py-2 rounded-xl text-xs text-slate-300 font-semibold shadow-lg">
                  Applying filter…
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Filter Buttons row */}
      <div className="w-full max-w-md">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block mb-2 px-1">
          Choose Scan Mode
        </span>
        <div className="grid grid-cols-4 gap-2 bg-slate-900/80 border border-slate-850 p-1.5 rounded-2xl">
          {(
            [
              { id: "original", label: "Original", icon: "🖼️" },
              { id: "magic", label: "Magic", icon: "✨" },
              { id: "grayscale", label: "Grayscale", icon: "🎨" },
              { id: "b&w", label: "B&W", icon: "🌓" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={loading || processing}
              onClick={() => handleFilterClick(item.id)}
              className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-[10px] font-bold transition-all duration-200
                ${
                  selectedFilter === item.id
                    ? "bg-blue-600 text-white shadow-lg"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }
              `}
            >
              <span className="text-sm">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Action CTA */}
      <button
        type="button"
        disabled={loading || processing}
        onClick={handleSave}
        className="w-full max-w-md py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Save Filter Edits
      </button>

    </div>
  );
}
