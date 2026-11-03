import { consola } from "consola";
import { createError, defineEventHandler } from "h3";

/**
 * Food spending for the week and the month, with the charges behind each total.
 *
 * Two layers over the same rows: the week is the one a trip to the shop is
 * judged against (a flat cap, Sunday to Saturday), and the month is what the
 * budget itself allows. Each carries its grocery and dining-out split, so the
 * bar can show where the money went and the list can say what it bought.
 *
 * Deliberately its own endpoint, like trips: it walks every account's
 * transactions, and the headline numbers should not wait for it.
 */

type Account = { id: string; name: string; closed?: boolean; offbudget?: boolean };
type Category = { id: string; name: string };
type Txn = {
  date: string;
  amount: number;
  category?: string | null;
  transfer_id?: string | null;
  payee_name?: string | null;
  notes?: string | null;
};
type ActualMonth = {
  data?: { categoryGroups?: { categories?: { name: string; budgeted: number }[] }[] };
};

export type Bucket = "grocery" | "dining";
export type SpendRow = { date: string; label: string; bucket: Bucket; amount: number };

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthKey(d: Date): string {
  return isoDay(d).slice(0, 7);
}

function budgetedFor(month: ActualMonth, name: string): number {
  for (const group of month?.data?.categoryGroups ?? []) {
    for (const category of group.categories ?? []) {
      if (category.name.toLowerCase() === name.toLowerCase())
        return Math.max(category.budgeted ?? 0, 0) / 100;
    }
  }
  return 0;
}

export default defineEventHandler(async () => {
  const config = useRuntimeConfig();
  const baseUrl = String(config.budgetApiUrl ?? "").replace(/\/$/, "");
  const apiKey = config.budgetApiKey as string;
  const syncId = config.budgetSyncId as string;
  const groceryName = String(config.public.budgetGroceryCategory ?? "Grocery").trim();
  const diningName = String(config.public.budgetDiningCategory ?? "Eating out").trim();
  const weeklyCap = Number(config.public.budgetWeeklyCap ?? 0);

  if (!baseUrl || !apiKey || !syncId)
    throw createError({ statusCode: 503, message: "Budget API is not configured" });

  async function api<T>(path: string): Promise<T> {
    return await $fetch<T>(`${baseUrl}/v1/budgets/${syncId}${path}`, { headers: { "x-api-key": apiKey } });
  }

  try {
    const cats = await api<{ data?: Category[] }>("/categories");
    const byName = (name: string) =>
      (cats.data ?? []).find(c => c.name.toLowerCase() === name.toLowerCase());
    const groceryId = byName(groceryName)?.id;
    const diningId = byName(diningName)?.id;
    if (!groceryId || !diningId) {
      throw createError({
        statusCode: 404,
        message: `Missing budget categories: ${[!groceryId && groceryName, !diningId && diningName].filter(Boolean).join(", ")}`,
      });
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    // Sunday start, so the week resets on a day people notice.
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);

    // The month's budgeted amounts are the monthly cap, so the budget and this
    // view can never disagree about what the month allows.
    const current = await api<ActualMonth>(`/months/${monthKey(now)}`);
    const monthCap = budgetedFor(current, groceryName) + budgetedFor(current, diningName);

    const accounts = await api<{ data?: Account[] }>("/accounts");
    const open = (accounts.data ?? []).filter(a => !a.closed && !a.offbudget);

    const rows: SpendRow[] = [];
    for (const acct of open) {
      let txns: Txn[] = [];
      try {
        const res = await api<{ data?: Txn[] }>(
          `/accounts/${acct.id}/transactions?since_date=${isoDay(monthStart)}`,
        );
        txns = res.data ?? [];
      }
      catch (err) {
        consola.debug(`Budget spending: could not read ${acct.name}`, err);
        continue;
      }
      for (const t of txns) {
        if (t.transfer_id)
          continue;
        const bucket: Bucket | null = t.category === groceryId
          ? "grocery"
          : t.category === diningId ? "dining" : null;
        if (!bucket)
          continue;
        rows.push({
          date: t.date,
          // The merchant is often only in notes, as the register already found.
          label: (t.payee_name || t.notes || "Unknown").trim(),
          bucket,
          // Spend is positive here; a refund comes through as a negative.
          amount: -t.amount / 100,
        });
      }
    }
    rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

    const weekFirst = isoDay(weekStart);
    const weekRows = rows.filter(r => r.date >= weekFirst);
    const sum = (list: SpendRow[], bucket: Bucket) =>
      list.filter(r => r.bucket === bucket).reduce((s, r) => s + r.amount, 0);

    return {
      week: {
        start: weekFirst,
        end: isoDay(weekEnd),
        // Days of the week that have begun, today included.
        daysElapsed: now.getDay() + 1,
        cap: weeklyCap,
        grocery: sum(weekRows, "grocery"),
        dining: sum(weekRows, "dining"),
        rows: weekRows,
      },
      month: {
        label: monthKey(now),
        daysElapsed: now.getDate(),
        daysInMonth: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
        cap: monthCap,
        grocery: sum(rows, "grocery"),
        dining: sum(rows, "dining"),
        rows,
      },
    };
  }
  catch (error) {
    if (typeof error === "object" && error && "statusCode" in error)
      throw error;
    consola.error("Budget spending: failed to fetch:", error);
    throw createError({ statusCode: 502, message: `Failed to reach the budget API: ${error}` });
  }
});
