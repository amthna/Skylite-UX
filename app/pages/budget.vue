<script setup lang="ts">
type BudgetSummary = {
  category: string;
  month: string;
  spentThisMonth: number;
  spentLastMonth: number | null;
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

// Share of the month elapsed, so the bar reads as "how far through are we".
const monthProgress = computed(() =>
  data.value ? (data.value.daysElapsed / data.value.daysInMonth) * 100 : 0,
);

// Pace against last month, the only baseline we have. Above 100% means today's
// run rate would finish the month higher than last month did.
const paceVsLastMonth = computed(() => {
  if (!data.value?.spentLastMonth) {
    return null;
  }
  return Math.round((data.value.projected / data.value.spentLastMonth) * 100);
});
</script>

<template>
  <div class="flex h-[calc(100vh-2rem)] w-full flex-col rounded-lg">
    <div class="py-5 sm:px-4 sticky top-0 z-40 bg-default border-b border-default">
      <GlobalDateHeader />
    </div>

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

      <div v-else class="flex w-full max-w-2xl flex-col gap-10">
        <!-- Headline: the one number worth reading from across the room. -->
        <div class="flex flex-col items-center gap-1">
          <p class="text-lg uppercase tracking-wide text-dimmed">
            {{ data.category }} &middot; {{ monthName }}
          </p>
          <p class="text-7xl font-bold text-(--ui-primary) tabular-nums">
            {{ dollars(data.spentThisMonth) }}
          </p>
          <p class="text-md text-muted">
            spent over {{ data.daysElapsed }} of {{ data.daysInMonth }} days
          </p>
        </div>

        <!-- How far through the month we are, so the total has context. -->
        <div class="flex flex-col gap-1">
          <div class="h-2 w-full rounded-full bg-elevated overflow-hidden">
            <div
              class="h-full rounded-full bg-(--ui-primary) transition-all"
              :style="{ width: `${monthProgress}%` }"
            />
          </div>
          <p class="text-sm text-dimmed text-right">
            {{ Math.round(monthProgress) }}% through {{ monthName }}
          </p>
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
      </div>
    </div>
  </div>
</template>
