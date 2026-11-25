"use client";

import { useCallback, useState } from "react";
import { useAuth } from "./use-auth";
import { useWeather } from "./use-weather";
import { useWardrobeStore } from "@/store/wardrobe-store";
import { useOutfitStore } from "@/store/outfit-store";
import type { GeneratedOutfit } from "@/lib/ai/stylist-context";
import { buildStylistPayload } from "@/lib/ai/payload";

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
        const res = await fetch("/api/outfits/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...buildStylistPayload({ items, outfits, profile, weather }),
            query,
            constraints,
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
