"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

// ─── Types & Interfaces ──────────────────────────────────────────────────────

export interface Point2D {
  x: number; // percentage 0–100
  y: number; // percentage 0–100
}

export interface PerspectivePoints {
  tl: Point2D;
  tr: Point2D;
  br: Point2D;
  bl: Point2D;
}

export interface PerspectiveCropOverlayProps {
  /** URL of the document frame to crop. */
  imageUrl: string;
  /** Callback containing final tl, tr, br, bl percentages. */
  onConfirm: (points: PerspectivePoints) => void;
  /** Optional initial points. If omitted, defaults to a centered quad. */
  initialPoints?: PerspectivePoints;
  /** Alt text for the frame. */
  imageAlt?: string;
  /** Optional callback to cancel or skip cropping. */
  onCancel?: () => void;
}

type CornerId = "tl" | "tr" | "br" | "bl";

interface DragState {
  cornerId: CornerId;
  startX: number;
  startY: number;
  startPoint: Point2D;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

const pxToPct = (px: number, containerDim: number) => (px / containerDim) * 100;

// ─── Component ────────────────────────────────────────────────────────────────

export default function PerspectiveCropOverlay({
  imageUrl,
  onConfirm,
  initialPoints,
  imageAlt = "Document frame",
  onCancel,
}: PerspectiveCropOverlayProps) {
  const [points, setPoints] = useState<PerspectivePoints>(
    initialPoints ?? {
      tl: { x: 15, y: 15 },
      tr: { x: 85, y: 15 },
      br: { x: 85, y: 85 },
      bl: { x: 15, y: 85 },
    }
  );
  
  const [activeCorner, setActiveCorner] = useState<CornerId | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  // Prevent default scroll behavior on mobile touch devices when touch moves in container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const preventTouchScroll = (e: TouchEvent) => {
      // Prevent default page scroll/bounce when touching inside the cropper area
      e.preventDefault();
    };

    container.addEventListener("touchmove", preventTouchScroll, { passive: false });
    return () => {
      container.removeEventListener("touchmove", preventTouchScroll);
    };
  }, [imageLoaded]);

  // ── Drag Start ─────────────────────────────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, cornerId: CornerId) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLDivElement).setPointerCapture(e.pointerId);

      dragRef.current = {
        cornerId,
        startX: e.clientX,
        startY: e.clientY,
        startPoint: { ...points[cornerId] },
      };

      setActiveCorner(cornerId);
      setIsDragging(true);
    },
    [points]
  );

  // ── Drag Move ──────────────────────────────────────────────────────────────

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!dragRef.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const { cornerId, startX, startY, startPoint } = dragRef.current;

    const dxPct = pxToPct(e.clientX - startX, rect.width);
    const dyPct = pxToPct(e.clientY - startY, rect.height);

    setPoints((prev) => ({
      ...prev,
      [cornerId]: {
        x: clamp(startPoint.x + dxPct, 0, 100),
        y: clamp(startPoint.y + dyPct, 0, 100),
      },
    }));
  }, []);

  // ── Drag End ───────────────────────────────────────────────────────────────

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    setIsDragging(false);
    setActiveCorner(null);
  }, []);

  // Set up global pointer event listeners
  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  // ── Derived SVG paths ─────────────────────────────────────────────────────

  const { tl, tr, br, bl } = points;

  // Punch-out path using evenodd rule: Outer rectangle clockwise, inner polygon counter-clockwise
  const maskPath = `
    M 0,0 L 100,0 L 100,100 L 0,100 Z
    M ${tl.x},${tl.y} 
    L ${bl.x},${bl.y} 
    L ${br.x},${br.y} 
    L ${tr.x},${tr.y} Z
  `;

  // Connector lines path
  const linePoints = `${tl.x},${tl.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bl.x},${bl.y}`;

  // Find active point coordinates for the magnifier loupe
  const activePt = activeCorner ? points[activeCorner] : null;

  return (
    <div className="flex flex-col items-center gap-6 w-full select-none touch-none">
      
      {/* ─── Main Stage Crop Container ────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="relative max-h-[60vh] max-w-full overflow-hidden rounded-xl border border-slate-200 shadow-xl bg-white mx-auto touch-none"
        style={{ userSelect: "none", touchAction: "none", width: "fit-content", height: "fit-content" }}
      >
        {/* Document Image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={imageAlt}
          draggable={false}
          onLoad={() => setImageLoaded(true)}
          className="block max-h-[60vh] max-w-full w-auto h-auto pointer-events-none"
        />

        {imageLoaded && (
          <>
            {/* SVG Mask and Connector lines */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {/* Outer dark overlay with dynamic punched-out shape */}
              <path
                d={maskPath}
                fill="rgba(15, 23, 42, 0.5)"
                fillRule="evenodd"
              />

              {/* Dynamic boundary lines */}
              <polygon
                points={linePoints}
                fill="rgba(219, 39, 119, 0.06)"
                stroke="rgba(219, 39, 119, 0.85)"
                strokeWidth="0.4"
                strokeLinejoin="round"
              />
            </svg>

            {/* Interactive handles */}
            {(["tl", "tr", "br", "bl"] as CornerId[]).map((id) => {
              const pt = points[id];
              return (
                <div
                  key={id}
                  onPointerDown={(e) => handlePointerDown(e, id)}
                  className={`absolute z-20 cursor-move -translate-x-1/2 -translate-y-1/2 flex items-center justify-center touch-none`}
                  style={{
                    left: `${pt.x}%`,
                    top: `${pt.y}%`,
                    touchAction: "none",
                  }}
                >
                  {/* Visually touchable target handle */}
                  <div
                    className={`w-7 h-7 flex items-center justify-center rounded-full transition-transform active:scale-125
                      ${
                        activeCorner === id
                          ? "bg-pink-600 shadow-lg scale-110"
                          : "bg-slate-900/60 hover:bg-slate-800/80"
                      }`}
                  >
                    {/* Inner glowing dot */}
                    <div className="w-2.5 h-2.5 rounded-full bg-pink-400 border border-white shadow-sm" />
                  </div>
                </div>
              );
            })}

            {/* Magnifying glass Loupe overlay (Adobe Scan style) */}
            {isDragging && activePt && (
              <div
                className="absolute z-30 pointer-events-none w-28 h-28 rounded-full border-4 border-slate-300 bg-slate-900 shadow-2xl overflow-hidden animate-in zoom-in-75 duration-100"
                style={{
                  left: `${activePt.x}%`,
                  top: `calc(${activePt.y}% - 75px)`, // float above the handle
                  transform: "translateX(-50%)",
                }}
              >
                <div
                  className="w-full h-full bg-no-repeat"
                  style={{
                    backgroundImage: `url(${imageUrl})`,
                    backgroundSize: "600%", // Zoom magnitude
                    backgroundPosition: `${activePt.x}% ${activePt.y}%`,
                  }}
                />
                {/* Crosshair inside loupe */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-full h-[1px] bg-pink-500/40 absolute" />
                  <div className="h-full w-[1px] bg-pink-500/40 absolute" />
                  <div className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                </div>
              </div>
            )}
          </>
        )}

        {/* Loading placeholder */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-slate-50 animate-pulse flex items-center justify-center text-sm text-slate-400">
            Loading perspective cropping editor…
          </div>
        )}
      </div>

      {/* Action Buttons Below the Image Container (never overlaps) */}
      {imageLoaded && (
        <div className="flex items-center gap-4 select-none mt-2 pb-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-sm active:scale-95 transition-all"
            >
              Skip Crop
            </button>
          )}
          <button
            type="button"
            onClick={() => onConfirm({ ...points })}
            className="w-11 h-11 rounded-full bg-gradient-to-r from-pink-600 to-indigo-700 hover:from-pink-500 hover:to-indigo-600 text-white shadow-lg active:scale-95 transition-all flex items-center justify-center border border-pink-500/20"
            aria-label="Confirm Crop"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
