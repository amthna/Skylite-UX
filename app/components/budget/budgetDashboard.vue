<template>
  <div class="flex flex-1 flex-col min-h-0 overflow-y-auto p-5">
    <div class="m-auto flex w-full max-w-2xl flex-col gap-7">
      <!-- Client-only: the tracker fetches on mount, and rendering it on the
           server first caused a hydration mismatch that left taps dead. -->
      <ClientOnly>
        <BudgetSpending />
      </ClientOnly>
    </div>
  </div>
</template>
