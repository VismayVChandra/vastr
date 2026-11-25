"use client";

import { useState } from "react";
import { Shuffle, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChipSelect } from "@/components/shared/chip-select";
import { OutfitLookCard } from "@/components/outfit/outfit-look-card";
import { CompleteLookDialog } from "@/components/shop/complete-look-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useWardrobeStore } from "@/store/wardrobe-store";
import { useOutfitStore } from "@/store/outfit-store";
import { useOutfitGenerator } from "@/hooks/use-outfit-generator";
import { resolveItems } from "@/lib/resolve-items";
import { STYLE_TAGS } from "@/types/wardrobe";
import { COLOR_PALETTE } from "@/lib/colors";
import type { GeneratedOutfit } from "@/lib/ai/stylist-context";
import type { Outfit } from "@/types/outfit";
import { toast } from "sonner";
import { Shirt } from "lucide-react";

export default function StyleMePage() {
  const { profile } = useAuth();
  const items = useWardrobeStore((s) => s.items);
  const saveOutfit = useOutfitStore((s) => s.save);
  const createDraft = useOutfitStore((s) => s.createDraft);
  const markSaved = useOutfitStore((s) => s.markSaved);
  const giveFeedback = useOutfitStore((s) => s.giveFeedback);
  const wearOutfit = useOutfitStore((s) => s.wearOutfit);
  const outfits = useOutfitStore((s) => s.outfits);
  const { generate, generating } = useOutfitGenerator();

  const [occasion, setOccasion] = useState("");
  const [activity, setActivity] = useState("");
  const [styles, setStyles] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [results, setResults] = useState<GeneratedOutfit[] | null>(null);
  // Stored record per look, created the first time it's rated, saved or worn.
  const [recordIds, setRecordIds] = useState<Record<number, string>>({});
  const [wearingIndex, setWearingIndex] = useState<number | null>(null);
  const [completeLookFor, setCompleteLookFor] = useState<GeneratedOutfit | null>(null);

  function buildQuery(surprise = false) {
    if (surprise) return "Surprise me with something stylish from my wardrobe.";
    const parts: string[] = [];
    if (occasion) parts.push(`Occasion: ${occasion}.`);
    if (activity) parts.push(`Activity: ${activity}.`);
    if (styles.length) parts.push(`Preferred style: ${styles.join(", ")}.`);
    if (colors.length) parts.push(`Preferred colours: ${colors.join(", ")}.`);
    return parts.length ? parts.join(" ") : "Put together a great outfit for today.";
  }

  async function handleGenerate(surprise = false) {
    setResults(null);
    setRecordIds({});
    const generated = await generate({ query: buildQuery(surprise), count: 3 });
    setResults(generated);
  }

  const toInput = (look: GeneratedOutfit) => ({
    name: look.name,
    itemIds: look.itemIds,
    reason: look.reason,
    occasion: occasion || null,
    missingItems: look.missingItems,
    source: "style-me" as const,
  });

  /** Stores a look (as a draft) the first time it needs a record, and returns its id. */
  async function ensureRecord(index: number, look: GeneratedOutfit): Promise<string | null> {
    if (!profile) return null;
    if (recordIds[index]) return recordIds[index];
    const outfit = await createDraft(profile.id, toInput(look));
    setRecordIds((s) => ({ ...s, [index]: outfit.id }));
    return outfit.id;
  }

  const recordFor = (index: number) => outfits.find((o) => o.id === recordIds[index]) ?? null;

  async function handleSave(index: number, look: GeneratedOutfit) {
    if (!profile) return;
    if (recordIds[index]) {
      await markSaved(recordIds[index]);
    } else {
      const outfit = await saveOutfit(profile.id, toInput(look));
      setRecordIds((s) => ({ ...s, [index]: outfit.id }));
    }
    toast.success("Outfit saved");
  }

  async function handleWear(index: number, look: GeneratedOutfit) {
    if (!profile) return;
    setWearingIndex(index);
    try {
      const outfitId = await ensureRecord(index, look);
      if (!outfitId) return;
      if (!recordFor(index)?.saved) await markSaved(outfitId);
      await wearOutfit(outfitId);
      toast.success("Have a great day in it!");
    } finally {
      setWearingIndex(null);
    }
  }

  async function handleRate(
    index: number,
    look: GeneratedOutfit,
    rating: NonNullable<Outfit["rating"]>,
    reasons: string[]
  ) {
    const outfitId = await ensureRecord(index, look);
    if (outfitId) await giveFeedback(outfitId, rating, reasons, null);
  }

  return (
    <div>
      <PageHeader title="Style Me" description="Tell me the vibe, I'll build the outfit." />

      <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
        <div className="space-y-5 rounded-2xl border border-border bg-card p-5 h-fit">
          <div className="space-y-1.5">
            <Label>Occasion</Label>
            <Input
              placeholder="Dinner with friends, office, interview..."
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Activity</Label>
            <Input
              placeholder="Walking around, sitting in meetings..."
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Style</Label>
            <ChipSelect options={STYLE_TAGS} value={styles} onChange={setStyles} />
          </div>
          <div className="space-y-1.5">
            <Label>Colour preference</Label>
            <ChipSelect options={COLOR_PALETTE} value={colors} onChange={setColors} />
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={() => handleGenerate(false)} disabled={generating}>
              <Wand2 className="h-4 w-4" /> {generating ? "Styling..." : "Generate outfits"}
            </Button>
            <Button variant="outline" onClick={() => handleGenerate(true)} disabled={generating}>
              <Shuffle className="h-4 w-4" /> Surprise me
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {items.length === 0 ? (
            <EmptyState
              icon={Shirt}
              title="Add clothes first"
              description="Style Me works from your real wardrobe — add a few items to get outfit ideas."
            />
          ) : generating ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-border bg-card p-5 space-y-4">
                  <Skeleton className="h-6 w-32" />
                  <div className="flex gap-3">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <Skeleton key={j} className="h-32 w-24 shrink-0" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : results ? (
            results.map((look, i) => (
              <OutfitLookCard
                key={i}
                name={`Look 0${i + 1} — ${look.name}`}
                items={resolveItems(items, look.itemIds)}
                reason={look.reason}
                missingItems={look.missingItems}
                saved={Boolean(recordFor(i)?.saved)}
                wearing={wearingIndex === i}
                rating={recordFor(i)?.rating ?? null}
                ratingReasons={recordFor(i)?.feedbackReasons}
                onRate={(rating, reasons) => handleRate(i, look, rating, reasons)}
                onWear={() => handleWear(i, look)}
                onSave={recordFor(i)?.saved ? undefined : () => handleSave(i, look)}
                onCompleteLook={
                  look.missingItems.length > 0 ? () => setCompleteLookFor(look) : undefined
                }
              />
            ))
          ) : (
            <EmptyState
              icon={Wand2}
              title="Ready when you are"
              description="Fill in a few details (or hit Surprise me) and I'll build three outfit options from your wardrobe."
            />
          )}
        </div>
      </div>

      <CompleteLookDialog
        open={Boolean(completeLookFor)}
        onOpenChange={(open) => !open && setCompleteLookFor(null)}
        missingItems={completeLookFor?.missingItems ?? []}
      />
    </div>
  );
}
