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

/** Actual stores money in cents, with `spent` negative for money going out. */
function centsSpent(month: ActualMonth, categoryName: string): number | null {
  for (const group of month?.data?.categoryGroups ?? []) {
    for (const category of group.categories ?? []) {
      if (category.name.toLowerCase() === categoryName.toLowerCase()) {
        return Math.abs(category.spent ?? 0);
      }
    }
  }
  return null;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default defineEventHandler(async () => {
  const config = useRuntimeConfig();
  const baseUrl = config.budgetApiUrl as string;
  const apiKey = config.budgetApiKey as string;
  const syncId = config.budgetSyncId as string;

  // Comma-separated, so the tracked categories are deployment config rather
  // than something baked into the build.
  const categoryNames = String(config.public.budgetCategory ?? "")
    .split(",")
    .map(name => name.trim())
    .filter(Boolean);

  if (!baseUrl || !apiKey || !syncId || categoryNames.length === 0) {
    throw createError({ statusCode: 503, message: "Budget API is not configured" });
  }

  const now = new Date();
  const thisMonth = monthKey(now);
  const lastMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  async function fetchMonth(month: string): Promise<ActualMonth> {
    return await $fetch<ActualMonth>(
      `${baseUrl.replace(/\/$/, "")}/v1/budgets/${syncId}/months/${month}`,
      { headers: { "x-api-key": apiKey } },
    );
  }

  try {
    // Sequential: the wrapper opens the budget file per request, so concurrent
    // calls are slower rather than faster.
    const current = await fetchMonth(thisMonth);
    const previous = await fetchMonth(lastMonth);

    const categories = categoryNames.map(name => ({
      name,
      spentThisMonth: centsSpent(current, name) ?? 0,
      spentLastMonth: centsSpent(previous, name) ?? 0,
      found: centsSpent(current, name) !== null,
    }));

    const missing = categories.filter(c => !c.found).map(c => c.name);
    if (missing.length === categories.length) {
      throw createError({
        statusCode: 404,
        message: `No matching categories in the current budget month: ${missing.join(", ")}`,
      });
    }

    const spentThisMonth = categories.reduce((sum, c) => sum + c.spentThisMonth, 0);
    const spentLastMonth = categories.reduce((sum, c) => sum + c.spentLastMonth, 0);

    // Days elapsed includes today, so the average reflects a day in progress
    // rather than dividing by one that hasn't happened.
    const daysElapsed = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const perDay = Math.round(spentThisMonth / daysElapsed);

    return {
      categories: categories.map(({ name, spentThisMonth: s, spentLastMonth: l }) => ({
        name,
        spentThisMonth: s,
        spentLastMonth: l,
      })),
      missing,
      month: thisMonth,
      spentThisMonth,
      spentLastMonth,
      perDay,
      daysElapsed,
      daysInMonth,
      // Naive run rate: today's pace held for the rest of the month.
      projected: perDay * daysInMonth,
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
