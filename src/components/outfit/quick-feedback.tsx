"use client";

import { Check, ThumbsDown, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { FEEDBACK_REASONS, type Outfit } from "@/types/outfit";

type Rating = NonNullable<Outfit["rating"]>;

/**
 * One-tap feedback that sits right on a recommended look. A thumbs-down is
 * recorded immediately; the "why" chips are an optional extra that sharpen it.
 */
export function QuickFeedback({
  rating,
  reasons = [],
  onRate,
}: {
  rating: Outfit["rating"];
  reasons?: string[];
  onRate: (rating: Rating, reasons: string[]) => void;
}) {
  function toggleReason(reason: string) {
    const next = reasons.includes(reason) ? reasons.filter((r) => r !== reason) : [...reasons, reason];
    onRate("not-for-me", next);
  }

  return (
    <div className="px-5 pt-4" data-testid="quick-feedback">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {rating === "loved"
            ? "Noted, I'll build more like this."
            : rating === "not-for-me"
              ? "Noted, I'll steer away from this."
              : "Like this look?"}
        </span>
        <button
          type="button"
          aria-label="I like this look"
          aria-pressed={rating === "loved"}
          onClick={() => onRate("loved", [])}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
            rating === "loved"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:border-accent/40 hover:text-foreground"
          )}
        >
          {rating === "loved" ? <Check className="h-4 w-4" /> : <ThumbsUp className="h-4 w-4" />}
        </button>
        <button
          type="button"
          aria-label="Not for me"
          aria-pressed={rating === "not-for-me"}
          onClick={() => onRate("not-for-me", rating === "not-for-me" ? reasons : [])}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
            rating === "not-for-me"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:border-accent/40 hover:text-foreground"
          )}
        >
          <ThumbsDown className="h-4 w-4" />
        </button>
      </div>

      {rating === "not-for-me" && (
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="What didn't work?">
          {FEEDBACK_REASONS.filter((r) => r !== "Other").map((reason) => (
            <button
              key={reason}
              type="button"
              aria-pressed={reasons.includes(reason)}
              onClick={() => toggleReason(reason)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                reasons.includes(reason)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:border-accent/40"
              )}
            >
              {reason}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
