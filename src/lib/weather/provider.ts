import "server-only";
import type { WeatherSnapshot } from "@/types/weather";
import { describeWmoCode } from "./wmo-codes";
import { mockWeather } from "./mock";

/** Open-Meteo needs no API key. Falls back to a mock snapshot on any failure
 *  so outfit recommendations always have *some* weather context. */
export async function fetchWeather(lat: number, lon: number): Promise<WeatherSnapshot> {
  try {
    const [forecastRes, placeRes] = await Promise.all([
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m&timezone=auto`,
        { next: { revalidate: 600 } }
      ),
      fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
        { next: { revalidate: 3600 } }
      ).catch(() => null),
    ]);

    if (!forecastRes.ok) throw new Error(`Weather API returned ${forecastRes.status}`);
    const data = await forecastRes.json();
    const current = data.current;
    const codeInfo = describeWmoCode(current.weather_code);

    let locationLabel = "Your location";
    if (placeRes?.ok) {
      const place = await placeRes.json().catch(() => null);
      locationLabel = place?.city || place?.locality || place?.principalSubdivision || locationLabel;
    }

    return {
      tempC: Math.round(current.temperature_2m),
      feelsLikeC: Math.round(current.apparent_temperature),
      condition: codeInfo.condition,
      conditionCode: current.weather_code,
      isRain: codeInfo.isRain,
      isSnow: codeInfo.isSnow,
      precipitationChance: current.precipitation_probability ?? 0,
      humidity: current.relative_humidity_2m ?? 0,
      windKph: Math.round(current.wind_speed_10m ?? 0),
      locationLabel,
      isMock: false,
    };
  } catch (err) {
    console.error("[weather] falling back to mock snapshot:", err);
    return mockWeather();
  }
}
