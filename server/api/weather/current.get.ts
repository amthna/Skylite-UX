import { consola } from "consola";
import { createError } from "h3";

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
    is_day?: number;
  };
};

/**
 * Cached for 10 minutes: Open-Meteo updates every 15, and a wall display
 * polling it harder would be pure waste.
 */
export default defineCachedEventHandler(async () => {
  const config = useRuntimeConfig();
  const latitude = config.public.weatherLatitude;
  const longitude = config.public.weatherLongitude;
  const unit = config.public.weatherUnit as string;

  const url = "https://api.open-meteo.com/v1/forecast"
    + `?latitude=${latitude}&longitude=${longitude}`
    + "&current=temperature_2m,apparent_temperature,weather_code,is_day"
    + `&temperature_unit=${unit}`;

  try {
    const data = await $fetch<OpenMeteoResponse>(url);
    const current = data.current;
    if (!current || current.temperature_2m === undefined) {
      throw new Error("no current conditions in the response");
    }
    return {
      temperature: Math.round(current.temperature_2m),
      feelsLike: Math.round(current.apparent_temperature ?? current.temperature_2m),
      weatherCode: current.weather_code ?? 0,
      isDay: current.is_day !== 0,
    };
  }
  catch (error) {
    consola.error("Weather: failed to fetch current conditions:", error);
    throw createError({
      statusCode: 502,
      message: `Failed to fetch weather: ${error}`,
    });
  }
}, { maxAge: 600, name: "weather-current", getKey: () => "current" });
