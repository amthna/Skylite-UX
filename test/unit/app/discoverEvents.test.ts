import { describe, expect, it } from "vitest";

import type { CalendarEvent } from "../../../app/types/calendar";
import type { DiscoverEvent } from "../../../app/utils/discoverEvents";

import { eventsInRange, toCalendarEvent } from "../../../app/utils/discoverEvents";

const showtime: DiscoverEvent = {
  id: "trylon-1",
  title: "It Happened One Night in 35mm",
  date: "2026-09-15",
  time: "19:00",
  venue: "Trylon Cinema",
  category: "film",
  kind: "repertory",
};

const premiere: DiscoverEvent = {
  id: "tmdb-1",
  title: "Resident Evil",
  date: "2026-09-18",
  venue: "US theatrical release",
  category: "film",
  kind: "premiere",
};

const concert: DiscoverEvent = {
  id: "concert-1",
  title: "Brandon Flowers",
  date: "2026-09-15",
  venue: "First Avenue",
  category: "live-music",
};

describe("toCalendarEvent", () => {
  it("turns a showtime into a one-hour block", () => {
    const e = toCalendarEvent(showtime);
    expect(e.allDay).toBe(false);
    expect(e.start.getHours()).toBe(19);
    expect(e.end.getTime() - e.start.getTime()).toBe(60 * 60 * 1000);
  });

  it("turns a release date into an all-day marker", () => {
    const e = toCalendarEvent(premiere);
    expect(e.allDay).toBe(true);
    expect(e.start.getHours()).toBe(0);
  });

  it("names the venue for a concert, where the venue is the point", () => {
    expect(toCalendarEvent(concert).title).toBe("Brandon Flowers — First Avenue");
  });

  it("leaves a film title alone", () => {
    expect(toCalendarEvent(showtime).title).toBe("It Happened One Night in 35mm");
  });

  it("carries the category through, so the view can filter on it", () => {
    expect(toCalendarEvent(concert).category).toBe("live-music");
  });
});

describe("eventsInRange", () => {
  const events: CalendarEvent[] = [showtime, premiere, concert].map(toCalendarEvent);

  it("returns only what overlaps the window", () => {
    const got = eventsInRange(events, new Date("2026-09-15T00:00:00"), new Date("2026-09-16T00:00:00"));
    expect(got.map(e => e.id).sort()).toEqual(["discover-concert-1", "discover-trylon-1"]);
  });

  it("filters the list it is given rather than any other source", () => {
    // The bug this pins: the calendar view asked useCalendar() for the
    // range instead of filtering its own prop, so narrowing the list
    // upstream -- which is exactly what the film and music buttons do --
    // changed nothing on screen.
    const only = [toCalendarEvent(premiere)];
    const got = eventsInRange(only, new Date("2026-09-01T00:00:00"), new Date("2026-09-30T00:00:00"));
    expect(got).toHaveLength(1);
    expect(got[0]!.id).toBe("discover-tmdb-1");
  });

  it("is empty for a window with nothing in it", () => {
    expect(eventsInRange(events, new Date("2026-10-01T00:00:00"), new Date("2026-10-02T00:00:00"))).toHaveLength(0);
  });

  it("handles an undefined list", () => {
    expect(eventsInRange(undefined, new Date(), new Date())).toEqual([]);
  });
});
