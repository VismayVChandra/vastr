import { NextResponse } from "next/server";
import { analyzeClothingBatch, type AnalyzeInput } from "@/lib/ai/vision";
import { AIRateLimitError, AITransientError } from "@/lib/ai/errors";

// Vision calls with several photos can take a while; give the platform room.
export const maxDuration = 60;

const MAX_IMAGES_PER_REQUEST = 6;
// Vercel rejects request bodies above ~4.5 MB, so fail early with a clear message.
const MAX_TOTAL_BASE64_CHARS = 4_000_000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const images: { dataUrl?: unknown; fileName?: unknown }[] = Array.isArray(body?.images)
    ? body.images
    : [];

  if (images.length === 0 || images.length > MAX_IMAGES_PER_REQUEST) {
    return NextResponse.json(
      { error: `Send between 1 and ${MAX_IMAGES_PER_REQUEST} images per request` },
      { status: 400 }
    );
  }

  const inputs: AnalyzeInput[] = [];
  let totalChars = 0;
  for (const image of images) {
    const match =
      typeof image.dataUrl === "string"
        ? image.dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/)
        : null;
    if (!match) {
      return NextResponse.json({ error: "Invalid image data URL" }, { status: 400 });
    }
    const [, mediaType, base64] = match;
    totalChars += base64.length;
    inputs.push({
      base64,
      mediaType,
      fileName: typeof image.fileName === "string" ? image.fileName : "upload.jpg",
      fileSizeBytes: Math.floor((base64.length * 3) / 4),
    });
  }

  if (totalChars > MAX_TOTAL_BASE64_CHARS) {
    return NextResponse.json({ error: "Images are too large" }, { status: 413 });
  }

  try {
    const { provider, items } = await analyzeClothingBatch(inputs);
    return NextResponse.json({ provider, results: items });
  } catch (err) {
    if (err instanceof AIRateLimitError) {
      console.warn(
        `[api/analyze-image] rate limited: scope=${err.scope} retryAfter=${err.retryAfterSeconds}s`
      );
      return NextResponse.json(
        { error: "rate_limited", scope: err.scope, retryAfterSeconds: err.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(err.retryAfterSeconds) } }
      );
    }
    if (err instanceof AITransientError) {
      return NextResponse.json(
        { error: "busy", retryAfterSeconds: err.retryAfterSeconds },
        { status: 503, headers: { "Retry-After": String(err.retryAfterSeconds) } }
      );
    }
    console.error("[api/analyze-image]", err);
    return NextResponse.json({ error: "Failed to analyze images" }, { status: 500 });
  }
}
