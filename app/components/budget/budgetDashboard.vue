<script setup lang="ts">
// Explicit import: @vueuse/nuxt is a dependency but is not registered in
// nuxt.config modules, so VueUse composables are not auto-imported.
import { useIntervalFn } from "@vueuse/core";

type CategoryLine = {
  name: string;
  found: boolean;
  budgeted: number;
  spent: number;
  remaining: number;
  pace: number | null;
  perDayLeft: number;
};

type BudgetSummary = {
  month: string;
  categories: CategoryLine[];
  missing: string[];
  budgeted: number;
  spent: number;
  remaining: number;
  daysElapsed: number;
  daysInMonth: number;
  daysLeft: number;
  monthProgress: number;
  pace: number | null;
  perDayLeft: number;
  loan: { name: string; balance: number; original: number; paid: number } | null;
};

type Trips = {
  category: string;
  found: boolean;
  thisWeek: number;
  usualWeek: number;
};

// Poll rather than push: the wrapper opens the budget file per request, so a
// wall display refreshing every few minutes is the right trade.
const { data, error, refresh } = await useFetch<BudgetSummary>("/api/budget/summary", {
  lazy: true,
  server: false,
});

// Separate call: it walks every account's transactions, and the headline
// numbers should not wait for it.
const { data: trips } = await useFetch<Trips>("/api/budget/trips", {
  lazy: true,
  server: false,
});

useIntervalFn(() => refresh(), 5 * 60 * 1000);

/** Actual stores cents. Whole dollars only - this is read at arm's length. */
function dollars(cents: number | null | undefined): string {
  if (cents === null || cents === undefined)
    return "--";
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(cents) / 100).toLocaleString()}`;
}

const monthName = computed(() =>
  data.value
    ? new Date(`${data.value.month}-01T00:00:00`)
        .toLocaleString("default", { month: "long" })
    : "");

/**
 * Colour by PACE, not by total. Being 70% through the budget is fine on the
 * 25th and a problem on the 8th, and the point of a wall display is to catch
 * the second case while there is still a month left to do something about it.
 */
function paceTone(pace: number | null): "ok" | "warn" | "over" {
  if (pace === null)
    return "ok";
  if (pace > 1.15)
    return "over";
  if (pace > 1.0)
    return "warn";
  return "ok";
}

const TONE_COLOR: Record<string, string> = {
  ok: "var(--parchment-sage, #2f6b4f)",
  warn: "var(--parchment-amber, #b07d2b)",
  over: "var(--parchment-clay, #a4403a)",
};

const headlineTone = computed(() => paceTone(data.value?.pace ?? null));

const lines = computed(() =>
  (data.value?.categories ?? []).filter(c => c.found).map((c) => {
    const tone = paceTone(c.pace);
    return {
      ...c,
      tone,
      color: TONE_COLOR[tone],
      // Bar fills with what has been SPENT, capped so an overspend does not
      // render past the end of its track.
      fill: c.budgeted > 0 ? Math.min((c.spent / c.budgeted) * 100, 100) : 0,
      over: c.remaining < 0,
    };
  }));

const loanPct = computed(() => {
  const l = data.value?.loan;
  if (!l || !l.original)
    return null;
  return Math.min(Math.max((l.paid / l.original) * 100, 0), 100);
});
</script>

<template>
  <div class="flex flex-1 flex-col min-h-0 items-center justify-center p-5">
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

    <div v-else class="flex w-full max-w-2xl flex-col gap-7">
      <!--
        The headline is what is LEFT, not what is gone. The decision this
        display exists to inform happens in a shop, and "spent so far" is no
        help there.
      -->
      <div class="flex flex-col items-center gap-1">
        <p class="text-lg uppercase tracking-wide text-dimmed">
          Left to spend &middot; {{ monthName }}
        </p>
        <p
          class="text-7xl font-bold tabular-nums leading-none"
          :style="{ color: TONE_COLOR[headlineTone] }"
        >
          {{ dollars(data.remaining) }}
        </p>
        <p class="text-md text-muted">
          <template v-if="data.daysLeft > 0">
            {{ data.daysLeft }} days to go &middot;
            <span class="tabular-nums">{{ dollars(data.perDayLeft) }}</span> a day
          </template>
          <template v-else>
            last day of the month
          </template>
        </p>
      </div>

      <!-- One row per category: what is left, and whether the pace is right. -->
      <div class="flex flex-col gap-4">
        <div
          v-for="line in lines"
          :key="line.name"
          class="flex flex-col gap-1.5"
        >
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-lg">{{ line.name }}</span>
            <span class="text-lg tabular-nums" :style="{ color: line.color }">
              {{ dollars(line.remaining) }}
              <span class="text-sm text-dimmed">left</span>
            </span>
          </div>
          <div class="relative h-3 w-full overflow-hidden rounded-full bg-elevated">
            <div
              class="h-full transition-all"
              :style="{ width: `${line.fill}%`, background: line.color }"
            />
            <!-- Where an even month would have us by today. -->
            <div
              class="absolute top-0 h-full w-px bg-default opacity-70"
              :style="{ left: `${data.monthProgress * 100}%` }"
            />
          </div>
          <div class="flex justify-between text-sm text-dimmed tabular-nums">
            <span>{{ dollars(line.spent) }} of {{ dollars(line.budgeted) }}</span>
            <span v-if="line.over" :style="{ color: line.color }">
              over by {{ dollars(-line.remaining) }}
            </span>
            <span v-else-if="line.tone !== 'ok'" :style="{ color: line.color }">
              ahead of pace
            </span>
            <span v-else>{{ dollars(line.perDayLeft) }} a day left</span>
          </div>
        </div>
      </div>

      <div class="flex gap-3">
        <!--
          Trips, not dollars. The food overspend is frequency, not basket
          size, and a count is something you can act on without arithmetic.
        -->
        <div
          v-if="trips?.found"
          class="flex-1 rounded-lg border border-default px-4 py-3"
        >
          <p class="text-xs uppercase tracking-wide text-dimmed">
            {{ trips.category }} trips this week
          </p>
          <p class="text-3xl font-bold tabular-nums leading-tight">
            {{ trips.thisWeek }}
            <span class="text-base font-normal text-dimmed">
              vs {{ trips.usualWeek }} usual
            </span>
          </p>
        </div>

        <!-- The point of the whole exercise, counting down. -->
        <div
          v-if="data.loan"
          class="flex-1 rounded-lg border border-default px-4 py-3"
        >
          <p class="text-xs uppercase tracking-wide text-dimmed">
            {{ data.loan.name }}
          </p>
          <p class="text-3xl font-bold tabular-nums leading-tight">
            {{ dollars(data.loan.balance) }}
          </p>
          <div v-if="loanPct !== null" class="mt-2 h-2 w-full overflow-hidden rounded-full bg-elevated">
            <div
              class="h-full transition-all"
              :style="{ width: `${loanPct}%`, background: TONE_COLOR.ok }"
            />
          </div>
        </div>
      </div>

      <p v-if="data.missing.length" class="text-center text-sm text-dimmed">
        Not in this month's budget: {{ data.missing.join(", ") }}
      </p>
    </div>
  </div>
</template>
