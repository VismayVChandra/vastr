"use client";

import { useCallback, useState } from "react";
import { useAuth } from "./use-auth";
import { useWeather } from "./use-weather";
import { useWardrobeStore } from "@/store/wardrobe-store";
import { useOutfitStore } from "@/store/outfit-store";
import type { GeneratedOutfit } from "@/lib/ai/stylist-context";

interface GenerateOptions {
  query: string;
  constraints?: string[];
  count?: number;
}

export function useOutfitGenerator() {
  const { profile } = useAuth();
  const { weather } = useWeather();
  const items = useWardrobeStore((s) => s.items);
  const outfits = useOutfitStore((s) => s.outfits);

  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(false);

  const generate = useCallback(
    async ({ query, constraints = [], count = 3 }: GenerateOptions): Promise<GeneratedOutfit[]> => {
      setGenerating(true);
      try {
        // The server never looks at photos, and in demo mode they're inline data URLs
        // that can blow past the request size limit, so leave them out.
        const wardrobe = items.map((i) => ({ ...i, imageUrl: null }));
        // Newest few for variety, plus everything the user rated or wore so the stylist can learn from it.
        const withSignal = outfits.filter((o) => o.rating || o.wornAt.length > 0).slice(0, 80);
        const seen = new Set<string>();
        const recentOutfits = [...outfits.slice(0, 5), ...withSignal].filter((o) => {
          if (seen.has(o.id)) return false;
          seen.add(o.id);
          return true;
        });

        const res = await fetch("/api/outfits/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wardrobe,
            preferences: profile?.preferences,
            weather,
            query,
            constraints,
            recentOutfits,
            count,
          }),
        });
        if (!res.ok) throw new Error("Failed to generate outfits");
        const data = await res.json();
        setMessage(data.message ?? null);
        setIsMock(Boolean(data.isMock));
        return data.outfits as GeneratedOutfit[];
      } finally {
        setGenerating(false);
      }
    },
    [items, profile, weather, outfits]
  );

  return { generate, generating, message, isMock, weather };
}
