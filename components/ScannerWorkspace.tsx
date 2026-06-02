"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import PerspectiveCropOverlay, { type PerspectivePoints } from "./PerspectiveCropOverlay";

// ─── Interfaces & Types ──────────────────────────────────────────────────────

export type ScanFilter = "original" | "magic" | "grayscale" | "whiteboard";

export interface ScannedPage {
  id: string;
  image: string; // base64 data string or URL
  rotation: number; // 0, 90, 180, 270
  filter: ScanFilter;
  crop?: PerspectivePoints;
}

export interface ScannerWorkspaceProps {
  initialPages: ScannedPage[];
  onSaveDocument: (pages: ScannedPage[]) => void;
  onAddPageClick?: () => void;
  isSaving?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTERS: { id: ScanFilter; label: string; description: string; previewClass: string }[] = [
  {
    id: "original",
    label: "Original",
    description: "Keep original colors & lighting",
    previewClass: "",
  },
  {
    id: "magic",
    label: "Magic Color",
    description: "Boost color saturation & contrast",
    previewClass: "saturate-[1.35] contrast-[1.1] brightness-[1.02]",
  },
  {
    id: "grayscale",
    label: "Grayscale",
    description: "Convert to smooth gray tones",
    previewClass: "grayscale contrast-[1.05] brightness-[1.05]",
  },
  {
    id: "whiteboard",
    label: "Whiteboard",
    description: "High contrast monochrome scan",
    previewClass: "grayscale contrast-[1.6] brightness-[1.15] threshold-simulate",
  },
];

type ToolMode = "view" | "crop" | "filters";

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScannerWorkspace({
  initialPages,
  onSaveDocument,
  onAddPageClick,
  isSaving = false,
}: ScannerWorkspaceProps) {
  const [pages, setPages] = useState<ScannedPage[]>(initialPages);
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [toolMode, setToolMode] = useState<ToolMode>("view");
  const [successMsg, setSuccessMsg] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Sync state if initialPages prop changes externally
  useEffect(() => {
    setPages(initialPages);
    setActiveIdx(0);
    setToolMode("view");
  }, [initialPages]);

  const activePage = pages[activeIdx] || null;

  // ── Helper to update active page state ──────────────────────────────────────
  const updateActivePage = useCallback((updates: Partial<ScannedPage>) => {
    setPages((prev) =>
      prev.map((p, idx) => (idx === activeIdx ? { ...p, ...updates } : p))
    );
  }, [activeIdx]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleRotate = () => {
    if (!activePage) return;
    const nextRotation = (activePage.rotation + 90) % 360;
    updateActivePage({ rotation: nextRotation });
    showToast("Rotated 90° clockwise");
  };

  const handleDelete = () => {
    if (pages.length === 0) return;
    const confirmed = window.confirm("Are you sure you want to delete this page?");
    if (!confirmed) return;

    const nextPages = pages.filter((_, idx) => idx !== activeIdx);
    setPages(nextPages);

    // Adjust active index
    if (nextPages.length === 0) {
      setActiveIdx(0);
    } else {
      setActiveIdx(Math.min(activeIdx, nextPages.length - 1));
    }
    setToolMode("view");
    showToast("Page deleted");
  };

  const handleCropConfirm = async (crop: PerspectivePoints) => {
    if (!activePage) return;
    updateActivePage({ crop });
    setToolMode("view");
    showToast("Crop region saved");
  };

  const handleLocalAddPage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPages: ScannedPage[] = [];
    const readPromises = Array.from(files).map((file) => {
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          newPages.push({
            id: `page-${Date.now()}-${Math.random().toString(36).substring(4)}`,
            image: reader.result as string,
            rotation: 0,
            filter: "original",
          });
          resolve();
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readPromises).then(() => {
      setPages((prev) => {
        const updated = [...prev, ...newPages];
        setActiveIdx(updated.length - newPages.length); // Switch to the first newly added page
        return updated;
      });
      showToast(`Added ${newPages.length} new page(s)`);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Drag & Drop Thumbnail Reordering ────────────────────────────────────────
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

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

    // Update active index to track the moved item
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

  // ── Toast notifications ────────────────────────────────────────────────────
  const showToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  // ── Auto-scroll thumbnail container to active page ─────────────────────────
  useEffect(() => {
    if (scrollContainerRef.current) {
      const activeEl = scrollContainerRef.current.querySelector(
        `[data-index="${activeIdx}"]`
      ) as HTMLElement;
      if (activeEl) {
        scrollContainerRef.current.scrollTo({
          left: activeEl.offsetLeft - scrollContainerRef.current.clientWidth / 2 + activeEl.clientWidth / 2,
          behavior: "smooth",
        });
      }
    }
  }, [activeIdx]);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      
      {/* ─── LEFT/SIDE PANEL: Document Thumbnails strip ─────────────────────── */}
      <aside className="w-full md:w-80 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col shrink-0 overflow-hidden z-10">
        <div className="px-4 py-3.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="text-blue-500 font-bold">📄 Document</span>
            <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full text-slate-400 font-semibold font-mono">
              {pages.length} Pages
            </span>
          </div>

          <button
            onClick={() => onSaveDocument(pages)}
            disabled={isSaving || pages.length === 0}
            className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-3 py-1.5 rounded-lg font-semibold transition"
          >
            {isSaving ? "Saving..." : "Save PDF"}
          </button>
        </div>

        {/* Scrollable Thumbnails list */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto md:overflow-y-auto p-4 flex flex-row md:flex-col gap-4 min-w-0 items-start md:items-stretch"
        >
          {pages.map((p, idx) => {
            const isSelected = idx === activeIdx;
            const filterInfo = FILTERS.find((f) => f.id === p.filter);

            return (
              <div
                key={p.id}
                data-index={idx}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                onClick={() => {
                  setActiveIdx(idx);
                  setToolMode("view");
                }}
                className={`relative group shrink-0 w-28 md:w-full bg-slate-950 rounded-xl border-2 p-1.5 cursor-pointer shadow-md transition-all flex flex-col justify-between
                  ${
                    isSelected
                      ? "border-blue-500 ring-4 ring-blue-500/10 bg-blue-950/20"
                      : "border-slate-800 hover:border-slate-700"
                  }
                  ${
                    dragOverIdx === idx
                      ? "border-dashed border-blue-400 bg-blue-950/40 scale-[0.98]"
                      : ""
                  }
                `}
              >
                {/* Visual Image container inside thumbnail */}
                <div className="aspect-[3/4] relative bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.image}
                    alt={`Page ${idx + 1}`}
                    className={`max-h-full max-w-full object-contain pointer-events-none transition-all duration-300 ${
                      filterInfo?.previewClass || ""
                    }`}
                    style={{
                      transform: `rotate(${p.rotation}deg)`,
                    }}
                  />
                  {/* Page index badge */}
                  <span className="absolute bottom-2 left-2 bg-slate-950/85 backdrop-blur border border-slate-800 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                    {idx + 1}
                  </span>
                </div>

                <div className="hidden md:flex justify-between items-center mt-2 px-1 text-[11px] text-slate-400">
                  <span className="capitalize">{p.filter}</span>
                  {p.crop && <span className="text-[10px] text-blue-400">Cropped</span>}
                </div>
              </div>
            );
          })}

          {/* Add Page inline button */}
          <button
            onClick={() => {
              if (onAddPageClick) {
                onAddPageClick();
              } else {
                fileInputRef.current?.click();
              }
            }}
            className="shrink-0 w-28 md:w-full aspect-[3/4] border-2 border-dashed border-slate-800 hover:border-blue-500 bg-slate-900/40 hover:bg-blue-950/10 rounded-xl flex flex-col items-center justify-center gap-2 transition-all group text-slate-500 hover:text-blue-400"
          >
            <span className="text-3xl font-light group-hover:scale-110 transition-transform">+</span>
            <span className="text-xs font-semibold">Add Page</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="sr-only"
            onChange={handleLocalAddPage}
          />
        </div>
      </aside>

      {/* ─── RIGHT/MAIN AREA: Active page viewer and controls ────────────────── */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-slate-950">
        
        {/* Main interactive stage */}
        <div className="flex-1 relative flex items-center justify-center p-6 md:p-10 max-h-[calc(100vh-140px)]">
          {activePage ? (
            <div className="relative w-full h-full max-w-2xl flex items-center justify-center">
              
              {toolMode === "crop" ? (
                <div className="w-full max-h-full">
                  <PerspectiveCropOverlay
                    imageUrl={activePage.image}
                    imageAlt={`Crop page ${activeIdx + 1}`}
                    initialPoints={activePage.crop}
                    onConfirm={handleCropConfirm}
                  />
                </div>
              ) : (
                <div className="relative max-h-full max-w-full flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activePage.image}
                    alt={`Preview Page ${activeIdx + 1}`}
                    className={`max-h-[70vh] max-w-full object-contain rounded-lg shadow-2xl transition-all duration-300 ${
                      FILTERS.find((f) => f.id === activePage.filter)?.previewClass || ""
                    }`}
                    style={{
                      transform: `rotate(${activePage.rotation}deg)`,
                    }}
                  />
                  {activePage.crop && (
                    <div className="absolute top-2.5 right-2.5 bg-blue-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                      Crop Applied
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-slate-500 max-w-sm">
              <div className="text-5xl mb-4">🗂️</div>
              <h3 className="text-lg font-bold text-slate-300">No pages yet</h3>
              <p className="text-sm mt-1">
                Upload or capture frames of your document to start editing.
              </p>
            </div>
          )}

          {/* Mini active badge */}
          {activePage && toolMode !== "crop" && (
            <div className="absolute top-4 left-4 bg-slate-900/80 border border-slate-800 backdrop-blur text-slate-400 text-xs px-3 py-1.5 rounded-lg font-medium">
              Page {activeIdx + 1} of {pages.length}
            </div>
          )}
        </div>

        {/* Dynamic filter panel overlay */}
        {toolMode === "filters" && activePage && (
          <div className="absolute bottom-28 left-4 right-4 bg-slate-900/95 border border-slate-800 backdrop-blur rounded-2xl p-4 shadow-2xl max-w-xl mx-auto z-20 animate-in slide-in-from-bottom-5 duration-200">
            <div className="flex items-center justify-between mb-3.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                Enhancement Filters
              </span>
              <button
                onClick={() => setToolMode("view")}
                className="text-xs text-slate-400 hover:text-white"
              >
                ✕ Close
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => updateActivePage({ filter: f.id })}
                  className={`flex flex-col text-left p-3 rounded-xl border transition-all duration-200
                    ${
                      activePage.filter === f.id
                        ? "bg-blue-600/10 border-blue-500/80"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                    }
                  `}
                >
                  <span className="text-xs font-bold">{f.label}</span>
                  <span className="text-[10px] text-slate-500 mt-1">{f.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─── BOTTOM WORKSPACE TOOLBAR ────────────────────────────────────────── */}
        {activePage && (
          <footer className="border-t border-slate-800 bg-slate-900/60 backdrop-blur py-4 px-6 z-10 flex justify-center">
            <div className="flex items-center gap-3 sm:gap-6 flex-wrap justify-center max-w-lg w-full">
              
              {/* Crop mode toggle */}
              <button
                onClick={() => setToolMode(toolMode === "crop" ? "view" : "crop")}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200
                  ${
                    toolMode === "crop"
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4.5 w-4.5"
                >
                  <path d="M6 2v14a2 2 0 0 0 2 2h14" />
                  <path d="M18 22V8a2 2 0 0 0-2-2H2" />
                </svg>
                <span>{toolMode === "crop" ? "Exit Crop" : "Crop"}</span>
              </button>

              {/* Rotate button */}
              <button
                onClick={handleRotate}
                disabled={toolMode === "crop"}
                className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4.5 w-4.5"
                >
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                <span>Rotate</span>
              </button>

              {/* Filters toggle */}
              <button
                onClick={() => setToolMode(toolMode === "filters" ? "view" : "filters")}
                disabled={toolMode === "crop"}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200
                  ${
                    toolMode === "filters"
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50 disabled:opacity-30 disabled:cursor-not-allowed"
                  }`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4.5 w-4.5"
                >
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                  <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z" />
                </svg>
                <span>Filters</span>
              </button>

              {/* Delete button */}
              <button
                onClick={handleDelete}
                className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/20 transition-all duration-200"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4.5 w-4.5"
                >
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span>Delete</span>
              </button>

            </div>
          </footer>
        )}
      </main>

      {/* Toast alert overlay */}
      {successMsg && (
        <div className="fixed bottom-24 right-6 bg-slate-900 border border-slate-800 text-white px-4 py-2.5 rounded-xl shadow-2xl z-50 flex items-center gap-2 animate-in fade-in duration-200">
          <span className="text-green-400">✓</span>
          <span className="text-xs font-semibold">{successMsg}</span>
        </div>
      )}
    </div>
  );
}
