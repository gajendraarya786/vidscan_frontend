interface ProgressBarProps {
  /** 0–100 */
  value: number;
  /** Status label shown to the left */
  label?: string;
  /** aria-label for screen readers */
  ariaLabel?: string;
}

/**
 * Animated Tailwind progress bar.
 * Pure server/client compatible — no useEffect needed.
 */
export default function ProgressBar({
  value,
  label = "Processing…",
  ariaLabel,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel ?? label}
      className="w-full space-y-1.5"
    >
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          {/* spinner */}
          <svg
            className="h-3.5 w-3.5 animate-spin text-blue-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          {label}
        </span>
        <span className="tabular-nums">{clamped}%</span>
      </div>

      {/* track */}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
        {/* fill */}
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
