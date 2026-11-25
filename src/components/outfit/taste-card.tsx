"use client";

import { useMemo, useState } from "react";
import { Brain, Heart, Palette, RotateCcw, Shirt, SlidersHorizontal, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWardrobeStore } from "@/store/wardrobe-store";
import { useOutfitStore } from "@/store/outfit-store";
import { learnTaste, type TasteInsight } from "@/lib/taste/learn";

const ICONS: Record<TasteInsight["kind"], typeof Heart> = {
  love: Heart,
  avoid: Palette,
  combo: Shirt,
  formality: SlidersHorizontal,
};

/** Shows, in plain language, what the stylist has picked up from the user's ratings and wears. */
export function TasteCard() {
  const items = useWardrobeStore((s) => s.items);
  const outfits = useOutfitStore((s) => s.outfits);
  const giveFeedback = useOutfitStore((s) => s.giveFeedback);
  const [resetting, setResetting] = useState(false);

  const taste = useMemo(() => learnTaste(outfits, items), [outfits, items]);
  const rated = outfits.filter((o) => o.rating);

  async function reset() {
    if (!window.confirm("Clear all your ratings? Vastr will forget what it learned from them. Your outfits and history stay.")) {
      return;
    }
    setResetting(true);
    try {
      await Promise.all(rated.map((o) => giveFeedback(o.id, null, [], null)));
    } finally {
      setResetting(false);
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-5" data-testid="taste-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-accent" />
          <h2 className="font-display text-lg">What Vastr has learned about you</h2>
        </div>
        {rated.length > 0 && (
          <Button variant="ghost" size="sm" onClick={reset} disabled={resetting}>
            <RotateCcw className="h-3.5 w-3.5" /> {resetting ? "Clearing..." : "Clear ratings"}
          </Button>
        )}
      </div>

      {taste.signalCount === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          Nothing yet. Tap 👍 or 👎 on the outfits I suggest, or mark one as worn, and I&apos;ll start tuning
          every recommendation to your taste. Two or three ratings is enough to notice.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            From {taste.ratedCount} rating{taste.ratedCount === 1 ? "" : "s"} and your wear history.
            Newer feedback counts more.
          </p>
          {taste.insights.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Still gathering evidence. A few more ratings and patterns will show up here.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {taste.insights.map((insight, i) => {
                const Icon = insight.kind === "avoid" ? ThumbsDown : ICONS[insight.kind];
                return (
                  <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>{insight.text}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
