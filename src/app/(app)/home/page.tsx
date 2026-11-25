"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useWardrobeStore } from "@/store/wardrobe-store";
import { useOutfitStore } from "@/store/outfit-store";
import { useOutfitGenerator } from "@/hooks/use-outfit-generator";
import { WeatherBadge } from "@/components/home/weather-badge";
import { QuickActions } from "@/components/home/quick-actions";
import { OutfitLookCard } from "@/components/outfit/outfit-look-card";
import { CompleteLookDialog } from "@/components/shop/complete-look-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { resolveItems } from "@/lib/resolve-items";
import type { GeneratedOutfit } from "@/lib/ai/stylist-context";
import type { Outfit } from "@/types/outfit";
import { Shirt } from "lucide-react";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const { profile } = useAuth();
  const items = useWardrobeStore((s) => s.items);
  const wardrobeLoading = useWardrobeStore((s) => s.loading);
  const saveOutfit = useOutfitStore((s) => s.save);
  const createDraft = useOutfitStore((s) => s.createDraft);
  const markSaved = useOutfitStore((s) => s.markSaved);
  const giveFeedback = useOutfitStore((s) => s.giveFeedback);
  const wearOutfit = useOutfitStore((s) => s.wearOutfit);
  const { generate, generating, weather } = useOutfitGenerator();

  const [look, setLook] = useState<GeneratedOutfit | null>(null);
  // The stored record for the look on screen. Created the first time the user
  // rates, saves or wears it, so unrated suggestions don't pile up in history.
  const [recordId, setRecordId] = useState<string | null>(null);
  const record = useOutfitStore((s) => s.outfits.find((o) => o.id === recordId) ?? null);
  const ratedCount = useOutfitStore((s) => s.outfits.filter((o) => o.rating).length);
  const [wearingNow, setWearingNow] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [pool, setPool] = useState<GeneratedOutfit[]>([]);
  const [completeLookOpen, setCompleteLookOpen] = useState(false);

  useEffect(() => {
    if (wardrobeLoading || items.length === 0 || look) return;
    (async () => {
      const outfits = await generate({ query: "What should I wear today?", count: 3 });
      setPool(outfits);
      setLook(outfits[0] ?? null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wardrobeLoading, items.length]);

  async function handleChange() {
    // After a thumbs-down, ask for a fresh set so the new feedback shapes it; otherwise cycle the pool for free.
    if (pool.length > 1 && record?.rating !== "not-for-me") {
      const next = (cursor + 1) % pool.length;
      setCursor(next);
      setLook(pool[next]);
      setRecordId(null);
      return;
    }
    const outfits = await generate({ query: "What should I wear today?", count: 3 });
    setPool(outfits);
    setCursor(0);
    setLook(outfits[0] ?? null);
    setRecordId(null);
  }

  const lookInput = look && {
    name: look.name,
    itemIds: look.itemIds,
    reason: look.reason,
    occasion: null,
    missingItems: look.missingItems,
    source: "home" as const,
  };

  /** Stores the look on screen (as a draft unless it's being saved) and returns its id. */
  async function ensureRecord(): Promise<string | null> {
    if (!profile || !lookInput) return null;
    if (recordId) return recordId;
    const outfit = await createDraft(profile.id, lookInput);
    setRecordId(outfit.id);
    return outfit.id;
  }

  async function handleSave() {
    if (!profile || !lookInput) return;
    if (recordId) {
      await markSaved(recordId);
    } else {
      const outfit = await saveOutfit(profile.id, lookInput);
      setRecordId(outfit.id);
    }
    toast.success("Saved to your outfit history");
  }

  async function handleWear() {
    if (!profile || !look) return;
    setWearingNow(true);
    try {
      const outfitId = await ensureRecord();
      if (!outfitId) return;
      if (!record?.saved) await markSaved(outfitId);
      await wearOutfit(outfitId);
      toast.success("Enjoy your outfit today!");
    } finally {
      setWearingNow(false);
    }
  }

  async function handleRate(rating: NonNullable<Outfit["rating"]>, reasons: string[]) {
    const outfitId = await ensureRecord();
    if (!outfitId) return;
    await giveFeedback(outfitId, rating, reasons, null);
    if (rating === "loved" && !record?.rating) toast.success("Got it, I'll build more like this");
  }

  const resolvedItems = look ? resolveItems(items, look.itemIds) : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">
            {greeting()}, {profile?.name || "there"} 👋
          </h1>
          <p className="mt-1 text-muted-foreground">Here&apos;s what I&apos;d recommend today.</p>
        </div>
        {weather && <WeatherBadge weather={weather} />}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-xl">Today&apos;s Outfit</h2>
          <Link href="/history" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            {ratedCount > 0
              ? `Tuned from ${ratedCount} rating${ratedCount === 1 ? "" : "s"} · see what I've learned →`
              : "View history →"}
          </Link>
        </div>

        {items.length === 0 && !wardrobeLoading ? (
          <EmptyState
            icon={Shirt}
            title="Add a few clothes to get started"
            description="Once you've added a handful of items, I can start recommending outfits every day."
          />
        ) : generating && !look ? (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <Skeleton className="h-6 w-40" />
            <div className="flex gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-24 shrink-0" />
              ))}
            </div>
            <Skeleton className="h-4 w-full" />
          </div>
        ) : look ? (
          <OutfitLookCard
            name={look.name}
            items={resolvedItems}
            reason={look.reason}
            missingItems={look.missingItems}
            saved={Boolean(record?.saved)}
            wearing={wearingNow}
            rating={record?.rating ?? null}
            ratingReasons={record?.feedbackReasons}
            onRate={handleRate}
            onWear={handleWear}
            onSave={record?.saved ? undefined : handleSave}
            onRegenerate={handleChange}
            onWhy={() => toast.info(look.reason)}
            onCompleteLook={
              look.missingItems.length > 0 ? () => setCompleteLookOpen(true) : undefined
            }
          />
        ) : null}
      </div>

      <div>
        <h2 className="font-display text-xl mb-3">Quick actions</h2>
        <QuickActions />
      </div>

      {look && (
        <CompleteLookDialog
          open={completeLookOpen}
          onOpenChange={setCompleteLookOpen}
          missingItems={look.missingItems}
        />
      )}
    </div>
  );
}
