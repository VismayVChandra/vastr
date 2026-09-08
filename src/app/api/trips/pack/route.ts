import { NextResponse } from "next/server";
import { mockPlanTripPacking } from "@/lib/ai/mock-trip";
import type { WardrobeItem } from "@/types/wardrobe";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.wardrobe) || !body.destination) {
    return NextResponse.json({ error: "Missing trip details" }, { status: 400 });
  }

  const wardrobe = body.wardrobe as WardrobeItem[];
  const destination: string = body.destination;
  const durationDays: number = Math.max(1, Number(body.durationDays) || 1);
  const activities: string[] = Array.isArray(body.activities) ? body.activities : [];

  const { packingList, missingItems } = mockPlanTripPacking({
    destination,
    durationDays,
    activities,
    wardrobe,
  });

  return NextResponse.json({ packingList, missingItems });
}
