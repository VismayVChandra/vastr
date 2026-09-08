"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChipSelect } from "@/components/shared/chip-select";
import { Button } from "@/components/ui/button";
import { FEEDBACK_REASONS, type Outfit } from "@/types/outfit";

const OPTIONS: { value: NonNullable<Outfit["rating"]>; emoji: string; label: string }[] = [
  { value: "loved", emoji: "👍", label: "Loved it" },
  { value: "okay", emoji: "🙂", label: "It was okay" },
  { value: "not-for-me", emoji: "👎", label: "Not for me" },
];

export function FeedbackButtons({
  outfit,
  onSubmit,
}: {
  outfit: Outfit;
  onSubmit: (rating: Outfit["rating"], reasons: string[], note: string | null) => void;
}) {
  const [pendingNegative, setPendingNegative] = useState(false);
  const [reasons, setReasons] = useState<string[]>(outfit.feedbackReasons ?? []);

  function pick(rating: NonNullable<Outfit["rating"]>) {
    if (rating === "not-for-me") {
      setPendingNegative(true);
      return;
    }
    onSubmit(rating, [], null);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => pick(o.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              outfit.rating === o.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:border-accent/40"
            )}
          >
            <span>{o.emoji}</span> {o.label}
          </button>
        ))}
      </div>

      {pendingNegative && (
        <div className="space-y-2 rounded-xl border border-border bg-secondary/40 p-3">
          <p className="text-xs text-muted-foreground">What didn&apos;t work?</p>
          <ChipSelect options={FEEDBACK_REASONS} value={reasons} onChange={setReasons} />
          <Button
            size="sm"
            onClick={() => {
              onSubmit("not-for-me", reasons, null);
              setPendingNegative(false);
            }}
          >
            Submit
          </Button>
        </div>
      )}
    </div>
  );
}
