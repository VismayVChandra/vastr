"use client";

import { useCallback, useState } from "react";
import { useAuth } from "./use-auth";
import { useWeather } from "./use-weather";
import { useWardrobeStore } from "@/store/wardrobe-store";
import { useOutfitStore } from "@/store/outfit-store";
import { buildStylistPayload } from "@/lib/ai/payload";
import type { ChatResult, ChatTurn } from "@/lib/ai/chat-context";
import type { ChatMessage } from "@/types/chat";

/** Turns stored chat messages into the compact history the stylist reads. */
export function toChatTurns(messages: ChatMessage[]): ChatTurn[] {
  return messages.slice(-12).map((m) => ({
    role: m.role,
    content: m.content,
    outfits: m.outfits?.map((o) => ({ name: o.name, label: o.occasion, itemIds: o.itemIds })),
  }));
}

export function useStylistChat() {
  const { profile } = useAuth();
  const { weather } = useWeather();
  const items = useWardrobeStore((s) => s.items);
  const outfits = useOutfitStore((s) => s.outfits);
  const [thinking, setThinking] = useState(false);

  const ask = useCallback(
    async (message: string, history: ChatTurn[]): Promise<ChatResult> => {
      setThinking(true);
      try {
        const res = await fetch("/api/stylist/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...buildStylistPayload({ items, outfits, profile, weather }),
            message,
            history,
          }),
        });
        if (!res.ok) throw new Error("The stylist couldn't answer");
        return (await res.json()) as ChatResult;
      } finally {
        setThinking(false);
      }
    },
    [items, outfits, profile, weather]
  );

  return { ask, thinking };
}
