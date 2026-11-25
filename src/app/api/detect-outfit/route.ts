import { NextResponse } from "next/server";
import { detectOutfit } from "@/lib/ai/outfit-photo";
import { aiErrorResponse } from "@/lib/ai/error-response";

export const maxDuration = 60;

// Vercel rejects request bodies above ~4.5 MB.
const MAX_BASE64_CHARS = 4_000_000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const match =
    typeof body?.dataUrl === "string"
      ? body.dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/)
      : null;
  if (!match) {
    return NextResponse.json({ error: "Invalid image data URL" }, { status: 400 });
  }
  const [, mediaType, base64] = match;
  if (base64.length > MAX_BASE64_CHARS) {
    return NextResponse.json({ error: "Image is too large" }, { status: 413 });
  }

  try {
    const outcome = await detectOutfit({ base64, mediaType });
    return NextResponse.json(outcome);
  } catch (err) {
    const handled = aiErrorResponse(err);
    if (handled) return handled;
    console.error("[api/detect-outfit]", err);
    return NextResponse.json({ error: "Failed to analyze the photo" }, { status: 500 });
  }
}
