import { NextResponse } from "next/server";
import { fetchWeather } from "@/lib/weather/provider";
import { mockWeather } from "@/lib/weather/mock";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lon = parseFloat(searchParams.get("lon") ?? "");

  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return NextResponse.json(mockWeather());
  }

  const snapshot = await fetchWeather(lat, lon);
  return NextResponse.json(snapshot);
}
