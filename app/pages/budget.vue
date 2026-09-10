<script setup lang="ts">
// Embeds a self-hosted budget app (Actual Budget) rather than reimplementing
// one. Set NUXT_PUBLIC_BUDGET_URL to the app's base URL; when it is empty the
// page explains itself instead of rendering a broken frame.
const budgetUrl = computed(() => useRuntimeConfig().public.budgetUrl as string);
</script>

<template>
  <div class="flex h-[calc(100vh-2rem)] w-full flex-col rounded-lg">
    <div
      class="py-5 sm:px-4 sticky top-0 z-40 bg-default border-b border-default"
    >
      <GlobalDateHeader />
    </div>

    <div class="flex flex-1 flex-col min-h-0">
      <iframe
        v-if="budgetUrl"
        :src="budgetUrl"
        class="w-full flex-1 border-0"
        title="Budget"
      />
      <div
        v-else
        class="flex flex-col items-center justify-center gap-2 h-full text-dimmed"
      >
        <UIcon name="i-lucide-wallet" class="w-8 h-8" />
        <p class="text-lg">
          No budget app configured
        </p>
        <p class="text-sm">
          Set NUXT_PUBLIC_BUDGET_URL to your budget app's address.
        </p>
      </div>
    </div>
  </div>
</template>
