"use client";

import { AlertCircle, RefreshCcw, Sparkles } from "lucide-react";
import { ClothingSwatch } from "@/components/shared/clothing-swatch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QuickFeedback } from "@/components/outfit/quick-feedback";
import type { WardrobeItem } from "@/types/wardrobe";
import type { MissingPiece, Outfit } from "@/types/outfit";

interface OutfitLookCardProps {
  name: string;
  items: WardrobeItem[];
  reason: string;
  missingItems?: MissingPiece[];
  onWear?: () => void;
  onSave?: () => void;
  onRegenerate?: () => void;
  onCompleteLook?: () => void;
  onWhy?: () => void;
  saved?: boolean;
  wearing?: boolean;
  /** When provided, the card shows one-tap thumbs up/down so the stylist can learn. */
  onRate?: (rating: NonNullable<Outfit["rating"]>, reasons: string[]) => void;
  rating?: Outfit["rating"];
  ratingReasons?: string[];
}

export function OutfitLookCard({
  name,
  items,
  reason,
  missingItems = [],
  onWear,
  onSave,
  onRegenerate,
  onCompleteLook,
  onWhy,
  saved,
  wearing,
  onRate,
  rating = null,
  ratingReasons,
}: OutfitLookCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5">
        <h3 className="font-display text-lg">{name}</h3>
        {saved && (
          <Badge variant="accent">
            <Sparkles className="h-3 w-3" /> Saved
          </Badge>
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto px-5 py-4 no-scrollbar">
        {items.map((item) => (
          <div key={item.id} className="w-24 shrink-0">
            <ClothingSwatch
              imageUrl={item.imageUrl}
              name={item.name}
              category={item.category}
              primaryColor={item.primaryColor}
              className="aspect-[3/4] w-full rounded-xl"
            />
            <p className="mt-1.5 truncate text-[11px] text-muted-foreground">{item.name}</p>
          </div>
        ))}
        {missingItems.map((m, i) => (
          <div
            key={i}
            className="flex w-24 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border aspect-[3/4] text-center px-1.5"
          >
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground leading-tight">{m.description}</p>
          </div>
        ))}
      </div>

      <p className="px-5 text-sm text-muted-foreground leading-relaxed">{reason}</p>

      {onRate && <QuickFeedback rating={rating} reasons={ratingReasons} onRate={onRate} />}

      <div className="flex flex-wrap items-center gap-2 px-5 py-5">
        {onWear && (
          <Button onClick={onWear} disabled={wearing}>
            {wearing ? "Marking as worn..." : "Wear this outfit"}
          </Button>
        )}
        {onSave && !saved && (
          <Button variant="outline" onClick={onSave}>
            Save outfit
          </Button>
        )}
        {onRegenerate && (
          <Button variant="ghost" onClick={onRegenerate}>
            <RefreshCcw className="h-3.5 w-3.5" /> Regenerate
          </Button>
        )}
        {onWhy && (
          <Button variant="ghost" onClick={onWhy}>
            Why this?
          </Button>
        )}
        {missingItems.length > 0 && onCompleteLook && (
          <Button variant="secondary" onClick={onCompleteLook}>
            Complete the look
          </Button>
        )}
      </div>
    </div>
  );
}
