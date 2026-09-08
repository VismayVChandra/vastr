interface CodeInfo {
  condition: string;
  isRain: boolean;
  isSnow: boolean;
}

const WMO_CODES: Record<number, CodeInfo> = {
  0: { condition: "Clear sky", isRain: false, isSnow: false },
  1: { condition: "Mostly clear", isRain: false, isSnow: false },
  2: { condition: "Partly cloudy", isRain: false, isSnow: false },
  3: { condition: "Overcast", isRain: false, isSnow: false },
  45: { condition: "Foggy", isRain: false, isSnow: false },
  48: { condition: "Foggy", isRain: false, isSnow: false },
  51: { condition: "Light drizzle", isRain: true, isSnow: false },
  53: { condition: "Drizzle", isRain: true, isSnow: false },
  55: { condition: "Dense drizzle", isRain: true, isSnow: false },
  61: { condition: "Light rain", isRain: true, isSnow: false },
  63: { condition: "Rain", isRain: true, isSnow: false },
  65: { condition: "Heavy rain", isRain: true, isSnow: false },
  66: { condition: "Freezing rain", isRain: true, isSnow: false },
  67: { condition: "Freezing rain", isRain: true, isSnow: false },
  71: { condition: "Light snow", isRain: false, isSnow: true },
  73: { condition: "Snow", isRain: false, isSnow: true },
  75: { condition: "Heavy snow", isRain: false, isSnow: true },
  77: { condition: "Snow grains", isRain: false, isSnow: true },
  80: { condition: "Rain showers", isRain: true, isSnow: false },
  81: { condition: "Rain showers", isRain: true, isSnow: false },
  82: { condition: "Violent rain showers", isRain: true, isSnow: false },
  85: { condition: "Snow showers", isRain: false, isSnow: true },
  86: { condition: "Snow showers", isRain: false, isSnow: true },
  95: { condition: "Thunderstorm", isRain: true, isSnow: false },
  96: { condition: "Thunderstorm with hail", isRain: true, isSnow: false },
  99: { condition: "Thunderstorm with hail", isRain: true, isSnow: false },
};

export function describeWmoCode(code: number): CodeInfo {
  return WMO_CODES[code] ?? { condition: "Unsettled", isRain: false, isSnow: false };
}
