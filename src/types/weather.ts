export interface WeatherSnapshot {
  tempC: number;
  feelsLikeC: number;
  condition: string;
  conditionCode: number;
  isRain: boolean;
  isSnow: boolean;
  precipitationChance: number;
  humidity: number;
  windKph: number;
  locationLabel: string;
  isMock: boolean;
}
