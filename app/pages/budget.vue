<script setup lang="ts">
// Two views of the same budget: the dashboard is the at-a-glance one a wall
// display sits on, and the register is the one you walk up to and use. They
// are tabs rather than separate routes so the nav entry stays a single
// "Budget" and the display never navigates away from itself.
const tabs = [
  { label: "Dashboard", value: "dashboard", icon: "i-lucide-chart-pie" },
  { label: "To categorize", value: "register", icon: "i-lucide-inbox" },
];

// Landing on the dashboard on purpose: the display's resting state should be
// the ambient view, not a work queue.
const active = ref("dashboard");
</script>

<template>
  <div class="flex h-[calc(100vh-2rem)] w-full flex-col rounded-lg">
    <div class="py-5 sm:px-4 sticky top-0 z-40 bg-default border-b border-default">
      <GlobalDateHeader />
    </div>

    <div class="shrink-0 px-4 pt-3">
      <UTabs
        v-model="active"
        :items="tabs"
        :content="false"
        size="lg"
        class="w-full"
      />
    </div>

    <!-- Both stay mounted: switching tabs should not refetch, and the
         register keeps the rows already dealt with hidden. -->
    <div v-show="active === 'dashboard'" class="flex flex-1 flex-col min-h-0">
      <BudgetDashboard />
    </div>
    <div v-show="active === 'register'" class="flex flex-1 flex-col min-h-0">
      <BudgetRegister />
    </div>
  </div>
</template>
