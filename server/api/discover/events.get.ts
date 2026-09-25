import { consola } from "consola";
import { defineEventHandler, getQuery } from "h3";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Films and live music, for the calendar pane's pills.
 *
 * Both feeds are written on the NAS by scheduled scans and mounted here
 * read-only -- the concert scan every Monday, the film scan on its own
 * cron. This endpoint never fetches anything itself, so a source being
 * down shows as stale data rather than a slow calendar.
 */

export type DiscoverEvent = {
  id: string;
  title: string;
  date: string;
  time?: string;
  venue?: string;
  link?: string;
  note?: string;
  category: "film" | "live-music";
  kind?: string;
  source?: string;
};

type Feed = {
  generated?: string;
  failed?: string[];
  events?: DiscoverEvent[];
};

async function readFeed(dir: string, name: string): Promise<Feed> {
  try {
    const raw = await readFile(join(dir, name), "utf8");
    return JSON.parse(raw) as Feed;
  }
  catch (err) {
    // A missing file is the normal state before a scan has ever run, so it
    // is not worth an error -- the pill simply has nothing to show yet.
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code !== "ENOENT")
      consola.warn(`Discover: could not read ${name}`, err);
    return {};
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const dir = config.discoverDir || "/data/discover";
  const query = getQuery(event);
  const wanted = String(query.category || "").trim();

  const [films, concerts] = await Promise.all([
    readFeed(dir, "films.json"),
    readFeed(dir, "concerts.json"),
  ]);

  let events: DiscoverEvent[] = [
    ...(films.events || []).map(e => ({ ...e, category: "film" as const })),
    ...(concerts.events || []).map(e => ({
      ...e,
      category: "live-music" as const,
    })),
  ];

  if (wanted)
    events = events.filter(e => e.category === wanted);

  // Past events are kept. A calendar is a record as much as a plan, and
  // filtering them here hid showings the scans had actually captured --
  // "what did I miss last week" is a fair thing to ask of it.
  events = events.sort((a, b) =>
    (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));

  return {
    events,
    generated: {
      films: films.generated || null,
      concerts: concerts.generated || null,
    },
    // Surfaced so the UI can say "no TMDB key" rather than silently
    // showing only repertory listings.
    failed: [...(films.failed || []), ...(concerts.failed || [])],
  };
});
