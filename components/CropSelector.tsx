"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Percentage-based coordinates (0–100) relative to the image dimensions. */
export interface CropPercentage {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropSelectorProps {
  /** URL of the video frame image to display. */
  frameUrl: string;
  /**
   * Fired when the user clicks "Confirm Crop".
   * Receives the crop region as percentages (0–100).
   */
  onConfirm: (crop: CropPercentage) => void;
  /** Optional initial crop. Defaults to a centred 60 × 40 % box. */
  initialCrop?: CropPercentage;
  /** Alt text for the underlying frame image. */
  frameAlt?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const HANDLE_SIZE = 12; // px — visual size of each corner handle
const MIN_DIM_PCT = 4; // % — minimum width / height of the crop box

type Handle = "nw" | "ne" | "sw" | "se" | "body";

interface DragState {
  handle: Handle;
  startX: number;
  startY: number;
  startCrop: CropPercentage;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Clamp a value between lo and hi (inclusive). */
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/** Convert pixel offset to percentage of the container dimension. */
const pxToPct = (px: number, containerDim: number) => (px / containerDim) * 100;

// ─── Component ────────────────────────────────────────────────────────────────

export default function CropSelector({
  frameUrl,
  onConfirm,
  initialCrop,
  frameAlt = "Video frame",
}: CropSelectorProps) {
  const [crop, setCrop] = useState<CropPercentage>(
    initialCrop ?? { x: 20, y: 20, width: 60, height: 60 }
  );
  const [isDragging, setIsDragging] = useState(false);

  // Ref to the image wrapper — we measure its bounding rect for coordinate maths.
  const containerRef = useRef<HTMLDivElement>(null);
  // Stable ref so pointer-move closure always sees the latest drag state.
  const dragRef = useRef<DragState | null>(null);
  // Track whether the image has loaded so we show the crop overlay only after.
  const [imageLoaded, setImageLoaded] = useState(false);

  // ── Cursor style ──────────────────────────────────────────────────────────

  const cursorForHandle: Record<Handle, string> = {
    nw: "nwse-resize",
    ne: "nesw-resize",
    sw: "nesw-resize",
    se: "nwse-resize",
    body: "move",
  };

  // ── Pointer down on box or handle ─────────────────────────────────────────

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, handle: Handle) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startCrop: { ...crop },
      };
      setIsDragging(true);
    },
    [crop]
  );

  // ── Global pointer move ───────────────────────────────────────────────────

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragRef.current || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const { handle, startX, startY, startCrop } = dragRef.current;

    const dxPct = pxToPct(e.clientX - startX, rect.width);
    const dyPct = pxToPct(e.clientY - startY, rect.height);

    setCrop(() => {
      let { x, y, width, height } = startCrop;

      if (handle === "body") {
        // ── Move the box ──────────────────────────────────────────────────
        x = clamp(x + dxPct, 0, 100 - width);
        y = clamp(y + dyPct, 0, 100 - height);
      } else {
        // ── Resize via corner handle ──────────────────────────────────────
        const right = x + width;
        const bottom = y + height;

        if (handle === "nw") {
          const newX = clamp(x + dxPct, 0, right - MIN_DIM_PCT);
          const newY = clamp(y + dyPct, 0, bottom - MIN_DIM_PCT);
          width = right - newX;
          height = bottom - newY;
          x = newX;
          y = newY;
        } else if (handle === "ne") {
          const newRight = clamp(right + dxPct, x + MIN_DIM_PCT, 100);
          const newY = clamp(y + dyPct, 0, bottom - MIN_DIM_PCT);
          width = newRight - x;
          height = bottom - newY;
          y = newY;
        } else if (handle === "sw") {
          const newX = clamp(x + dxPct, 0, right - MIN_DIM_PCT);
          const newBottom = clamp(bottom + dyPct, y + MIN_DIM_PCT, 100);
          width = right - newX;
          height = newBottom - y;
          x = newX;
        } else if (handle === "se") {
          width = clamp(width + dxPct, MIN_DIM_PCT, 100 - x);
          height = clamp(height + dyPct, MIN_DIM_PCT, 100 - y);
        }

        // Final safety clamp — keep the entire box inside the image.
        x = clamp(x, 0, 100 - MIN_DIM_PCT);
        y = clamp(y, 0, 100 - MIN_DIM_PCT);
        width = clamp(width, MIN_DIM_PCT, 100 - x);
        height = clamp(height, MIN_DIM_PCT, 100 - y);
      }

      return { x, y, width, height };
    });
  }, []);

  // ── Global pointer up ─────────────────────────────────────────────────────

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  // Attach/detach global listeners so events work even when the pointer leaves
  // the component during a fast drag.
  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  // ── Derived pixel positions for rendering ─────────────────────────────────

  const { x, y, width, height } = crop;

  // Rounded values for the readout panel.
  const display = {
    x: x.toFixed(1),
    y: y.toFixed(1),
    w: width.toFixed(1),
    h: height.toFixed(1),
  };

  // ── Corner handle definitions ─────────────────────────────────────────────

  const handles: { id: Handle; style: React.CSSProperties }[] = [
    {
      id: "nw",
      style: {
        top: `calc(${y}% - ${HANDLE_SIZE / 2}px)`,
        left: `calc(${x}% - ${HANDLE_SIZE / 2}px)`,
      },
    },
    {
      id: "ne",
      style: {
        top: `calc(${y}% - ${HANDLE_SIZE / 2}px)`,
        left: `calc(${x + width}% - ${HANDLE_SIZE / 2}px)`,
      },
    },
    {
      id: "sw",
      style: {
        top: `calc(${y + height}% - ${HANDLE_SIZE / 2}px)`,
        left: `calc(${x}% - ${HANDLE_SIZE / 2}px)`,
      },
    },
    {
      id: "se",
      style: {
        top: `calc(${y + height}% - ${HANDLE_SIZE / 2}px)`,
        left: `calc(${x + width}% - ${HANDLE_SIZE / 2}px)`,
      },
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center gap-6 select-none w-full">

      {/* ── Frame + overlay wrapper ────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-xl shadow-lg border border-white/10"
        style={{ userSelect: "none" }}
        aria-label="Crop area editor"
        role="application"
      >
        {/* Underlying frame image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frameUrl}
          alt={frameAlt}
          draggable={false}
          onLoad={() => setImageLoaded(true)}
          className="block w-full h-auto pointer-events-none"
        />

        {imageLoaded && (
          <>
            {/* ── Dark overlay — four trapezoids around the crop box ─────── */}
            {/* Top strip */}
            <div
              className="absolute inset-0 bg-black/55 pointer-events-none"
              style={{
                clipPath: `polygon(
                  0% 0%, 100% 0%,
                  100% ${y}%, 0% ${y}%
                )`,
              }}
              aria-hidden="true"
            />
            {/* Bottom strip */}
            <div
              className="absolute inset-0 bg-black/55 pointer-events-none"
              style={{
                clipPath: `polygon(
                  0% ${y + height}%, 100% ${y + height}%,
                  100% 100%, 0% 100%
                )`,
              }}
              aria-hidden="true"
            />
            {/* Left strip */}
            <div
              className="absolute inset-0 bg-black/55 pointer-events-none"
              style={{
                clipPath: `polygon(
                  0% ${y}%, ${x}% ${y}%,
                  ${x}% ${y + height}%, 0% ${y + height}%
                )`,
              }}
              aria-hidden="true"
            />
            {/* Right strip */}
            <div
              className="absolute inset-0 bg-black/55 pointer-events-none"
              style={{
                clipPath: `polygon(
                  ${x + width}% ${y}%, 100% ${y}%,
                  100% ${y + height}%, ${x + width}% ${y + height}%
                )`,
              }}
              aria-hidden="true"
            />

            {/* ── Bounding box ──────────────────────────────────────────── */}
            <div
              id="crop-box"
              onPointerDown={(e) => onPointerDown(e, "body")}
              className="absolute border-2 border-white/90 rounded-[2px] group"
              style={{
                top: `${y}%`,
                left: `${x}%`,
                width: `${width}%`,
                height: `${height}%`,
                cursor: isDragging
                  ? "grabbing"
                  : cursorForHandle["body"],
                boxShadow: "0 0 0 1px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(0,0,0,0.3)",
              }}
              aria-label="Drag to move crop area"
              role="slider"
            >
              {/* Rule-of-thirds grid lines */}
              <div className="absolute inset-0 pointer-events-none opacity-40">
                <div className="absolute top-1/3 left-0 right-0 h-px bg-white/70" />
                <div className="absolute top-2/3 left-0 right-0 h-px bg-white/70" />
                <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/70" />
                <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/70" />
              </div>

              {/* Centre crosshair dot */}
              <div
                className="absolute w-2 h-2 rounded-full bg-white/80 shadow"
                style={{
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              />
            </div>

            {/* ── Corner resize handles ──────────────────────────────────── */}
            {handles.map(({ id, style }) => (
              <div
                key={id}
                id={`crop-handle-${id}`}
                onPointerDown={(e) => onPointerDown(e, id)}
                aria-label={`Resize handle ${id}`}
                className="absolute z-10 rounded-sm bg-white shadow-md border border-white/20
                           transition-transform duration-100 hover:scale-125 active:scale-110"
                style={{
                  width: HANDLE_SIZE,
                  height: HANDLE_SIZE,
                  cursor: cursorForHandle[id],
                  ...style,
                }}
              />
            ))}
          </>
        )}

        {/* Loading skeleton */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 animate-pulse flex items-center justify-center">
            <span className="text-slate-400 text-sm">Loading frame…</span>
          </div>
        )}
      </div>

      {/* ── Coordinate readout ────────────────────────────────────────────────── */}
      {imageLoaded && (
        <div
          className="flex flex-wrap justify-center gap-3 text-xs font-mono"
          aria-live="polite"
          aria-atomic="true"
          aria-label="Current crop coordinates in percent"
        >
          {[
            { label: "X", value: display.x },
            { label: "Y", value: display.y },
            { label: "W", value: display.w },
            { label: "H", value: display.h },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 rounded-lg bg-slate-800/80 border border-slate-700
                         px-3 py-1.5 text-slate-300 shadow-inner"
            >
              <span className="text-slate-500 uppercase tracking-widest text-[10px]">
                {label}
              </span>
              <span className="text-white tabular-nums">{value}%</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Confirm button ────────────────────────────────────────────────────── */}
      <button
        id="confirm-crop-btn"
        type="button"
        disabled={!imageLoaded}
        onClick={() => onConfirm({ ...crop })}
        className="mt-1 inline-flex items-center gap-2 rounded-xl
                   bg-gradient-to-r from-blue-600 to-indigo-600
                   px-7 py-3 text-sm font-semibold text-white shadow-lg
                   hover:from-blue-500 hover:to-indigo-500
                   active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
                   transition-all duration-150 focus-visible:outline-none
                   focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
        aria-label="Confirm current crop selection and send coordinates to backend"
      >
        {/* Crop icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <path d="M6 2v14a2 2 0 0 0 2 2h14" />
          <path d="M18 22V8a2 2 0 0 0-2-2H2" />
        </svg>
        Confirm Crop
      </button>
    </div>
  );
}
