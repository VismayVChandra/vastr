import type { WeatherSnapshot } from "@/types/weather";

export function mockWeather(): WeatherSnapshot {
  return {
    tempC: 26,
    feelsLikeC: 27,
    condition: "Partly cloudy",
    conditionCode: 2,
    isRain: false,
    isSnow: false,
    precipitationChance: 10,
    humidity: 55,
    windKph: 12,
    locationLabel: "Your area",
    isMock: true,
  };
}
