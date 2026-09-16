<script setup lang="ts">
import type { GlobalFloatingActionButtonProps } from "~/types/ui";

const props = withDefaults(defineProps<GlobalFloatingActionButtonProps>(), {
  icon: "i-lucide-plus",
  label: "Add",
  color: "primary",
  size: "lg",
  position: "bottom-right",
  disabled: false,
  // Deliberately no default. Passing an explicit variant to every button
  // would change how the existing ones render, and the only callers that
  // need one are the filter toggles, which set it themselves.
  variant: undefined,
});

const emit = defineEmits<{
  (e: "click"): void;
}>();

const positionClasses = computed(() => {
  const baseClasses
    = "fixed z-50 rounded-full shadow-lg transition-all duration-200 hover:shadow-xl flex items-center justify-center";

  switch (props.position) {
    // Sits one button-height above bottom-right, for a secondary action.
    case "bottom-right-stacked":
      return `${baseClasses} bottom-24 right-6`;
    // Each further step is one button height (3.5rem) plus the same 1rem
    // gap the first two use, so the column stays evenly spaced.
    case "bottom-right-stacked-2":
      return `${baseClasses} bottom-[10.5rem] right-6`;
    case "bottom-right-stacked-3":
      return `${baseClasses} bottom-[15rem] right-6`;
    case "bottom-left":
      return `${baseClasses} bottom-6 left-6`;
    case "top-right":
      return `${baseClasses} top-6 right-6`;
    case "top-left":
      return `${baseClasses} top-6 left-6`;
    case "bottom-right":
    default:
      return `${baseClasses} bottom-6 right-6`;
  }
});

const sizeClasses = computed(() => {
  switch (props.size) {
    case "sm":
      return "h-10 w-10";
    case "md":
      return "h-12 w-12";
    case "lg":
    default:
      return "h-14 w-14";
  }
});

const iconSizeClasses = computed(() => {
  switch (props.size) {
    case "sm":
      return "h-7 w-7";
    case "md":
      return "h-8 w-8";
    case "lg":
    default:
      return "h-9 w-9";
  }
});

function handleClick() {
  if (!props.disabled) {
    emit("click");
  }
}
</script>

<template>
  <UButton
    :class="[positionClasses, sizeClasses]"
    :color="color"
    v-bind="variant ? { variant } : {}"
    :disabled="disabled"
    :aria-label="label"
    class="p-0"
    @click="handleClick"
  >
    <UIcon :name="icon" :class="iconSizeClasses" />
  </UButton>
</template>
