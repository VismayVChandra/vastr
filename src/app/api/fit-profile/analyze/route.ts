import { NextResponse } from "next/server";
import { analyzeFit, type FitPhotoKind } from "@/lib/ai/fit-profile";
import { aiErrorResponse } from "@/lib/ai/error-response";

export const maxDuration = 60;

// Vercel rejects request bodies above ~4.5 MB, shared across all the photos.
const MAX_TOTAL_BASE64_CHARS = 4_000_000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const rawPhotos: unknown = body?.photos;
  if (!Array.isArray(rawPhotos) || rawPhotos.length < 1 || rawPhotos.length > 3) {
    return NextResponse.json({ error: "Send 1 to 3 photos" }, { status: 400 });
  }

  const photos: { base64: string; mediaType: string; kind: FitPhotoKind }[] = [];
  let total = 0;
  for (const raw of rawPhotos) {
    const match =
      typeof raw?.dataUrl === "string"
        ? raw.dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/)
        : null;
    if (!match) return NextResponse.json({ error: "Invalid image data URL" }, { status: 400 });
    total += match[2].length;
    photos.push({ mediaType: match[1], base64: match[2], kind: raw.kind === "body" ? "body" : "face" });
  }
  if (total > MAX_TOTAL_BASE64_CHARS) {
    return NextResponse.json({ error: "Photos are too large" }, { status: 413 });
  }

  const height = Number(body?.heightCm);
  const heightCm = Number.isFinite(height) && height >= 100 && height <= 230 ? height : null;

  try {
    // The photos live only in this request; nothing is written anywhere.
    return NextResponse.json(await analyzeFit({ photos, heightCm }));
  } catch (err) {
    const handled = aiErrorResponse(err);
    if (handled) return handled;
    console.error("[api/fit-profile/analyze]", err);
    return NextResponse.json({ error: "Failed to analyze the photos" }, { status: 500 });
  }
}
