import type { Box2D } from "@/types/outfit-photo";

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

/** Crops a detected region (0–1000 box) out of a photo as a JPEG data URL, with
 *  a little breathing room around it since model boxes are slightly tight. */
export async function cropToDataUrl(
  source: string,
  box: Box2D,
  { padding = 0.08, maxSide = 640, quality = 0.85, minSideFraction = 0.14 } = {}
): Promise<string> {
  const img = await loadImage(source);
  const W = img.naturalWidth;
  const H = img.naturalHeight;

  const [ymin, xmin, ymax, xmax] = box;
  const boxW = ((xmax - xmin) / 1000) * W;
  const boxH = ((ymax - ymin) / 1000) * H;
  let x0 = Math.max(0, (xmin / 1000) * W - boxW * padding);
  let y0 = Math.max(0, (ymin / 1000) * H - boxH * padding);
  let x1 = Math.min(W, (xmax / 1000) * W + boxW * padding);
  let y1 = Math.min(H, (ymax / 1000) * H + boxH * padding);

  // Tiny items (a watch, a pocket square) would be a few pixels wide. Grow them
  // around their centre so there is real context and detail to show.
  const minSide = Math.min(W, H) * minSideFraction;
  if (x1 - x0 < minSide) {
    const cx = (x0 + x1) / 2;
    x0 = Math.max(0, Math.min(W - minSide, cx - minSide / 2));
    x1 = Math.min(W, x0 + minSide);
  }
  if (y1 - y0 < minSide) {
    const cy = (y0 + y1) / 2;
    y0 = Math.max(0, Math.min(H - minSide, cy - minSide / 2));
    y1 = Math.min(H, y0 + minSide);
  }

  const cropW = Math.max(1, x1 - x0);
  const cropH = Math.max(1, y1 - y0);
  const scale = Math.min(1, maxSide / Math.max(cropW, cropH));

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(cropW * scale));
  canvas.height = Math.max(1, Math.round(cropH * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, x0, y0, cropW, cropH, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}
