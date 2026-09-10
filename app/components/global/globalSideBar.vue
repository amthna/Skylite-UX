<script setup lang="ts">
import { NAV_ITEMS } from "~/types/ui";

const route = useRoute();
const { preferences } = useClientPreferences();

// Settings is pinned: hiding it would leave no way back to re-enable anything.
const visibleItems = computed(() => {
  const hidden = preferences.value?.hiddenNavItems ?? [];
  return NAV_ITEMS.filter(i => i.alwaysVisible || !hidden.includes(i.path));
});

function isActivePath(path: string) {
  return route.path === path;
}
</script>

<template>
  <div
    class="sticky top-0 left-0 h-[calc(100vh-80px)] w-[50px] bg-default flex flex-col items-center justify-evenly py-4 z-100"
  >
    <UButton
      v-for="item in visibleItems"
      :key="item.path"
      :class="isActivePath(item.path) ? 'text-primary' : 'text-default'"
      :to="item.path"
      variant="ghost"
      :icon="item.icon"
      size="xl"
      :aria-label="item.label"
    />
  </div>
</template>
