import { consola } from "consola";
import { createError, defineEventHandler } from "h3";

/**
 * How many grocery trips this week.
 *
 * The overspend on food is not basket size, it is frequency: 227 shops in
 * seven months, averaging $38 a visit. A running count is something anyone
 * can act on without doing arithmetic in a car park, which a dollar figure
 * is not.
 *
 * Deliberately a separate endpoint from the summary: it walks every
 * account's transactions, and the headline numbers should not wait for it.
 */

type Account = { id: string; name: string; closed?: boolean; offbudget?: boolean };
type Category = { id: string; name: string };
type Txn = { date: string; amount: number; category?: string | null; payee_name?: string | null };

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default defineEventHandler(async () => {
  const config = useRuntimeConfig();
  const baseUrl = String(config.budgetApiUrl ?? "").replace(/\/$/, "");
  const apiKey = config.budgetApiKey as string;
  const syncId = config.budgetSyncId as string;
  const trackedName = String(config.public.budgetTripCategory ?? "Grocery").trim();

  if (!baseUrl || !apiKey || !syncId)
    throw createError({ statusCode: 503, message: "Budget API is not configured" });

  async function api<T>(path: string): Promise<T> {
    return await $fetch<T>(`${baseUrl}/v1/budgets/${syncId}${path}`, { headers: { "x-api-key": apiKey } });
  }

  try {
    const cats = await api<{ data?: Category[] }>("/categories");
    const target = (cats.data ?? []).find(
      c => c.name.toLowerCase() === trackedName.toLowerCase(),
    );
    if (!target)
      return { category: trackedName, thisWeek: 0, usualWeek: 0, found: false };

    const now = new Date();
    // Week starts Sunday, so the count resets on a day people notice.
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    // Four whole weeks back, for a fair "usual" without this week in it.
    const windowStart = new Date(weekStart);
    windowStart.setDate(weekStart.getDate() - 28);

    const accounts = await api<{ data?: Account[] }>("/accounts");
    const open = (accounts.data ?? []).filter(a => !a.closed && !a.offbudget);

    let thisWeek = 0;
    let priorFour = 0;
    const seen = new Set<string>();
    for (const acct of open) {
      let rows: Txn[] = [];
      try {
        const res = await api<{ data?: Txn[] }>(
          `/accounts/${acct.id}/transactions?since_date=${isoDay(windowStart)}`,
        );
        rows = res.data ?? [];
      }
      catch (err) {
        consola.debug(`Budget trips: could not read ${acct.name}`, err);
        continue;
      }
      for (const t of rows) {
        if (t.category !== target.id || t.amount >= 0)
          continue;
        // Two taps at the same shop on the same day is one trip.
        const key = `${t.date}|${(t.payee_name ?? "").toLowerCase()}`;
        if (seen.has(key))
          continue;
        seen.add(key);
        if (t.date >= isoDay(weekStart))
          thisWeek += 1;
        else if (t.date >= isoDay(windowStart))
          priorFour += 1;
      }
    }

    return {
      category: trackedName,
      found: true,
      thisWeek,
      usualWeek: Math.round(priorFour / 4),
      weekStart: isoDay(weekStart),
    };
  }
  catch (error) {
    consola.error("Budget trips: failed to fetch:", error);
    throw createError({ statusCode: 502, message: `Failed to reach the budget API: ${error}` });
  }
});
