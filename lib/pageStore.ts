/**
 * lib/pageStore.ts
 * ─────────────────
 * In-memory singleton that holds scanned pages between the /convert and
 * /preview routes.  This replaces sessionStorage which has a hard ~5 MB
 * quota that is easily exceeded by base64-encoded JPEG page images.
 *
 * The store survives Next.js client-side navigation (same JS context) but
 * is cleared on a full page refresh, which is acceptable — the user would
 * need to re-scan anyway.
 */

import { type PerspectivePoints } from "@/components/PerspectiveCropOverlay";

export interface ScannedPageItem {
  page_number: number;
  image: string;   // base64-encoded JPEG
  width: number;
  height: number;
  quad?: PerspectivePoints;
}

let _pages: ScannedPageItem[] = [];
let _pendingFile: File | null = null;

export const pageStore = {
  /** Replace the current page list. */
  set(pages: ScannedPageItem[]): void {
    _pages = pages;
  },

  /** Return the current page list (empty array if nothing stored). */
  get(): ScannedPageItem[] {
    return _pages;
  },

  /** Remove all stored pages. */
  clear(): void {
    _pages = [];
  },

  /** True if there are pages in the store. */
  hasPages(): boolean {
    return _pages.length > 0;
  },

  /** Store a pending video file selected from the homepage. */
  setPendingFile(file: File | null): void {
    _pendingFile = file;
  },

  /** Retrieve the pending video file. */
  getPendingFile(): File | null {
    return _pendingFile;
  },

  /** Clear the pending video file. */
  clearPendingFile(): void {
    _pendingFile = null;
  },
};

