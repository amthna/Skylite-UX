<script setup lang="ts">
import { useIntervalFn } from "@vueuse/core";

type Weather = {
  temperature: number;
  feelsLike: number;
  weatherCode: number;
  isDay: boolean;
};

const { data, refresh } = await useFetch<Weather>("/api/weather/current", {
  lazy: true,
  server: false,
});

// The endpoint caches for 10 minutes, so this mostly serves that cache and
// only occasionally causes a real upstream fetch.
useIntervalFn(() => refresh(), 10 * 60 * 1000);

/**
 * WMO weather codes, grouped to the granularity a glance actually resolves.
 * https://open-meteo.com/en/docs
 */
function describe(code: number, isDay: boolean): { icon: string; label: string } {
  if (code === 0) {
    return isDay
      ? { icon: "i-lucide-sun", label: "Clear" }
      : { icon: "i-lucide-moon", label: "Clear" };
  }
  if (code <= 2) {
    return isDay
      ? { icon: "i-lucide-cloud-sun", label: "Partly cloudy" }
      : { icon: "i-lucide-cloud-moon", label: "Partly cloudy" };
  }
  if (code === 3) {
    return { icon: "i-lucide-cloud", label: "Overcast" };
  }
  if (code <= 48) {
    return { icon: "i-lucide-cloud-fog", label: "Fog" };
  }
  if (code <= 57) {
    return { icon: "i-lucide-cloud-drizzle", label: "Drizzle" };
  }
  if (code <= 67) {
    return { icon: "i-lucide-cloud-rain", label: "Rain" };
  }
  if (code <= 77) {
    return { icon: "i-lucide-snowflake", label: "Snow" };
  }
  if (code <= 82) {
    return { icon: "i-lucide-cloud-rain-wind", label: "Showers" };
  }
  if (code <= 86) {
    return { icon: "i-lucide-cloud-snow", label: "Snow showers" };
  }
  return { icon: "i-lucide-cloud-lightning", label: "Thunderstorm" };
}

const conditions = computed(() =>
  data.value ? describe(data.value.weatherCode, data.value.isDay) : null,
);
</script>

<template>
  <div v-if="data && conditions" class="flex items-center gap-3">
    <UIcon :name="conditions.icon" class="w-9 h-9 text-(--ui-primary)" />
    <div class="flex flex-col leading-tight">
      <span class="font-semibold text-xl text-highlighted tabular-nums">
        {{ data.temperature }}&deg;
      </span>
      <span class="text-sm text-muted tabular-nums">
        feels {{ data.feelsLike }}&deg;
      </span>
    </div>
    <span class="text-sm text-muted hidden lg:inline">{{ conditions.label }}</span>
  </div>
</template>
