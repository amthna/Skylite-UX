import { consola } from "consola";
import { createError, defineEventHandler } from "h3";

/**
 * Categories available for tagging, with the quick-pick ones first.
 *
 * The register needs two things: a short row of buttons for the handful of
 * categories that cover most discretionary spending, and the full list for
 * everything else. Which ones are "quick" is deployment config rather than
 * something baked in, because it differs per budget.
 */

type ActualCategory = {
  id: string;
  name: string;
  is_income: boolean | null;
  hidden?: boolean | null;
};

export default defineEventHandler(async () => {
  const config = useRuntimeConfig();
  const baseUrl = String(config.budgetApiUrl ?? "").replace(/\/$/, "");
  const apiKey = String(config.budgetApiKey ?? "");
  const syncId = String(config.budgetSyncId ?? "");

  if (!baseUrl || !apiKey || !syncId) {
    throw createError({ statusCode: 503, message: "Budget API is not configured" });
  }

  const quickNames = String(config.public.budgetQuickCategories ?? "")
    .split(",")
    .map(name => name.trim())
    .filter(Boolean);

  try {
    const result = await $fetch<{ data: ActualCategory[] }>(
      `${baseUrl}/v1/budgets/${syncId}/categories`,
      { headers: { "x-api-key": apiKey } },
    );

    const spending = (result.data ?? [])
      .filter(c => !c.is_income && !c.hidden)
      .map(c => ({ id: c.id, name: c.name }));

    // Match on name because the quick list is written by a human in config.
    // An unmatched name is dropped rather than erroring: a renamed category
    // should cost one button, not the whole page.
    const byName = new Map(spending.map(c => [c.name.toLowerCase(), c]));
    const quick = quickNames
      .map(name => byName.get(name.toLowerCase()))
      .filter((c): c is { id: string; name: string } => Boolean(c));

    const missing = quickNames.filter(
      name => !byName.has(name.toLowerCase()),
    );

    return { quick, all: spending, missing };
  }
  catch (error) {
    consola.error("Budget categories: failed to fetch:", error);
    throw createError({
      statusCode: 502,
      message: `Failed to reach the budget API: ${error}`,
    });
  }
});
