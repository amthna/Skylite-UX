import type { CalendarEvent } from "~/types/calendar";

export type DiscoverCategory = "film" | "live-music";

type DiscoverEvent = {
  id: string;
  title: string;
  date: string;
  time?: string;
  venue?: string;
  link?: string;
  note?: string;
  category: DiscoverCategory;
  kind?: string;
};

type DiscoverResponse = {
  events: DiscoverEvent[];
  generated: { films: string | null; concerts: string | null };
  failed: string[];
};

const COLORS: Record<DiscoverCategory, string> = {
  "film": "#7a4bd0",
  "live-music": "#0d7d72",
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

  function toCalendarEvent(e: DiscoverEvent): CalendarEvent {
    // A showtime becomes a one-hour block; a release date with no time is
    // an all-day marker, which is what a premiere actually is.
    const hasTime = Boolean(e.time);
    const start = new Date(`${e.date}T${e.time || "00:00"}:00`);
    const end = new Date(start.getTime() + (hasTime ? 60 : 0) * 60 * 1000);
    return {
      id: `discover-${e.id}`,
      title: e.venue && e.category === "live-music"
        ? `${e.title} — ${e.venue}`
        : e.title,
      description: [e.venue, e.note].filter(Boolean).join(" · "),
      start,
      end,
      allDay: !hasTime,
      color: COLORS[e.category],
      location: e.venue,
      category: e.category,
      venue: e.venue,
      link: e.link,
    };
  }

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
