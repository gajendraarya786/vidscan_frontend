import { type PerspectivePoints } from "@/components/PerspectiveCropOverlay";

/**
 * Applies a 4-point perspective warp (crop) to a base64 image instantly
 * using pure JavaScript Canvas, avoiding network roundtrips.
 */
export async function applyPerspectiveCropClient(
  base64Img: string,
  cropPoints: PerspectivePoints
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const resultBase64 = processWarp(img, cropPoints);
        resolve(resultBase64);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image for cropping"));
    img.src = base64Img.startsWith("data:") ? base64Img : `data:image/jpeg;base64,${base64Img}`;
  });
}

function processWarp(img: HTMLImageElement, points: PerspectivePoints): string {
  const W_src = img.naturalWidth || img.width;
  const H_src = img.naturalHeight || img.height;

  // Convert percentages to actual pixels
  const x0 = (points.tl.x / 100) * W_src;
  const y0 = (points.tl.y / 100) * H_src;
  const x1 = (points.tr.x / 100) * W_src;
  const y1 = (points.tr.y / 100) * H_src;
  const x2 = (points.br.x / 100) * W_src;
  const y2 = (points.br.y / 100) * H_src;
  const x3 = (points.bl.x / 100) * W_src;
  const y3 = (points.bl.y / 100) * H_src;

  // Calculate destination dimensions based on the max edge lengths of the quad
  const topWidth = Math.hypot(x1 - x0, y1 - y0);
  const bottomWidth = Math.hypot(x2 - x3, y2 - y3);
  const destWidth = Math.round(Math.max(topWidth, bottomWidth));

  const leftHeight = Math.hypot(x3 - x0, y3 - y0);
  const rightHeight = Math.hypot(x2 - x1, y2 - y1);
  const destHeight = Math.round(Math.max(leftHeight, rightHeight));

  if (destWidth <= 0 || destHeight <= 0) {
    throw new Error("Degenerate crop dimensions");
  }

  // Draw source image to an offscreen canvas to get pixel data
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = W_src;
  srcCanvas.height = H_src;
  const srcCtx = srcCanvas.getContext("2d", { willReadFrequently: true });
  if (!srcCtx) throw new Error("Could not get source canvas context");
  srcCtx.drawImage(img, 0, 0);
  const srcImgData = srcCtx.getImageData(0, 0, W_src, H_src);
  const srcData = srcImgData.data;

  // Prepare destination canvas
  const destCanvas = document.createElement("canvas");
  destCanvas.width = destWidth;
  destCanvas.height = destHeight;
  const destCtx = destCanvas.getContext("2d", { willReadFrequently: true });
  if (!destCtx) throw new Error("Could not get destination canvas context");
  const destImgData = destCtx.createImageData(destWidth, destHeight);
  const destData = destImgData.data;

  // Calculate homography matrix mapping from destination normalized [0..1] to source pixels
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;

  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;

  let g = 0, h = 0;
  let a = 0, b = 0, c = 0, d = 0, e = 0, f = 0;

  if (dx3 === 0 && dy3 === 0) {
    // Affine transform (parallelogram)
    a = x1 - x0;
    b = x2 - x1;
    c = x0;
    d = y1 - y0;
    e = y2 - y1;
    f = y0;
  } else {
    // Perspective transform
    const det = dx1 * dy2 - dx2 * dy1;
    if (det === 0) throw new Error("Collinear points in crop quad");
    g = (dx3 * dy2 - dx2 * dy3) / det;
    h = (dx1 * dy3 - dx3 * dy1) / det;

    a = x1 - x0 + g * x1;
    b = x3 - x0 + h * x3;
    c = x0;
    d = y1 - y0 + g * y1;
    e = y3 - y0 + h * y3;
    f = y0;
  }

  // Iterate destination pixels and map to source
  for (let y = 0; y < destHeight; y++) {
    const ty = y / destHeight;
    for (let x = 0; x < destWidth; x++) {
      const tx = x / destWidth;

      const denom = g * tx + h * ty + 1;
      let u = (a * tx + b * ty + c) / denom;
      let v = (d * tx + e * ty + f) / denom;

      u = Math.max(0, Math.min(W_src - 1, u));
      v = Math.max(0, Math.min(H_src - 1, v));

      // Nearest neighbor interpolation (fastest)
      // Could be upgraded to bilinear if quality needs it, but standard resolution is high enough
      const srcX = Math.round(u);
      const srcY = Math.round(v);

      const srcIdx = (srcY * W_src + srcX) * 4;
      const destIdx = (y * destWidth + x) * 4;

      destData[destIdx] = srcData[srcIdx];         // R
      destData[destIdx + 1] = srcData[srcIdx + 1]; // G
      destData[destIdx + 2] = srcData[srcIdx + 2]; // B
      destData[destIdx + 3] = srcData[srcIdx + 3]; // A
    }
  }

  destCtx.putImageData(destImgData, 0, 0);
  return destCanvas.toDataURL("image/jpeg", 0.95);
}
