import { describe, expect, it } from "vitest";

import { eventsInRange, toCalendarEvent } from "~/utils/discoverEvents";

/**
 * The buttons worked and the calendar stayed empty. The composable is
 * fine, so this covers the step after it: whether a discover event
 * survives the helpers the views use to place it on a day.
 */
describe("a discover event through the calendar's own day helpers", () => {
  const showtime = toCalendarEvent({
    id: "t1",
    title: "It Happened One Night in 35mm",
    date: "2026-09-15",
    time: "19:00",
    venue: "Trylon Cinema",
    category: "film",
  });
  const premiere = toCalendarEvent({
    id: "p1",
    title: "Resident Evil",
    date: "2026-09-18",
    venue: "US theatrical release",
    category: "film",
  });

  it("survives the week-view range the main view computes", () => {
    // Week of Sun 2026-09-13 .. Sun 2026-09-20, as calendarMainView builds it.
    const sunday = new Date(2026, 8, 13);
    const end = new Date(sunday.getTime());
    end.setDate(end.getDate() + 7);
    const got = eventsInRange([showtime, premiere], sunday, end);
    expect(got.map(e => e.id)).toEqual(["discover-t1", "discover-p1"]);
  });

  it("lands on its own day via getAllEventsForDay", () => {
    const { getAllEventsForDay } = useCalendar();
    const day = new Date(2026, 8, 15);
    const got = getAllEventsForDay([showtime, premiere], day);
    expect(got.map(e => e.id)).toEqual(["discover-t1"]);
  });

  it("places an all-day premiere on its date", () => {
    const { getAllEventsForDay } = useCalendar();
    const got = getAllEventsForDay([showtime, premiere], new Date(2026, 8, 18));
    expect(got.map(e => e.id)).toEqual(["discover-p1"]);
  });

  it("is not treated as a placeholder and survives sorting", () => {
    const { sortEvents, isPlaceholderEvent } = useCalendar();
    expect(isPlaceholderEvent(showtime)).toBe(false);
    expect(sortEvents([premiere, showtime]).length).toBe(2);
  });
});
