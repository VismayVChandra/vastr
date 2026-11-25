"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { OutfitLookCard } from "@/components/outfit/outfit-look-card";
import { resolveItems } from "@/lib/resolve-items";
import { useWardrobeStore } from "@/store/wardrobe-store";
import { useOutfitStore } from "@/store/outfit-store";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import type { ChatMessage } from "@/types/chat";

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const items = useWardrobeStore((s) => s.items);
  const { profile } = useAuth();
  const markSaved = useOutfitStore((s) => s.markSaved);
  const wearOutfit = useOutfitStore((s) => s.wearOutfit);
  const giveFeedback = useOutfitStore((s) => s.giveFeedback);
  const outfitsById = useOutfitStore((s) => s.outfits);

  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
      )}
      <div className={cn("flex flex-col gap-3 max-w-[85%]", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
            isUser ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
          )}
        >
          {message.content}
        </div>

        {message.outfits?.map((initialOutfit) => {
          const outfit = outfitsById.find((o) => o.id === initialOutfit.id) ?? initialOutfit;
          return (
            <div key={outfit.id} className="w-full min-w-[280px]">
              <OutfitLookCard
                name={outfit.name}
                subtitle={outfit.occasion}
                items={resolveItems(items, outfit.itemIds)}
                reason={outfit.reason}
                missingItems={outfit.missingItems}
                saved={outfit.saved}
                rating={outfit.rating}
                ratingReasons={outfit.feedbackReasons}
                onRate={(rating, reasons) => giveFeedback(outfit.id, rating, reasons, null)}
                onWear={async () => {
                  if (!profile) return;
                  await wearOutfit(outfit.id);
                  toast.success("Enjoy!");
                }}
                onSave={
                  outfit.saved
                    ? undefined
                    : async () => {
                        await markSaved(outfit.id);
                        toast.success("Saved to outfit history");
                      }
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
