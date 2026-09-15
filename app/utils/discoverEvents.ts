import type { CalendarEvent } from "~/types/calendar";

export type DiscoverCategory = "film" | "live-music";

export type DiscoverEvent = {
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

export const DISCOVER_COLORS: Record<DiscoverCategory, string> = {
  "film": "#7a4bd0",
  "live-music": "#0d7d72",
};

/**
 * Repertory and premiere are different things on the same row -- a 35mm
 * revival at the Trylon tonight versus a film opening nationally in three
 * weeks -- so they get their own colours rather than sharing the film one.
 */
export const FILM_KIND_COLORS: Record<string, string> = {
  repertory: "#b8562f", // Trylon: warm, like the marquee
  premiere: "#7a4bd0", // new releases: keeps the original film colour
};

export function discoverColor(e: Pick<DiscoverEvent, "category" | "kind">): string {
  if (e.category === "film" && e.kind && FILM_KIND_COLORS[e.kind])
    return FILM_KIND_COLORS[e.kind]!;
  return DISCOVER_COLORS[e.category];
}

/**
 * A feed entry as a calendar event.
 *
 * A showtime becomes a one-hour block; a release date carries no time and
 * becomes an all-day marker, which is what a premiere actually is.
 */
export function toCalendarEvent(e: DiscoverEvent): CalendarEvent {
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
    color: discoverColor(e),
    location: e.venue,
    category: e.category,
    venue: e.venue,
    link: e.link,
  };
}

/**
 * Events overlapping a window.
 *
 * Exists as its own function because the calendar view used to ask
 * useCalendar() for this instead of filtering the list it was handed,
 * which silently ignored any narrowing the page had done.
 */
export function eventsInRange(
  events: CalendarEvent[] | undefined,
  from: Date,
  to: Date,
): CalendarEvent[] {
  return (events || []).filter((event) => {
    const start = new Date(event.start);
    const end = new Date(event.end);
    return start <= to && end >= from;
  });
}
