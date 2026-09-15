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
    color: DISCOVER_COLORS[e.category],
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
