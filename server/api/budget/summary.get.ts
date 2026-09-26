import { consola } from "consola";
import { createError, defineEventHandler } from "h3";

type ActualCategory = {
  name: string;
  budgeted: number;
  spent: number;
  balance: number;
};

type ActualMonth = {
  data?: {
    categoryGroups?: { categories?: ActualCategory[] }[];
  };
};

type ActualAccount = { id: string; name: string; closed?: boolean };

/**
 * Actual stores money in cents, with `spent` negative for money going out.
 * `budgeted` is positive.
 */
function findCategory(month: ActualMonth, name: string): ActualCategory | null {
  for (const group of month?.data?.categoryGroups ?? []) {
    for (const category of group.categories ?? []) {
      if (category.name.toLowerCase() === name.toLowerCase())
        return category;
    }
  }
  return null;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default defineEventHandler(async () => {
  const config = useRuntimeConfig();
  const baseUrl = String(config.budgetApiUrl ?? "").replace(/\/$/, "");
  const apiKey = config.budgetApiKey as string;
  const syncId = config.budgetSyncId as string;

  // Comma-separated, so the tracked categories are deployment config rather
  // than something baked into the build.
  const categoryNames = String(config.public.budgetCategory ?? "")
    .split(",")
    .map(name => name.trim())
    .filter(Boolean);

  if (!baseUrl || !apiKey || !syncId || categoryNames.length === 0)
    throw createError({ statusCode: 503, message: "Budget API is not configured" });

  const now = new Date();
  const thisMonth = monthKey(now);

  async function api<T>(path: string): Promise<T> {
    return await $fetch<T>(`${baseUrl}/v1/budgets/${syncId}${path}`, { headers: { "x-api-key": apiKey } });
  }

  try {
    // Sequential: the wrapper opens the budget file per request, so concurrent
    // calls are slower rather than faster.
    const current = await api<ActualMonth>(`/months/${thisMonth}`);

    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    // Includes today, so an average reflects a day in progress rather than
    // dividing by one that has not happened.
    const daysElapsed = now.getDate();
    const daysLeft = Math.max(daysInMonth - daysElapsed, 0);
    // Where the calendar says we should be by now, if spending were even.
    const monthProgress = daysElapsed / daysInMonth;

    const categories = categoryNames.map((name) => {
      const found = findCategory(current, name);
      const budgeted = Math.max(found?.budgeted ?? 0, 0);
      const spent = Math.abs(found?.spent ?? 0);
      const remaining = budgeted - spent;
      return {
        name,
        found: found !== null,
        budgeted,
        spent,
        remaining,
        // <1 is ahead of the game, >1 means spending faster than the month
        // is passing. Null when nothing is budgeted, because then there is
        // no pace to be ahead or behind of.
        pace: budgeted > 0 ? (spent / budgeted) / monthProgress : null,
        // What is left, spread over the days that remain.
        perDayLeft: daysLeft > 0 ? Math.round(remaining / daysLeft) : remaining,
      };
    });

    const missing = categories.filter(c => !c.found).map(c => c.name);
    if (missing.length === categories.length) {
      throw createError({
        statusCode: 404,
        message: `No matching categories in the current budget month: ${missing.join(", ")}`,
      });
    }

    const budgeted = categories.reduce((sum, c) => sum + c.budgeted, 0);
    const spent = categories.reduce((sum, c) => sum + c.spent, 0);
    const remaining = budgeted - spent;

    // The loan is its own off-budget account, so it counts down on its own as
    // payments land. Absent is fine -- the panel simply does not render.
    let loan: { name: string; balance: number; original: number; paid: number } | null = null;
    try {
      const accounts = await api<{ data?: ActualAccount[] }>("/accounts");
      const match = (accounts.data ?? []).find(acc =>
        !acc.closed && /loan|parents/i.test(acc.name ?? ""));
      if (match) {
        const bal = await api<{ data?: number }>(`/accounts/${match.id}/balance`);
        const original = Number(config.public.budgetLoanOriginal ?? 0) * 100;
        const balance = Math.abs(bal.data ?? 0);
        loan = { name: match.name, balance, original, paid: original > 0 ? Math.max(original - balance, 0) : 0 };
      }
    }
    catch (err) {
      // A missing loan account must not take the whole dashboard down.
      consola.debug("Budget summary: no loan account", err);
    }

    return {
      month: thisMonth,
      categories,
      missing,
      budgeted,
      spent,
      remaining,
      daysElapsed,
      daysInMonth,
      daysLeft,
      monthProgress,
      pace: budgeted > 0 ? (spent / budgeted) / monthProgress : null,
      perDayLeft: daysLeft > 0 ? Math.round(remaining / daysLeft) : remaining,
      loan,
    };
  }
  catch (error) {
    consola.error("Budget summary: failed to fetch from the budget API:", error);
    throw createError({
      statusCode: 502,
      message: `Failed to reach the budget API: ${error}`,
    });
  }
});
