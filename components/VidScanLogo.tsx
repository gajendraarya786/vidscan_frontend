import React from "react";

interface VidScanLogoProps {
  className?: string;
  size?: number;
}

export default function VidScanLogo({ className = "", size = 28 }: VidScanLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
      </defs>

      {/* Outer subtle rings */}
      <circle cx="50" cy="50" r="45" stroke="#4f46e5" strokeOpacity="0.1" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="40" stroke="#ec4899" strokeOpacity="0.15" strokeWidth="1" />
      <circle cx="50" cy="50" r="35" stroke="url(#logo-grad)" strokeOpacity="0.25" strokeWidth="1" />

      {/* Main Document Body */}
      <path
        d="M32 25c0-2.8 2.2-5 5-5h20.5c1.3 0 2.6.5 3.5 1.5l12.5 12.5c1 .9 1.5 2.2 1.5 3.5V75c0 2.8-2.2 5-5 5H37c-2.8 0-5-2.2-5-5V25z"
        fill="url(#logo-grad)"
      />

      {/* Folded Page Corner (top right) */}
      <path
        d="M61 20v11.5c0 1.9 1.6 3.5 3.5 3.5H76L61 20z"
        fill="#ffffff"
        fillOpacity="0.3"
      />

      {/* Film Strip Holes on the Left side */}
      <rect x="36" y="27" width="4" height="4" rx="0.5" fill="#ffffff" fillOpacity="0.9" />
      <rect x="36" y="35" width="4" height="4" rx="0.5" fill="#ffffff" fillOpacity="0.9" />
      <rect x="36" y="43" width="4" height="4" rx="0.5" fill="#ffffff" fillOpacity="0.9" />
      <rect x="36" y="51" width="4" height="4" rx="0.5" fill="#ffffff" fillOpacity="0.9" />
      <rect x="36" y="59" width="4" height="4" rx="0.5" fill="#ffffff" fillOpacity="0.9" />
      <rect x="36" y="67" width="4" height="4" rx="0.5" fill="#ffffff" fillOpacity="0.9" />
      <rect x="36" y="75" width="4" height="4" rx="0.5" fill="#ffffff" fillOpacity="0.9" />

      {/* Play Button Triangle in the Center */}
      <path
        d="M48 42.5c-1.3-.8-3 .1-3 1.7v11.6c0 1.6 1.7 2.5 3 1.7l9.5-5.8c1.3-.8 1.3-2.6 0-3.4l-9.5-5.8z"
        fill="#ffffff"
      />
    </svg>
  );
}
