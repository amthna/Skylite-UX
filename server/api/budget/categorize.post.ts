import { consola } from "consola";
import { createError, defineEventHandler, readBody } from "h3";

/**
 * Assign a category to one transaction.
 *
 * Kept to a single transaction per call on purpose: the register is a
 * tap-one-at-a-time surface, and a partial failure in a batch would leave
 * the caller unsure which taps landed.
 */

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const baseUrl = String(config.budgetApiUrl ?? "").replace(/\/$/, "");
  const apiKey = String(config.budgetApiKey ?? "");
  const syncId = String(config.budgetSyncId ?? "");

  if (!baseUrl || !apiKey || !syncId) {
    throw createError({ statusCode: 503, message: "Budget API is not configured" });
  }

  const body = await readBody<{ transactionId?: string; categoryId?: string }>(event);
  const transactionId = body?.transactionId;
  const categoryId = body?.categoryId;

  if (!transactionId || !categoryId) {
    throw createError({
      statusCode: 400,
      message: "transactionId and categoryId are both required",
    });
  }

  try {
    await $fetch(
      `${baseUrl}/v1/budgets/${syncId}/transactions/${transactionId}`,
      {
        method: "PATCH",
        headers: { "x-api-key": apiKey },
        body: { transaction: { category: categoryId } },
      },
    );
    return { ok: true, transactionId, categoryId };
  }
  catch (error) {
    consola.error("Budget categorize: failed to update transaction:", error);
    throw createError({
      statusCode: 502,
      message: `Failed to update the transaction: ${error}`,
    });
  }
});
