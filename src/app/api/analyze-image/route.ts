import { NextResponse } from "next/server";
import { analyzeClothingImage } from "@/lib/ai/vision";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const dataUrl: string | undefined = body?.dataUrl;
  const fileName: string = body?.fileName ?? "upload.jpg";

  if (!dataUrl || !dataUrl.startsWith("data:")) {
    return NextResponse.json({ error: "Missing image dataUrl" }, { status: 400 });
  }

  const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!match) {
    return NextResponse.json({ error: "Invalid image data URL" }, { status: 400 });
  }
  const [, mediaType, base64] = match;
  const fileSizeBytes = Math.floor((base64.length * 3) / 4);

  try {
    const { result, isMock, mockReason } = await analyzeClothingImage({
      base64,
      mediaType,
      fileName,
      fileSizeBytes,
    });
    return NextResponse.json({ result, isMock, mockReason });
  } catch (err) {
    console.error("[api/analyze-image]", err);
    return NextResponse.json({ error: "Failed to analyze image" }, { status: 500 });
  }
}
