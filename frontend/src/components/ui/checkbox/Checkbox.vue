<script setup lang="ts">
import { CheckboxRoot, CheckboxIndicator, type CheckboxRootProps } from "radix-vue";
import { Check, Minus } from "lucide-vue-next";
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "vue";

interface Props extends CheckboxRootProps {
  class?: HTMLAttributes["class"];
  indeterminate?: boolean;
}

const props = defineProps<Props>();
const emits = defineEmits<{
  "update:checked": [value: boolean | "indeterminate"];
}>();
</script>

<template>
  <CheckboxRoot
    v-bind="props"
    :class="
      cn(
        'peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow',
        'ring-offset-background',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        'data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground',
        props.class
      )
    "
    @update:checked="emits('update:checked', $event)"
  >
    <CheckboxIndicator class="flex h-full w-full items-center justify-center text-current">
      <Minus v-if="indeterminate" class="h-3 w-3" />
      <Check v-else class="h-3 w-3" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
