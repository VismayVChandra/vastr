import { NextResponse } from "next/server";
import { chatWithStylist } from "@/lib/ai/chat";
import type { ChatContext, ChatTurn } from "@/lib/ai/chat-context";
import { learnTaste } from "@/lib/taste/learn";

export const maxDuration = 60;

const MAX_HISTORY = 12;
const MAX_TEXT = 1500;

function cleanHistory(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-MAX_HISTORY)
    .filter((t): t is ChatTurn => Boolean(t) && (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
    .map((t) => ({
      role: t.role,
      content: t.content.slice(0, MAX_TEXT),
      outfits: Array.isArray(t.outfits)
        ? t.outfits.slice(0, 4).map((o) => ({
            name: String(o.name ?? ""),
            label: o.label ? String(o.label) : null,
            itemIds: Array.isArray(o.itemIds) ? o.itemIds.map(String) : [],
          }))
        : undefined,
    }));
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Partial<ChatContext> | null;

  if (!body || !Array.isArray(body.wardrobe) || typeof body.message !== "string" || !body.message.trim()) {
    return NextResponse.json({ error: "Missing message or wardrobe" }, { status: 400 });
  }

  const message = body.message.trim().slice(0, MAX_TEXT);
  const ctx: ChatContext = {
    wardrobe: body.wardrobe,
    preferences: body.preferences ?? {
      preferredStyles: [],
      favoriteColors: [],
      dislikedColors: [],
      occasions: [],
      budget: "Mid-range",
    },
    weather: body.weather ?? null,
    query: message,
    message,
    constraints: [],
    recentOutfits: body.recentOutfits ?? [],
    count: 2,
    history: cleanHistory(body.history),
    rulesOnly: body.rulesOnly === true,
  };
  ctx.taste = learnTaste(ctx.recentOutfits, ctx.wardrobe);

  try {
    return NextResponse.json(await chatWithStylist(ctx));
  } catch (err) {
    console.error("[api/stylist/chat]", err);
    return NextResponse.json({ error: "Failed to reach the stylist" }, { status: 500 });
  }
}
