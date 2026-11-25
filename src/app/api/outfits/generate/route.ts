import { NextResponse } from "next/server";
import { generateOutfits } from "@/lib/ai/stylist";
import type { StylistContext } from "@/lib/ai/stylist-context";
import { learnTaste } from "@/lib/taste/learn";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<StylistContext> | null;

  if (!body || !Array.isArray(body.wardrobe)) {
    return NextResponse.json({ error: "Missing wardrobe context" }, { status: 400 });
  }

  const ctx: StylistContext = {
    wardrobe: body.wardrobe,
    preferences: body.preferences ?? {
      preferredStyles: [],
      favoriteColors: [],
      dislikedColors: [],
      occasions: [],
      budget: "Mid-range",
    },
    weather: body.weather ?? null,
    query: body.query ?? "",
    constraints: body.constraints ?? [],
    recentOutfits: body.recentOutfits ?? [],
    count: body.count ?? 3,
  };
  ctx.taste = learnTaste(ctx.recentOutfits, ctx.wardrobe);

  try {
    const result = await generateOutfits(ctx);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/outfits/generate]", err);
    return NextResponse.json({ error: "Failed to generate outfits" }, { status: 500 });
  }
}
