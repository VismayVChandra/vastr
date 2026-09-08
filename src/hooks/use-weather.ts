"use client";

import { useEffect, useState } from "react";
import type { WeatherSnapshot } from "@/types/weather";

export function useWeather() {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load(lat?: number, lon?: number) {
      try {
        const params = lat != null && lon != null ? `?lat=${lat}&lon=${lon}` : "";
        const res = await fetch(`/api/weather${params}`);
        const data = await res.json();
        if (!cancelled) setWeather(data);
      } catch {
        // Keep whatever we had; the API route itself falls back to a mock.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => load(pos.coords.latitude, pos.coords.longitude),
        () => load(),
        { timeout: 5000 }
      );
    } else {
      load();
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return { weather, loading };
}
