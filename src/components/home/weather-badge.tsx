import { CloudRain, CloudSnow, Cloudy, Sun, CloudSun } from "lucide-react";
import type { WeatherSnapshot } from "@/types/weather";

function iconFor(w: WeatherSnapshot) {
  if (w.isSnow) return CloudSnow;
  if (w.isRain) return CloudRain;
  if (w.conditionCode <= 1) return Sun;
  if (w.conditionCode <= 3) return CloudSun;
  return Cloudy;
}

export function WeatherBadge({ weather }: { weather: WeatherSnapshot }) {
  const Icon = iconFor(weather);
  return (
    <div className="flex items-center gap-2.5 rounded-full border border-border bg-card px-4 py-2">
      <Icon className="h-4 w-4 text-accent" />
      <span className="text-sm font-medium">{weather.tempC}°C</span>
      <span className="text-sm text-muted-foreground">{weather.condition}</span>
      <span className="hidden sm:inline text-xs text-muted-foreground">
        · {weather.locationLabel}
      </span>
    </div>
  );
}
