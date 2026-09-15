import { describe, expect, it } from "vitest";

import type { DiscoverResponse } from "~/composables/useDiscoverEvents";

const FEED: DiscoverResponse = {
  events: [
    { id: "t1", title: "It Happened One Night in 35mm", date: "2026-09-15", time: "19:00", venue: "Trylon Cinema", category: "film", kind: "repertory" },
    { id: "m1", title: "Brandon Flowers", date: "2026-09-15", venue: "First Avenue", category: "live-music" },
    { id: "p1", title: "Resident Evil", date: "2026-09-18", venue: "US theatrical release", category: "film", kind: "premiere" },
  ],
  generated: { films: null, concerts: null },
  failed: [],
};

describe("useDiscoverEvents", () => {
  it("shows nothing until a button is on", () => {
    const { feed, discoverEvents, isFiltering } = useDiscoverEvents();
    feed.value = FEED;
    expect(isFiltering.value).toBe(false);
    expect(discoverEvents.value).toHaveLength(0);
  });

  it("emits only the toggled category", () => {
    const { feed, toggle, discoverEvents, isActive } = useDiscoverEvents();
    feed.value = FEED;
    toggle("film");
    expect(isActive("film")).toBe(true);
    expect(discoverEvents.value.map(e => e.title).sort())
      .toEqual(["It Happened One Night in 35mm", "Resident Evil"]);
    toggle("film");
  });

  it("does not fetch, so using it in a second component cannot blank the feed", () => {
    // The regression this pins: useDiscoverEvents used to call useFetch.
    // Used from both the page and the buttons, that registered the same
    // asyncData key twice and the second registration re-seeded the shared
    // ref from its default -- buttons toggled, list went empty.
    const page = useDiscoverEvents();
    page.feed.value = FEED;

    const buttons = useDiscoverEvents();
    buttons.toggle("live-music");

    expect(page.feed.value?.events).toHaveLength(3);
    expect(page.discoverEvents.value.map(e => e.title))
      .toEqual(["Brandon Flowers — First Avenue"]);
    buttons.toggle("live-music");
  });

  it("counts every category regardless of what is toggled", () => {
    const { feed, counts } = useDiscoverEvents();
    feed.value = FEED;
    expect(counts.value.film).toBe(2);
    expect(counts.value["live-music"]).toBe(1);
  });
});
