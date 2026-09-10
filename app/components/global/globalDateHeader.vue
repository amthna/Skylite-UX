<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";

import { addDays, endOfWeek, isSameMonth, startOfWeek } from "date-fns";

import type { CalendarView } from "~/types/calendar";
import type { TodoSortMode } from "~/types/ui";

import { useStableDate } from "~/composables/useStableDate";
import { TODO_SORT_OPTIONS } from "~/types/ui";

const props = defineProps<{
  showNavigation?: boolean;
  showTodoSortSelector?: boolean;
  currentDate?: Date;
  view?: CalendarView;
  todoSortBy?: TodoSortMode;
  className?: string;
}>();

const emit = defineEmits<{
  (e: "todoSortChange", mode: TodoSortMode): void;
}>();

const { getStableDate } = useStableDate();

const currentDate = computed(() => props.currentDate || getStableDate());
const view = computed(() => props.view || "week");

const now = ref(new Date());

onMounted(() => {
  const interval = setInterval(() => {
    now.value = new Date();
  }, 30000);

  onBeforeUnmount(() => {
    clearInterval(interval);
  });
});

const viewTitle = computed(() => {
  if (view.value === "month") {
    return "month";
  }
  else if (view.value === "week") {
    const start = startOfWeek(currentDate.value, { weekStartsOn: 0 });
    const end = endOfWeek(currentDate.value, { weekStartsOn: 0 });
    if (isSameMonth(start, end)) {
      return "week-same-month";
    }
    else {
      return "week-different-months";
    }
  }
  else if (view.value === "day") {
    return "day";
  }
  else if (view.value === "agenda") {
    const start = currentDate.value;
    const end = addDays(currentDate.value, 30 - 1);
    if (isSameMonth(start, end)) {
      return "agenda-same-month";
    }
    else {
      return "agenda-different-months";
    }
  }
  return "month";
});

const todoSortItems: DropdownMenuItem[][] = [
  TODO_SORT_OPTIONS.map(opt => ({
    label: opt.label,
    onSelect: () => emit("todoSortChange", opt.value),
  })),
];

const todoSortLabel = computed(() =>
  TODO_SORT_OPTIONS.find(o => o.value === (props.todoSortBy ?? "date"))?.label ?? "Date",
);
</script>

<template>
  <div
    class="flex flex-row items-center justify-between gap-4"
    :class="className"
  >
    <div class="flex-1 min-w-0">
      <h2 v-if="showNavigation" class="font-semibold text-3xl text-highlighted truncate">
        <NuxtTime
          v-if="viewTitle === 'month'"
          :datetime="currentDate"
          month="long"
          year="numeric"
        />
        <NuxtTime
          v-else-if="viewTitle === 'week-same-month'"
          :datetime="startOfWeek(currentDate, { weekStartsOn: 0 })"
          month="long"
          year="numeric"
        />
        <span v-else-if="viewTitle === 'week-different-months'">
          <NuxtTime
            :datetime="startOfWeek(currentDate, { weekStartsOn: 0 })"
            month="short"
          />
          -
          <NuxtTime
            :datetime="endOfWeek(currentDate, { weekStartsOn: 0 })"
            month="short"
            year="numeric"
          />
        </span>
        <NuxtTime
          v-else-if="viewTitle === 'day'"
          :datetime="currentDate"
          month="long"
          day="numeric"
          year="numeric"
        />
        <NuxtTime
          v-else-if="viewTitle === 'agenda-same-month'"
          :datetime="currentDate"
          month="long"
          year="numeric"
        />
        <span v-else-if="viewTitle === 'agenda-different-months'">
          <NuxtTime :datetime="currentDate" month="short" /> -
          <NuxtTime
            :datetime="addDays(currentDate, 30 - 1)"
            month="short"
            year="numeric"
          />
        </span>
        <NuxtTime
          v-else
          :datetime="currentDate"
          month="long"
          year="numeric"
        />
      </h2>
    </div>

    <div class="flex flex-1 justify-center">
      <GlobalWeather class="hidden sm:flex" />
    </div>

    <div class="flex flex-1 items-center justify-end gap-4">
      <div class="flex flex-col items-end gap-0.5">
        <h1 class="font-semibold text-xl text-highlighted">
          <NuxtTime
            :datetime="now"
            hour="numeric"
            minute="2-digit"
            :hour12="true"
          />
        </h1>
        <div class="text-sm text-muted">
          <NuxtTime
            :datetime="now"
            weekday="long"
            month="long"
            day="numeric"
          />
        </div>
      </div>
      <div
        v-if="showTodoSortSelector"
        class="flex items-center justify-between gap-2"
      >
        <UDropdownMenu :items="todoSortItems">
          <UButton
            color="neutral"
            variant="outline"
            size="xl"
            trailing-icon="i-lucide-chevron-down"
          >
            {{ todoSortLabel }}
          </UButton>
        </UDropdownMenu>
      </div>
    </div>
  </div>
</template>
