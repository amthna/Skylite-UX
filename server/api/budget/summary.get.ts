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

/** Actual stores money in cents; negative `spent` means money went out. */
function centsSpent(month: ActualMonth, categoryName: string): number | null {
  const groups = month?.data?.categoryGroups ?? [];
  for (const group of groups) {
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
  const categoryName = config.public.budgetCategory as string;

  if (!baseUrl || !apiKey || !syncId) {
    throw createError({
      statusCode: 503,
      message: "Budget API is not configured",
    });
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
    // Sequential rather than parallel: the wrapper opens the budget file per
    // request, and hammering it with concurrent calls is slower, not faster.
    const current = await fetchMonth(thisMonth);
    const previous = await fetchMonth(lastMonth);

    const spentThisMonth = centsSpent(current, categoryName);
    const spentLastMonth = centsSpent(previous, categoryName);

    if (spentThisMonth === null) {
      throw createError({
        statusCode: 404,
        message: `Category "${categoryName}" not found in the current budget month`,
      });
    }

    // Days elapsed including today, so the average reflects a day in progress
    // rather than dividing by a day that hasn't happened yet.
    const daysElapsed = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const perDay = Math.round(spentThisMonth / daysElapsed);

    return {
      category: categoryName,
      month: thisMonth,
      spentThisMonth,
      spentLastMonth,
      perDay,
      daysElapsed,
      daysInMonth,
      // Naive run-rate: today's pace held for the rest of the month.
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
