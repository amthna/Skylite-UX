<script setup lang="ts">
import { useEventListener, useSwipe } from "@vueuse/core";
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  isSameMonth,
  subMonths,
  subWeeks,
} from "date-fns";

import type { CalendarEvent, CalendarView } from "~/types/calendar";
import type { Integration } from "~/types/database";

import GlobalDateHeader from "~/components/global/globalDateHeader.vue";
import GlobalFloatingActionButton from "~/components/global/globalFloatingActionButton.vue";
import { useCalendar } from "~/composables/useCalendar";
import { useCalendarIntegrations } from "~/composables/useCalendarIntegrations";
import { useStableDate } from "~/composables/useStableDate";
import { DEFAULT_LOCAL_EVENT_COLOR } from "~/types/global";

const props = defineProps<{
  events?: CalendarEvent[];
  className?: string;
  initialView?: CalendarView;
  class?: string;
  getIntegrationCapabilities?: (
    event: CalendarEvent,
  ) => { capabilities: string[]; serviceName?: string } | undefined;
}>();

const emit = defineEmits<{
  (e: "eventAdd", event: CalendarEvent): void;
  (e: "eventUpdate", event: CalendarEvent): void;
  (e: "eventDelete", eventId: string): void;
  (e: "viewChange", view: CalendarView): void;
}>();

const { getStableDate, stableDate } = useStableDate();
const { getEventsForDateRange, scrollToDate } = useCalendar();
const { calendarIntegrations } = useCalendarIntegrations();
const currentDate = useState<Date>("calendar-current-date", () =>
  getStableDate());
const view = ref<CalendarView>(props.initialView || "week");
const isEventDialogOpen = ref(false);
const selectedEvent = ref<CalendarEvent | null>(null);

onMounted(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (
      isEventDialogOpen.value
      || e.target instanceof HTMLInputElement
      || e.target instanceof HTMLTextAreaElement
      || (e.target instanceof HTMLElement && e.target.isContentEditable)
    ) {
      return;
    }

    switch (e.key.toLowerCase()) {
      case "m":
        view.value = "month";
        emit("viewChange", view.value);
        break;
      case "w":
        view.value = "week";
        emit("viewChange", view.value);
        break;
      case "d":
        view.value = "day";
        emit("viewChange", view.value);
        break;
      case "a":
        view.value = "agenda";
        emit("viewChange", view.value);
        break;
    }
  };

  window.addEventListener("keydown", handleKeyDown, { passive: false });
  onUnmounted(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });
});

function handlePrevious() {
  if (view.value === "month") {
    currentDate.value = subMonths(currentDate.value, 1);
  }
  else if (view.value === "week") {
    currentDate.value = subWeeks(currentDate.value, 1);
  }
  else if (view.value === "day") {
    currentDate.value = addDays(currentDate.value, -1);
  }
  else if (view.value === "agenda") {
    currentDate.value = addDays(currentDate.value, -30);
  }
}

function handleNext() {
  if (view.value === "month") {
    currentDate.value = addMonths(currentDate.value, 1);
  }
  else if (view.value === "week") {
    currentDate.value = addWeeks(currentDate.value, 1);
  }
  else if (view.value === "day") {
    currentDate.value = addDays(currentDate.value, 1);
  }
  else if (view.value === "agenda") {
    currentDate.value = addDays(currentDate.value, 30);
  }
}

// Touch navigation: swipe the calendar body left/right to page through the
// current view. Reuses handleNext/handlePrevious so every view mode (month,
// week, day, agenda) behaves the same as the header arrows and arrow keys.
const calendarBody = ref<HTMLElement | null>(null);

useSwipe(calendarBody, {
  threshold: 60,
  onSwipeEnd(_e, direction) {
    // Ignore up/down so vertical scrolling in week/day/agenda still works.
    if (direction === "left") {
      handleNext();
    }
    else if (direction === "right") {
      handlePrevious();
    }
  },
});

// Pinch to zoom between views, ordered least to most detailed. Spreading two
// fingers drills in (month -> week -> day -> agenda); pinching backs out.
// useSwipe ignores anything but a single touch, so this never fights the
// horizontal swipe navigation above.
const ZOOM_VIEWS: CalendarView[] = ["month", "week", "day", "agenda"];

// Ratio the finger gap must cross before a zoom fires. Deliberately coarse so
// a slightly uneven two-finger drag doesn't change the view by accident.
const PINCH_IN_RATIO = 1.3;
const PINCH_OUT_RATIO = 0.77;

let pinchStartGap = 0;
// Latched for the duration of one gesture, so a single pinch moves exactly one
// level instead of racing through every view as touchmove keeps firing.
let pinchHandled = false;

function touchGap(touches: TouchList): number {
  const [a, b] = [touches[0], touches[1]];
  if (!a || !b) {
    return 0;
  }
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function stepZoom(step: number) {
  const current = ZOOM_VIEWS.indexOf(view.value);
  if (current === -1) {
    return;
  }
  const target = ZOOM_VIEWS[Math.min(ZOOM_VIEWS.length - 1, Math.max(0, current + step))];
  if (target && target !== view.value) {
    view.value = target;
    emit("viewChange", target);
  }
}

useEventListener(calendarBody, "touchstart", (e: TouchEvent) => {
  if (e.touches.length !== 2) {
    return;
  }
  // Non-passive so preventDefault actually suppresses Silk's page zoom.
  e.preventDefault();
  pinchStartGap = touchGap(e.touches);
  pinchHandled = false;
}, { passive: false });

useEventListener(calendarBody, "touchmove", (e: TouchEvent) => {
  if (e.touches.length !== 2) {
    return;
  }
  // Keep suppressing page zoom for the whole gesture, even after we've acted.
  e.preventDefault();
  if (pinchHandled || !pinchStartGap) {
    return;
  }
  const ratio = touchGap(e.touches) / pinchStartGap;
  if (ratio >= PINCH_IN_RATIO) {
    stepZoom(1);
    pinchHandled = true;
  }
  else if (ratio <= PINCH_OUT_RATIO) {
    stepZoom(-1);
    pinchHandled = true;
  }
}, { passive: false });

useEventListener(calendarBody, "touchend", (e: TouchEvent) => {
  if (e.touches.length < 2) {
    pinchStartGap = 0;
  }
}, { passive: true });

function handleToday() {
  currentDate.value = getStableDate();

  nextTick(() => {
    scrollToDate(getStableDate(), view.value);
  });
}

function getDayString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

const lastDay = ref(getDayString(getStableDate()));
let dayChangeTimeout: ReturnType<typeof setTimeout> | null = null;

watch(stableDate, (newDate) => {
  const newDay = getDayString(newDate);
  if (newDay !== lastDay.value) {
    lastDay.value = newDay;

    if (dayChangeTimeout) {
      clearTimeout(dayChangeTimeout);
    }

    dayChangeTimeout = setTimeout(() => {
      handleToday();
      dayChangeTimeout = null;
    }, 1000);
  }
});

onUnmounted(() => {
  if (dayChangeTimeout) {
    clearTimeout(dayChangeTimeout);
  }
});

function handleEventSelect(event: CalendarEvent) {
  selectedEvent.value = event;
  isEventDialogOpen.value = true;
}

function handleEventCreate(date: Date) {
  selectedEvent.value = {
    id: "",
    title: "",
    description: "",
    start: date,
    end: addDays(date, 1),
    allDay: false,
    color: DEFAULT_LOCAL_EVENT_COLOR,
  };
  isEventDialogOpen.value = true;
}

function handleEventSave(event: CalendarEvent) {
  if (event.id) {
    emit("eventUpdate", event);
  }
  else {
    emit("eventAdd", event);
  }
  isEventDialogOpen.value = false;
  selectedEvent.value = null;
}

function handleEventDelete(eventId: string) {
  emit("eventDelete", eventId);
  isEventDialogOpen.value = false;
  selectedEvent.value = null;
}

function handleCreateEvent() {
  handleEventCreate(getStableDate());
}

const isCurrentMonth = computed(() => {
  return isSameMonth(currentDate.value, getStableDate());
});

const filteredEvents = computed(() => {
  if (!props.events)
    return [];

  const now = currentDate.value;
  let start: Date;
  let end: Date;
  let events: CalendarEvent[];

  switch (view.value) {
    case "month": {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setDate(start.getDate() - 7);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      end.setDate(end.getDate() + 7);
      events = getEventsForDateRange(start, end);
      break;
    }
    case "week": {
      const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayOfWeek = sunday.getDay();
      sunday.setDate(sunday.getDate() - dayOfWeek);
      const saturday = new Date(sunday.getTime());
      saturday.setDate(saturday.getDate() + 7);
      start = sunday;
      end = saturday;
      events = getEventsForDateRange(start, end);
      break;
    }
    case "day": {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      events = getEventsForDateRange(start, end);
      break;
    }
    case "agenda": {
      start = addDays(now, -15);
      end = addDays(now, 15);
      events = getEventsForDateRange(start, end);
      break;
    }
    default:
      events = props.events;
      start = new Date();
      end = new Date();
  }

  return events;
});

function getWeeksForMonth(date: Date) {
  const { getLocalMonthWeeks } = useCalendar();
  return getLocalMonthWeeks(date);
}

function getDaysForAgenda(date: Date) {
  const { getLocalAgendaDays } = useCalendar();
  return getLocalAgendaDays(date);
}
</script>

<template>
  <div class="flex h-[calc(100vh-2rem)] w-full flex-col rounded-lg">
    <div
      class="py-5 sm:px-4 sticky top-0 z-40 bg-default border-b border-default"
    >
      <GlobalDateHeader
        :show-navigation="true"
        :show-view-selector="true"
        :current-date="currentDate"
        :view="view"
        @previous="handlePrevious"
        @next="handleNext"
        @today="handleToday"
        @view-change="(newView) => { view = newView; emit('viewChange', newView); }"
        @date-change="(newDate) => (currentDate = newDate)"
      />
    </div>
    <div
      ref="calendarBody"
      class="flex flex-1 flex-col min-h-0 touch-pan-y"
    >
      <GlobalMonthView
        v-if="view === 'month'"
        :weeks="getWeeksForMonth(currentDate)"
        :events="filteredEvents"
        :is-current-month="isCurrentMonth"
        cell-id="month-cell"
        @event-click="handleEventSelect"
        @event-create="handleEventCreate"
      />
      <GlobalWeekView
        v-if="view === 'week'"
        :start-date="currentDate"
        :events="filteredEvents"
        @event-click="handleEventSelect"
        @event-create="handleEventCreate"
      />
      <GlobalDayView
        v-if="view === 'day'"
        :current-date="currentDate"
        :events="filteredEvents"
        :show-all-day-section="true"
        @event-click="handleEventSelect"
        @event-create="handleEventCreate"
        @date-select="(date) => (currentDate = date)"
      />
      <GlobalAgendaView
        v-if="view === 'agenda'"
        :days="getDaysForAgenda(currentDate)"
        :events="filteredEvents"
        @event-click="handleEventSelect"
      />
    </div>
  </div>
  <GlobalFloatingActionButton
    icon="i-lucide-plus"
    label="Add new event"
    color="primary"
    size="lg"
    position="bottom-right"
    @click="handleCreateEvent"
  />
  <CalendarEventDialog
    :event="selectedEvent"
    :is-open="isEventDialogOpen"
    :integrations="
      calendarIntegrations && calendarIntegrations.length > 0
        ? (calendarIntegrations as Integration[])
        : undefined
    "
    :integration-capabilities="
      selectedEvent && props.getIntegrationCapabilities
        ? props.getIntegrationCapabilities(selectedEvent)?.capabilities
        : undefined
    "
    :integration-service-name="
      selectedEvent && props.getIntegrationCapabilities
        ? props.getIntegrationCapabilities(selectedEvent)?.serviceName
        : undefined
    "
    @close="isEventDialogOpen = false"
    @save="handleEventSave"
    @delete="handleEventDelete"
  />
</template>
