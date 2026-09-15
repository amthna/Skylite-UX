import type { CalendarEvent } from "~/types/calendar";
import type { DiscoverCategory, DiscoverEvent } from "~/utils/discoverEvents";

import { toCalendarEvent } from "~/utils/discoverEvents";

type DiscoverResponse = {
  events: DiscoverEvent[];
  generated: { films: string | null; concerts: string | null };
  failed: string[];
};

/**
 * Films and concerts as calendar events.
 *
 * They are merged into the same stream the pane already draws rather than
 * given their own view, because the pills are meant to filter the calendar
 * the user is already looking at.
 */
export function useDiscoverEvents() {
  const active = useState<DiscoverCategory[]>("discover-active", () => []);

  const { data, refresh, status } = useFetch<DiscoverResponse>(
    "/api/discover/events",
    { key: "discover-events", default: () => ({
      events: [],
      generated: { films: null, concerts: null },
      failed: [],
    }) },
  );

  const discoverEvents = computed<CalendarEvent[]>(() =>
    (data.value?.events || [])
      .filter(e => active.value.includes(e.category))
      .map(toCalendarEvent),
  );

  const counts = computed(() => {
    const all = data.value?.events || [];
    return {
      "film": all.filter(e => e.category === "film").length,
      "live-music": all.filter(e => e.category === "live-music").length,
    };
  });

  function toggle(category: DiscoverCategory) {
    active.value = active.value.includes(category)
      ? active.value.filter(c => c !== category)
      : [...active.value, category];
  }

  const isActive = (category: DiscoverCategory) =>
    active.value.includes(category);

  // With a pill on, the calendar shows that category alone -- the point is
  // "what films are coming", not "my week plus films".
  const isFiltering = computed(() => active.value.length > 0);

  return {
    active,
    discoverEvents,
    counts,
    toggle,
    isActive,
    isFiltering,
    failed: computed(() => data.value?.failed || []),
    generated: computed(() => data.value?.generated),
    status,
    refresh,
  };
}
