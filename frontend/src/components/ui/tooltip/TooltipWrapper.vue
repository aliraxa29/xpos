<script setup lang="ts">
import { TooltipArrow, TooltipProvider, TooltipTrigger } from "radix-vue";
import Tooltip from "./Tooltip.vue";
import TooltipContent from "./TooltipContent.vue";

withDefaults(
  defineProps<{
    content: string | number;
    side?: "top" | "right" | "bottom" | "left";
    delayDuration?: number;
  }>(),
  {
    side: "bottom",
    delayDuration: 300,
  }
);
</script>

<template>
  <TooltipProvider :delay-duration="delayDuration">
    <Tooltip>
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipContent :side="side">
        {{ content }}
        <TooltipArrow class="fill-primary" :width="8" />
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
