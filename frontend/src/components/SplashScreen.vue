<template>
	<Transition name="xpos-splash-fade">
		<div v-if="show" class="xpos-splash" :style="{ backgroundColor: background }">
			<img :src="isDark ? logoDark : logoLight" alt="X POS" class="xpos-splash__logo" />
		</div>
	</Transition>
</template>

<script setup lang="ts">
import { computed, inject, type Ref } from "vue";

import { useBranding } from "@/composables/useBranding";

defineProps<{ show: boolean }>();

const isDark = inject<Ref<boolean>>("isDark")!;
const { logoLight, logoDark, splashBackground } = useBranding();

const background = computed(() => splashBackground.value || "hsl(var(--background))");
</script>

<style scoped>
.xpos-splash {
	position: fixed;
	inset: 0;
	z-index: 9999;
	display: flex;
	align-items: center;
	justify-content: center;
}

.xpos-splash__logo {
	width: 96px;
	height: 96px;
	border-radius: 22%;
	animation: xpos-splash-pulse 1.6s ease-in-out infinite;
}

@keyframes xpos-splash-pulse {
	0%,
	100% {
		transform: scale(1);
		opacity: 0.92;
	}
	50% {
		transform: scale(1.06);
		opacity: 1;
	}
}

.xpos-splash-fade-leave-active {
	transition: opacity 0.35s ease;
}
.xpos-splash-fade-leave-to {
	opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
	.xpos-splash__logo {
		animation: none;
	}
}
</style>
