<script setup lang="ts">
import type { DiscoverCategory } from "~/composables/useDiscoverEvents";

/**
 * Films and live music, as two toggles above the calendar.
 *
 * Turning one on narrows the calendar to that category rather than adding
 * to it: the question being asked is "what films are coming", not "my week
 * with films mixed in".
 */
const { counts, isActive, toggle, failed } = useDiscoverEvents();

const pills: Array<{ key: DiscoverCategory; label: string; icon: string }> = [
  { key: "film", label: "Films", icon: "i-lucide-clapperboard" },
  { key: "live-music", label: "Live music", icon: "i-lucide-music" },
];

// Only worth surfacing when a source is configured but not answering.
const notice = computed(() => {
  const tmdb = failed.value.find(f => f.startsWith("tmdb"));
  return tmdb ? "Premiere dates need a TMDB key — showing Trylon only." : "";
});
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 px-3 py-2">
    <UButton
      v-for="pill in pills"
      :key="pill.key"
      :icon="pill.icon"
      size="sm"
      :color="isActive(pill.key) ? 'primary' : 'neutral'"
      :variant="isActive(pill.key) ? 'solid' : 'outline'"
      :aria-pressed="isActive(pill.key)"
      class="rounded-full"
      @click="toggle(pill.key)"
    >
      {{ pill.label }}
      <span v-if="counts[pill.key]" class="ml-1 opacity-60 tabular-nums">
        {{ counts[pill.key] }}
      </span>
    </UButton>

    <span v-if="notice" class="text-xs text-muted">{{ notice }}</span>
  </div>
</template>
