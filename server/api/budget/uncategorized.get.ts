import { consola } from "consola";
import { createError, defineEventHandler, getQuery } from "h3";

/**
 * Transactions that still need a category.
 *
 * Deliberately excludes two things that look uncategorised but are not:
 * transfers between accounts, which correctly carry no category, and the
 * parent row of a split, whose children hold the real categories. Without
 * that filter this list is mostly noise -- of 128 uncategorised rows in
 * this budget, 54 were already-linked transfers.
 */

type ActualTransaction = {
  id: string;
  date: string;
  amount: number;
  payee: string | null;
  imported_payee: string | null;
  category: string | null;
  account: string | null;
  transfer_id: string | null;
  is_parent: boolean | null;
  is_child: boolean | null;
  notes: string | null;
};

type Named = { id: string; name: string; offbudget?: boolean; closed?: boolean };

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const baseUrl = String(config.budgetApiUrl ?? "").replace(/\/$/, "");
  const apiKey = String(config.budgetApiKey ?? "");
  const syncId = String(config.budgetSyncId ?? "");

  if (!baseUrl || !apiKey || !syncId) {
    throw createError({ statusCode: 503, message: "Budget API is not configured" });
  }

  const query = getQuery(event);
  const limit = Math.min(Number(query.limit ?? 60) || 60, 200);

  const base = `${baseUrl}/v1/budgets/${syncId}`;
  const headers = { "x-api-key": apiKey };

  try {
    // Sequential, matching summary.get.ts: the wrapper opens the budget file
    // per request, so concurrent calls are slower rather than faster.
    const result = await $fetch<{ data: ActualTransaction[] }>(`${base}/run-query`, {
      method: "POST",
      headers,
      body: {
        ActualQLquery: {
          table: "transactions",
          filter: {},
          select: [
            "id",
            "date",
            "amount",
            "payee",
            "imported_payee",
            "category",
            "account",
            "transfer_id",
            "is_parent",
            "is_child",
            "notes",
          ],
          limit: 5000,
        },
      },
    });

    const payees = await $fetch<{ data: Named[] }>(`${base}/payees`, { headers });
    const accounts = await $fetch<{ data: Named[] }>(`${base}/accounts`, { headers });

    const payeeName = new Map(payees.data.map(p => [p.id, p.name]));
    const accountName = new Map(accounts.data.map(a => [a.id, a.name]));
    // An off-budget account is tracked, not budgeted, so its rows never need
    // a category -- the family loan's opening balance was sitting in this
    // list as a -$14,500 item nobody could do anything about.
    const offBudget = new Set(
      accounts.data.filter(a => a.offbudget).map(a => a.id),
    );

    const needsCategory = (result.data ?? [])
      .filter(t => !t.category)
      .filter(t => !t.transfer_id) // a transfer has no category by design
      .filter(t => !t.is_parent) // the split's children carry the categories
      .filter(t => !offBudget.has(t.account ?? "")) // tracked, not budgeted
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
      .slice(0, limit)
      .map(t => ({
        id: t.id,
        date: t.date,
        amount: t.amount,
        // imported_payee is the raw bank string and is the more recognisable
        // of the two when a payee has been renamed to something tidy.
        vendor: t.imported_payee || payeeName.get(t.payee ?? "") || "Unknown",
        account: accountName.get(t.account ?? "") ?? "",
        notes: t.notes ?? "",
      }));

    return { transactions: needsCategory, total: needsCategory.length };
  }
  catch (error) {
    consola.error("Budget uncategorized: failed to fetch:", error);
    throw createError({
      statusCode: 502,
      message: `Failed to reach the budget API: ${error}`,
    });
  }
});
