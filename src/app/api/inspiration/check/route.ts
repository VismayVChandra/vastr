import { NextResponse } from "next/server";
import { checkInspiration } from "@/lib/ai/inspiration";
import { aiErrorResponse } from "@/lib/ai/error-response";
import type { FitProfile } from "@/types/fit";
import type { StylePreferences } from "@/types/user";
import type { WardrobeItem } from "@/types/wardrobe";

export const maxDuration = 60;

const MAX_BASE64_CHARS = 4_000_000;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const match =
    typeof body?.dataUrl === "string"
      ? body.dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/)
      : null;
  if (!match) return NextResponse.json({ error: "Invalid image data URL" }, { status: 400 });
  if (match[2].length > MAX_BASE64_CHARS) {
    return NextResponse.json({ error: "Image is too large" }, { status: 413 });
  }
  if (!Array.isArray(body?.wardrobe)) {
    return NextResponse.json({ error: "Missing wardrobe" }, { status: 400 });
  }

  try {
    // The screenshot lives only in this request; nothing is stored.
    return NextResponse.json(
      await checkInspiration({
        mediaType: match[1],
        base64: match[2],
        fit: (body.fit as FitProfile | null) ?? null,
        preferences: (body.preferences as StylePreferences | null) ?? null,
        wardrobe: body.wardrobe as WardrobeItem[],
      })
    );
  } catch (err) {
    const handled = aiErrorResponse(err);
    if (handled) return handled;
    console.error("[api/inspiration/check]", err);
    return NextResponse.json({ error: "Failed to check this look" }, { status: 500 });
  }
}
