import type { CalendarEvent } from "~/types/calendar";
import type { DiscoverCategory, DiscoverEvent } from "~/utils/discoverEvents";

import { toCalendarEvent } from "~/utils/discoverEvents";

export type DiscoverResponse = {
  events: DiscoverEvent[];
  generated: { films: string | null; concerts: string | null };
  failed: string[];
};

/**
 * Which categories are showing, and the events for them.
 *
 * Deliberately does no fetching. An earlier version called useFetch here,
 * and because this composable is used in two places -- the page that
 * renders the list and the buttons that toggle it -- that registered the
 * same asyncData key twice. The second registration re-seeds the shared
 * ref from its `default` factory, so the buttons toggled correctly while
 * the list they were driving had been emptied underneath them: the exact
 * "buttons work, calendar stays blank" symptom.
 *
 * The feed is loaded once by useDiscoverFeed() in the page.
 */
export function useDiscoverEvents() {
  const active = useState<DiscoverCategory[]>("discover-active", () => []);
  const feed = useState<DiscoverResponse | null>("discover-feed", () => null);

  const all = computed<DiscoverEvent[]>(() => feed.value?.events || []);

  const discoverEvents = computed<CalendarEvent[]>(() =>
    all.value
      .filter(e => active.value.includes(e.category))
      .map(toCalendarEvent),
  );

  const counts = computed(() => ({
    "film": all.value.filter(e => e.category === "film").length,
    "live-music": all.value.filter(e => e.category === "live-music").length,
  }));

  function toggle(category: DiscoverCategory) {
    active.value = active.value.includes(category)
      ? active.value.filter(c => c !== category)
      : [...active.value, category];
  }

  const isActive = (category: DiscoverCategory) =>
    active.value.includes(category);

  // With a button on, the calendar shows that category alone -- the point
  // is "what films are coming", not "my week plus films".
  const isFiltering = computed(() => active.value.length > 0);

  return {
    active,
    feed,
    discoverEvents,
    counts,
    toggle,
    isActive,
    isFiltering,
    failed: computed(() => feed.value?.failed || []),
    generated: computed(() => feed.value?.generated),
  };
}
