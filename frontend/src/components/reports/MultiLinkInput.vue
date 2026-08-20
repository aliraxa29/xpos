<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { X } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Autocomplete, AutocompleteOption } from "@/components/ui/autocomplete";

const props = withDefaults(
	defineProps<{
		modelValue: string[];
		doctype: string;
		placeholder?: string;
		disabled?: boolean;
		filters?: Record<string, unknown>;
		label?: string;
	}>(),
	{
		placeholder: "Search and add...",
		disabled: false,
		filters: () => ({}),
	},
);

const emit = defineEmits<{
	(e: "update:modelValue", value: string[]): void;
}>();

const selectedItems = ref<Array<{ value: string; label: string }>>([]);
const activeValue = ref("");

watch(
	() => props.modelValue,
	(values) => {
		const nextValues = Array.isArray(values) ? values : [];
		selectedItems.value = nextValues.map((value) => {
			const existing = selectedItems.value.find((item) => item.value === value);
			return existing ?? { value, label: value };
		});
	},
	{ immediate: true },
);

function syncValues() {
	emit(
		"update:modelValue",
		selectedItems.value.map((item) => item.value),
	);
}

function addSelectedOption(option: AutocompleteOption) {
	if (!option.value) return;
	if (selectedItems.value.some((item) => item.value === option.value)) {
		activeValue.value = "";
		return;
	}

	selectedItems.value = [
		...selectedItems.value,
		{ value: option.value, label: option.description ?? option.value },
	];
	syncValues();
	activeValue.value = "";
	void nextTick(() => {
		activeValue.value = "";
	});
}

function removeItem(value: string) {
	selectedItems.value = selectedItems.value.filter((item) => item.value !== value);
	syncValues();
}

function clearAll() {
	selectedItems.value = [];
	activeValue.value = "";
	syncValues();
}
</script>

<template>
	<div class="space-y-2">
		<div v-if="label" class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
			{{ label }}
		</div>

		<div class="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
			<div class="flex flex-wrap gap-1.5 min-h-8">
				<Badge
					v-for="item in selectedItems"
					:key="item.value"
					variant="secondary"
					class="gap-1.5 pl-2.5 pr-1.5"
				>
					<span class="max-w-36 truncate">{{ item.label || item.value }}</span>
					<button
						type="button"
						class="rounded-full p-0.5 text-muted-foreground hover:text-destructive transition-colors"
						@click="removeItem(item.value)"
					>
						<X class="h-3 w-3" />
					</button>
				</Badge>

				<div v-if="selectedItems.length === 0" class="text-xs text-muted-foreground italic px-1 py-1">
					{{ placeholder }}
				</div>
			</div>

			<div class="flex items-center gap-2">
				<div class="flex-1 min-w-0">
					<Autocomplete
						v-model="activeValue"
						:doctype="doctype"
						:filters="filters"
						:disabled="disabled"
						:clearable="true"
						:open-on-focus="true"
						:min-chars="0"
						:placeholder="placeholder"
						class="w-full"
						@select="addSelectedOption"
					/>
				</div>

				<Button
					variant="outline"
					size="sm"
					class="shrink-0"
					:disabled="selectedItems.length === 0 || disabled"
					@click="clearAll"
				>
					Clear
				</Button>
			</div>
		</div>
	</div>
</template>
