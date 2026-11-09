<script setup lang="ts">
// Explicit import: @vueuse/nuxt is a dependency but is not registered in
// nuxt.config modules, so VueUse composables are not auto-imported.
import { useIntervalFn } from "@vueuse/core";

type Bucket = "grocery" | "dining";
type SpendRow = { date: string; label: string; bucket: Bucket; amount: number };
type Period = {
  cap: number;
  grocery: number;
  dining: number;
  rows: SpendRow[];
};
type Spending = {
  week: Period & { start: string; end: string; daysElapsed: number };
  month: Period & { label: string; daysElapsed: number; daysInMonth: number; capFrom: string | null };
};

const { data, error, refresh } = await useFetch<Spending>("/api/budget/spending", {
  lazy: true,
  server: false,
});

useIntervalFn(() => refresh(), 5 * 60 * 1000);

// Category colours, not status colours: they must not be read as "over" or "under".
const COLOR: Record<Bucket, string> = {
  grocery: "#4f7a9a",
  dining: "#b8673a",
};
const LABEL: Record<Bucket, string> = {
  grocery: "Grocery",
  dining: "Dining out",
};
const OVER = "var(--parchment-clay, #a4403a)";
const WARN = "var(--parchment-amber, #b07d2b)";

/** Whole dollars for the totals; cents for the individual charges. */
function dollars(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(amount)).toLocaleString()}`;
}

function cents(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// One open drill-down at a time: "week:grocery", "month:dining", and so on.
const open = ref<string | null>(null);
function toggle(key: string) {
  open.value = open.value === key ? null : key;
}

/**
 * The week is judged against a flat cap, so the colour is about the total:
 * amber as it nears the cap, clay once it is past it.
 * The month is coloured by pace, as the budget dashboard is: 80% of a
 * month's food on the 8th is a different thing from 80% on the 28th.
 */
function tone(spent: number, cap: number, pace: number | null): string | null {
  if (cap <= 0)
    return null;
  if (pace === null) {
    if (spent > cap)
      return OVER;
    return spent / cap >= 0.8 ? WARN : null;
  }
  if (pace > 1.15)
    return OVER;
  if (pace > 1.0)
    return WARN;
  return null;
}

// The bar is one click target: a tap picks the segment under it. Empty
// buttons with percentage widths were not reliably tappable on the Silk
// WebView the wall tablet runs, so the handler lives on the bar itself.
function onBarClick(e: MouseEvent, view: { prefix: string; groceryPct: number; diningPct: number }) {
  const bar = e.currentTarget as HTMLElement;
  const rect = bar.getBoundingClientRect();
  if (rect.width <= 0)
    return;
  const pct = ((e.clientX - rect.left) / rect.width) * 100;
  if (pct < 0 || pct > 100)
    return;
  if (pct <= view.groceryPct)
    toggle(`${view.prefix}:grocery`);
  else if (pct <= view.groceryPct + view.diningPct)
    toggle(`${view.prefix}:dining`);
}

function build(key: "week" | "month", period: Period, daysFraction: number | null) {
  const total = period.grocery + period.dining;
  const cap = period.cap;
  const groceryPct = cap > 0 ? Math.min((period.grocery / cap) * 100, 100) : 0;
  const diningPct = cap > 0 ? Math.min((period.dining / cap) * 100, 100 - groceryPct) : 0;
  const pace = daysFraction !== null && cap > 0 ? (total / cap) / daysFraction : null;
  const color = tone(total, cap, pace);
  return {
    key,
    total,
    grocery: period.grocery,
    dining: period.dining,
    cap,
    left: cap - total,
    groceryPct,
    diningPct,
    color,
    rows: period.rows,
  };
}

const weekView = computed(() => {
  if (!data.value)
    return null;
  const w = data.value.week;
  return build("week", w, null);
});

const monthView = computed(() => {
  if (!data.value)
    return null;
  const m = data.value.month;
  return build("month", m, m.daysElapsed / m.daysInMonth);
});

function rowsFor(view: { key: string; rows: SpendRow[] }, bucket: Bucket) {
  return view.rows.filter(r => r.bucket === bucket);
}

const weekTitle = computed(() => {
  if (!data.value)
    return "";
  const s = new Date(`${data.value.week.start}T00:00:00`);
  const e = new Date(`${data.value.week.end}T00:00:00`);
  return `Week of ${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
});

function monthNameOf(key: string): string {
  return new Date(`${key}-01T00:00:00`).toLocaleString("default", { month: "long" });
}

const monthTitle = computed(() => {
  if (!data.value)
    return "";
  const d = new Date(`${data.value.month.label}-01T00:00:00`);
  return d.toLocaleString("default", { month: "long" });
});
</script>

<template>
  <div v-if="error" class="text-center text-sm text-dimmed">
    Food spending is unavailable right now.
  </div>

  <div v-else-if="data && weekView && monthView" class="flex flex-col gap-7">
    <!-- Two layers over the same charges: the week is a trip-by-trip budget, the month is the number the budget is built on. -->
    <div
      v-for="view in [
        { ...weekView, title: weekTitle, prefix: 'week' },
        { ...monthView, title: monthTitle, prefix: 'month' },
      ]"
      :key="view.key"
      class="flex flex-col gap-2"
    >
      <div class="flex items-baseline justify-between gap-3">
        <span class="text-lg">
          Food &middot; {{ view.title }}
        </span>
        <span class="text-lg tabular-nums" :style="view.color ? { color: view.color } : undefined">
          {{ dollars(view.total) }}
          <span class="text-sm text-dimmed">of {{ dollars(view.cap) }}</span>
        </span>
      </div>

      <!-- Tap a segment to see the charges behind it. -->
      <div class="relative flex h-10 w-full cursor-pointer overflow-hidden rounded-full bg-elevated" @click="onBarClick($event, view)">
        <button
          type="button"
          class="h-full transition-all"
          :style="{ width: `${view.groceryPct}%`, background: COLOR.grocery }"
          :aria-expanded="open === `${view.prefix}:grocery`"
          :aria-label="`${LABEL.grocery} ${dollars(view.grocery)}`"
                  />
        <button
          type="button"
          class="h-full transition-all"
          :style="{ width: `${view.diningPct}%`, background: COLOR.dining }"
          :aria-expanded="open === `${view.prefix}:dining`"
          :aria-label="`${LABEL.dining} ${dollars(view.dining)}`"
                  />
      </div>

      <p
        v-if="view.prefix === 'month' && data.month.capFrom"
        class="text-sm text-dimmed"
      >
        Cap carried over from {{ monthNameOf(data.month.capFrom) }}; set this month's budget in Actual to replace it.
      </p>

      <div class="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm tabular-nums">
        <button
          type="button"
          class="flex items-center gap-2 text-dimmed"
          :class="open === `${view.prefix}:grocery` ? 'text-default' : ''"
          @click="toggle(`${view.prefix}:grocery`)"
        >
          <span class="inline-block h-2.5 w-2.5 rounded-full" :style="{ background: COLOR.grocery }" />
          {{ LABEL.grocery }} {{ dollars(view.grocery) }}
        </button>
        <button
          type="button"
          class="flex items-center gap-2 text-dimmed"
          :class="open === `${view.prefix}:dining` ? 'text-default' : ''"
          @click="toggle(`${view.prefix}:dining`)"
        >
          <span class="inline-block h-2.5 w-2.5 rounded-full" :style="{ background: COLOR.dining }" />
          {{ LABEL.dining }} {{ dollars(view.dining) }}
        </button>
        <span v-if="view.left < 0" :style="{ color: OVER }">
          over by {{ dollars(-view.left) }}
        </span>
        <span v-else class="text-dimmed">
          {{ dollars(view.left) }} left
        </span>
      </div>

      <!-- The charges behind whichever segment was tapped. -->
      <ul
        v-for="bucket in (['grocery', 'dining'] as Bucket[])"
        v-show="open === `${view.prefix}:${bucket}`"
        :key="`${view.prefix}-${bucket}-list`"
        class="flex flex-col divide-y divide-default rounded-lg border border-default"
      >
        <li class="px-4 py-2 text-sm uppercase tracking-wide text-dimmed">
          {{ LABEL[bucket] }} &middot; {{ rowsFor(view, bucket).length }} charges
        </li>
        <li
          v-for="(r, i) in rowsFor(view, bucket)"
          :key="`${r.date}-${i}`"
          class="flex items-baseline justify-between gap-3 px-4 py-2"
        >
          <span class="min-w-0 flex-1 truncate">
            {{ r.label }}
            <span class="text-sm text-dimmed">{{ dayLabel(r.date) }}</span>
          </span>
          <span class="tabular-nums" :class="r.amount < 0 ? 'text-success' : ''">
            {{ cents(r.amount) }}
          </span>
        </li>
        <li
          v-if="rowsFor(view, bucket).length === 0"
          class="px-4 py-2 text-dimmed"
        >
          Nothing yet.
        </li>
      </ul>
    </div>
  </div>

  <div v-else class="text-center text-sm text-dimmed">
    Loading food spending...
  </div>
</template>
