import type { DiscoverResponse } from "~/composables/useDiscoverEvents";

/**
 * Loads the films and live-music feed exactly once, into shared state.
 *
 * Call this from the page only. Keeping the fetch here rather than in
 * useDiscoverEvents() is what stops a second component's use of that
 * composable from re-registering the same asyncData key and blanking the
 * data everything else is reading.
 */
export function useDiscoverFeed() {
  const feed = useState<DiscoverResponse | null>("discover-feed", () => null);

  const { data, refresh, status } = useFetch<DiscoverResponse>(
    "/api/discover/events",
    { key: "discover-feed-fetch" },
  );

  watchEffect(() => {
    if (data.value)
      feed.value = data.value;
  });

  return { feed, refresh, status };
}
