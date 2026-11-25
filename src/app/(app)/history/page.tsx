"use client";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ClothingSwatch } from "@/components/shared/clothing-swatch";
import { FeedbackButtons } from "@/components/outfit/feedback-buttons";
import { TasteCard } from "@/components/outfit/taste-card";
import { useWardrobeStore } from "@/store/wardrobe-store";
import { useOutfitStore } from "@/store/outfit-store";
import { resolveItems } from "@/lib/resolve-items";
import { formatDate } from "@/lib/utils";
import { History } from "lucide-react";

export default function HistoryPage() {
  const items = useWardrobeStore((s) => s.items);
  const { outfits, giveFeedback } = useOutfitStore();

  const worn = outfits
    .filter((o) => o.saved || o.wornAt.length > 0)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <div>
      <PageHeader title="Outfit History" description="Every look you've saved or worn, in one place." />

      <TasteCard />

      {worn.length === 0 ? (
        <EmptyState
          icon={History}
          title="No outfits yet"
          description="Save or wear an outfit from Home, Style Me, or your AI Stylist to see it here."
        />
      ) : (
        <div className="space-y-4">
          {worn.map((outfit) => (
            <div key={outfit.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg">{outfit.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(outfit.createdAt)}
                    {outfit.occasion ? ` · ${outfit.occasion}` : ""}
                    {outfit.wornAt.length > 0
                      ? ` · Worn ${outfit.wornAt.length}x`
                      : " · Not worn yet"}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 overflow-x-auto py-4 no-scrollbar">
                {resolveItems(items, outfit.itemIds).map((item) => (
                  <ClothingSwatch
                    key={item.id}
                    imageUrl={item.imageUrl}
                    name={item.name}
                    category={item.category}
                    primaryColor={item.primaryColor}
                    className="h-20 w-16 shrink-0 rounded-lg"
                  />
                ))}
              </div>

              <FeedbackButtons
                outfit={outfit}
                onSubmit={(rating, reasons, note) => giveFeedback(outfit.id, rating, reasons, note)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
