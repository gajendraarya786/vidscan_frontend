"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

export interface AdUnitProps {
  /** AdSense ad-unit slot ID */
  slot: string;
  /** data-ad-format value — defaults to "auto" */
  format?: "auto" | "rectangle" | "horizontal" | "vertical";
  /** Enable full-width responsive — defaults to true */
  responsive?: boolean;
  /** Extra Tailwind wrapper classes */
  className?: string;
}

const AD_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_ID ?? "";

/**
 * AdUnit renders a Google AdSense `<ins>` tag and pushes it into the
 * adsbygoogle queue on mount. Renders nothing when NEXT_PUBLIC_ADSENSE_ID
 * is unset — so local development stays ad-free with no console errors.
 */
export default function AdUnit({
  slot,
  format = "auto",
  responsive = true,
  className = "",
}: AdUnitProps) {
  const pushed = useRef(false);

  useEffect(() => {
    if (!AD_CLIENT || !slot || pushed.current) return;
    try {
      pushed.current = true;
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense script not yet loaded — safe to ignore
    }
  }, [slot]);

  if (!AD_CLIENT || !slot) return null;

  return (
    <div className={`overflow-hidden ${className}`} aria-hidden="true">
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={String(responsive)}
      />
    </div>
  );
}
