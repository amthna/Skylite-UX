<script setup lang="ts">
// Explicit import: @vueuse/nuxt is a dependency but is not registered in
// nuxt.config modules, so VueUse composables are not auto-imported.
import { useIntervalFn } from "@vueuse/core";

type CategorySpend = {
  name: string;
  spentThisMonth: number;
  spentLastMonth: number;
};

type BudgetSummary = {
  categories: CategorySpend[];
  missing: string[];
  month: string;
  spentThisMonth: number;
  spentLastMonth: number;
  perDay: number;
  daysElapsed: number;
  daysInMonth: number;
  projected: number;
};

// Poll rather than push: the wrapper opens the budget file per request, so a
// wall display refreshing every few minutes is the right trade.
const { data, error, refresh } = await useFetch<BudgetSummary>("/api/budget/summary", {
  lazy: true,
  server: false,
});

useIntervalFn(() => refresh(), 5 * 60 * 1000);

/** Actual stores cents. Whole dollars only - this is read at arm's length. */
function dollars(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) {
    return "--";
  }
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

// Two accents from the parchment palette, in the order categories are
// configured, so the bar and the legend always agree.
const SEGMENT_COLORS = ["var(--parchment-clay)", "var(--parchment-amber)", "var(--parchment-dusk)"];

const segments = computed(() => {
  if (!data.value || data.value.spentThisMonth === 0) {
    return [];
  }
  return data.value.categories.map((category, index) => ({
    name: category.name,
    amount: category.spentThisMonth,
    share: (category.spentThisMonth / data.value!.spentThisMonth) * 100,
    color: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
  }));
});

const monthName = computed(() =>
  data.value
    ? new Date(`${data.value.month}-01T00:00:00`).toLocaleString(undefined, { month: "long" })
    : "",
);

const lastMonthName = computed(() => {
  if (!data.value) {
    return "";
  }
  const d = new Date(`${data.value.month}-01T00:00:00`);
  d.setMonth(d.getMonth() - 1);
  return d.toLocaleString(undefined, { month: "long" });
});

// Pace against last month, the only baseline available. Over 100% means
// today's run rate would finish the month higher than last month did.
const paceVsLastMonth = computed(() => {
  if (!data.value?.spentLastMonth) {
    return null;
  }
  return Math.round((data.value.projected / data.value.spentLastMonth) * 100);
});
</script>

<template>
  <div class="flex flex-1 flex-col min-h-0 items-center justify-center p-6">
    <div v-if="error" class="flex flex-col items-center gap-2 text-dimmed">
      <UIcon name="i-lucide-plug-zap" class="w-8 h-8" />
      <p class="text-lg">
        Can't reach the budget
      </p>
      <p class="text-sm">
        {{ error.data?.message || error.message }}
      </p>
    </div>

    <div v-else-if="!data" class="text-dimmed text-lg">
      Loading budget...
    </div>

    <div v-else class="flex w-full max-w-2xl flex-col gap-9">
      <!-- Headline: the combined figure, readable from across the room. -->
      <div class="flex flex-col items-center gap-1">
        <p class="text-lg uppercase tracking-wide text-dimmed">
          Food &middot; {{ monthName }}
        </p>
        <p class="text-7xl font-bold text-(--ui-primary) tabular-nums">
          {{ dollars(data.spentThisMonth) }}
        </p>
        <p class="text-md text-muted">
          spent over {{ data.daysElapsed }} of {{ data.daysInMonth }} days
        </p>
      </div>

      <!-- Split bar: how the combined total divides between categories. -->
      <div class="flex flex-col gap-2">
        <div class="flex h-4 w-full overflow-hidden rounded-full bg-elevated">
          <div
            v-for="segment in segments"
            :key="segment.name"
            class="h-full transition-all"
            :style="{ width: `${segment.share}%`, background: segment.color }"
            :title="`${segment.name}: ${dollars(segment.amount)}`"
          />
        </div>
        <div class="flex flex-wrap justify-center gap-x-6 gap-y-1">
          <div
            v-for="segment in segments"
            :key="segment.name"
            class="flex items-center gap-2"
          >
            <span
              class="h-3 w-3 rounded-full shrink-0"
              :style="{ background: segment.color }"
            />
            <span class="text-md text-toned">{{ segment.name }}</span>
            <span class="text-md font-semibold tabular-nums">{{ dollars(segment.amount) }}</span>
            <span class="text-sm text-dimmed tabular-nums">{{ Math.round(segment.share) }}%</span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-4 text-center">
        <div class="flex flex-col gap-1">
          <p class="text-3xl font-semibold tabular-nums">
            {{ dollars(data.perDay) }}
          </p>
          <p class="text-sm text-muted">
            per day
          </p>
        </div>
        <div class="flex flex-col gap-1">
          <p class="text-3xl font-semibold tabular-nums">
            {{ dollars(data.spentLastMonth) }}
          </p>
          <p class="text-sm text-muted">
            all of {{ lastMonthName }}
          </p>
        </div>
        <div class="flex flex-col gap-1">
          <p class="text-3xl font-semibold tabular-nums text-dimmed">
            {{ dollars(data.projected) }}
          </p>
          <p class="text-sm text-muted">
            on pace for
          </p>
        </div>
      </div>

      <p v-if="paceVsLastMonth" class="text-center text-md text-muted">
        Tracking
        <span
          class="font-semibold"
          :class="paceVsLastMonth > 100 ? 'text-(--ui-error)' : 'text-(--ui-success)'"
        >{{ paceVsLastMonth }}%</span>
        of {{ lastMonthName }}'s total
      </p>

      <p v-if="data.missing.length" class="text-center text-sm text-dimmed">
        Not found in this budget: {{ data.missing.join(", ") }}
      </p>
    </div>
  </div>
</template>
