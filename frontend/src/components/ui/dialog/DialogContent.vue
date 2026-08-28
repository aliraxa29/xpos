<script setup lang="ts">
import { __, cn } from "@/lib/utils";
import {
	DialogClose,
	DialogContent,
	type DialogContentEmits,
	type DialogContentProps,
	DialogOverlay,
	DialogPortal,
	useForwardPropsEmits,
} from "radix-vue";
import { computed, type HTMLAttributes } from "vue";
import { X } from "lucide-vue-next";

const props = defineProps<DialogContentProps & { class?: HTMLAttributes["class"]; hideClose?: boolean }>();
const emits = defineEmits<DialogContentEmits>();

const delegatedProps = computed(() => {
	const { class: _, ...delegated } = props;
	return delegated;
});

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
	<DialogPortal to="body">
		<DialogOverlay class="dialog-overlay fixed inset-0 z-9999 bg-black/60 backdrop-blur-sm" />
		<DialogContent
			v-bind="forwarded"
			:class="
				cn(
					'dialog-panel fixed left-1/2 top-1/2 z-9999 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border bg-background p-6 shadow-lg rounded-xl',
					props.class,
				)
			"
		>
			<slot />

			<DialogClose
				v-if="!hideClose"
				class="absolute inset-e-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
			>
				<X class="w-4 h-4" />
				<span class="sr-only">{{ __("Close") }}</span>
			</DialogClose>
		</DialogContent>
	</DialogPortal>
</template>
