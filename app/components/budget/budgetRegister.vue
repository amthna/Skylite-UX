<script setup lang="ts">
type PendingTransaction = {
  id: string;
  date: string;
  amount: number;
  vendor: string;
  account: string;
  notes: string;
};

type Category = { id: string; name: string };

const { data, error, refresh, status } = await useFetch<{
  transactions: PendingTransaction[];
  total: number;
}>("/api/budget/uncategorized", { lazy: true, server: false });

const { data: categories } = await useFetch<{
  quick: Category[];
  all: Category[];
  missing: string[];
}>("/api/budget/categories", { lazy: true, server: false });

// Rows are removed the moment a category is chosen rather than waiting for a
// refetch, because on a touch display the delay reads as a missed tap. A
// failure puts the row back and says so.
const settled = ref(new Set<string>());
const working = ref<string | null>(null);
const failure = ref<string | null>(null);

// Which row has its full category list open. Only one at a time: the list is
// long and two open at once makes the register unreadable.
const expanded = ref<string | null>(null);

const pending = computed(() =>
  (data.value?.transactions ?? []).filter(t => !settled.value.has(t.id)),
);

/** Actual stores cents, and spending is negative. Show the magnitude. */
function dollars(cents: number): string {
  return `$${Math.abs(cents / 100).toFixed(2)}`;
}

function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

async function assign(transaction: PendingTransaction, category: Category) {
  working.value = transaction.id;
  failure.value = null;
  try {
    await $fetch("/api/budget/categorize", {
      method: "POST",
      body: { transactionId: transaction.id, categoryId: category.id },
    });
    settled.value = new Set([...settled.value, transaction.id]);
    expanded.value = null;
  }
  catch (e) {
    failure.value = `Could not file ${transaction.vendor}: ${e}`;
  }
  finally {
    working.value = null;
  }
}

async function reload() {
  settled.value = new Set();
  expanded.value = null;
  failure.value = null;
  await refresh();
}
</script>

<template>
  <div class="flex flex-1 flex-col min-h-0 p-6">
    <div v-if="error" class="flex flex-1 flex-col items-center justify-center gap-2 text-dimmed">
      <UIcon name="i-lucide-plug-zap" class="w-8 h-8" />
      <p class="text-lg">
        Can't reach the budget
      </p>
      <p class="text-sm">
        {{ error.data?.message || error.message }}
      </p>
    </div>

    <div
      v-else-if="status === 'pending' && !data"
      class="flex flex-1 items-center justify-center text-dimmed text-lg"
    >
      Loading transactions...
    </div>

    <!-- The good case: nothing to do. Worth saying plainly rather than
         showing an empty list that looks like a loading failure. -->
    <div
      v-else-if="!pending.length"
      class="flex flex-1 flex-col items-center justify-center gap-3 text-dimmed"
    >
      <UIcon name="i-lucide-check-circle-2" class="w-10 h-10 text-(--ui-success)" />
      <p class="text-lg">
        Everything's categorized
      </p>
      <UButton
        variant="ghost"
        size="sm"
        icon="i-lucide-refresh-cw"
        @click="reload"
      >
        Check again
      </UButton>
    </div>

    <div v-else class="flex flex-1 flex-col min-h-0 gap-3">
      <div class="flex items-center justify-between shrink-0">
        <p class="text-md text-muted">
          {{ pending.length }} to categorize
        </p>
        <UButton
          variant="ghost"
          size="sm"
          icon="i-lucide-refresh-cw"
          @click="reload"
        >
          Refresh
        </UButton>
      </div>

      <p v-if="failure" class="shrink-0 text-sm text-(--ui-error)">
        {{ failure }}
      </p>

      <div class="flex flex-col gap-3 overflow-y-auto pr-1">
        <div
          v-for="transaction in pending"
          :key="transaction.id"
          class="flex flex-col gap-2 rounded-lg border border-default bg-elevated/40 p-3"
          :class="working === transaction.id ? 'opacity-50' : ''"
        >
          <div class="flex items-baseline justify-between gap-3">
            <div class="flex min-w-0 flex-col">
              <span class="truncate text-lg font-medium">{{ transaction.vendor }}</span>
              <span class="text-sm text-dimmed">
                {{ dayLabel(transaction.date) }}
                <template v-if="transaction.account"> &middot; {{ transaction.account }}</template>
              </span>
            </div>
            <span class="shrink-0 text-xl font-semibold tabular-nums">
              {{ dollars(transaction.amount) }}
            </span>
          </div>

          <!-- Big targets: this is operated by thumb on a wall display. -->
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="category in categories?.quick ?? []"
              :key="category.id"
              size="md"
              variant="soft"
              :disabled="working === transaction.id"
              @click="assign(transaction, category)"
            >
              {{ category.name }}
            </UButton>
            <UButton
              size="md"
              variant="ghost"
              icon="i-lucide-ellipsis"
              :disabled="working === transaction.id"
              @click="expanded = expanded === transaction.id ? null : transaction.id"
            >
              More
            </UButton>
          </div>

          <div
            v-if="expanded === transaction.id"
            class="flex flex-wrap gap-2 border-t border-default pt-2"
          >
            <UButton
              v-for="category in categories?.all ?? []"
              :key="category.id"
              size="sm"
              variant="outline"
              :disabled="working === transaction.id"
              @click="assign(transaction, category)"
            >
              {{ category.name }}
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
