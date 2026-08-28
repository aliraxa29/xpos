<script setup lang="ts">
import { ref, watch, computed, type HTMLAttributes } from "vue";
import { cn } from "@/lib/utils";
import {
	floatPrecision,
	formatNumber as formatBySystem,
	getNumberFormatInfo,
	parseNumber,
	roundTo,
} from "@/utils/numberFormat";

export interface NumberInputProps {
	modelValue?: number;
	min?: number;
	max?: number;
	step?: number;
	precision?: number;
	placeholder?: string;
	disabled?: boolean;
	readonly?: boolean;
	class?: HTMLAttributes["class"];
	allowDecimal?: boolean;
	selectOnFocus?: boolean;
	disableSpinner?: boolean;
}

const props = withDefaults(defineProps<NumberInputProps>(), {
	modelValue: 0,
	step: 1,
	precision: undefined,
	placeholder: "0",
	disabled: false,
	readonly: false,
	allowDecimal: true,
	selectOnFocus: true,
	disableSpinner: false,
});

const emit = defineEmits<{
	(e: "update:modelValue", value: number): void;
	(e: "change", value: number): void;
}>();

const inputRef = ref<HTMLInputElement | null>(null);
const isFocused = ref(false);

const effectivePrecision = computed(() => {
	if (props.precision !== undefined) return props.precision;
	return props.allowDecimal ? floatPrecision() : 0;
});

function formatNumber(val: number): string {
	if (val === null || val === undefined || isNaN(val)) return "";
	return formatBySystem(val, null, effectivePrecision.value);
}

const displayValue = ref(formatNumber(props.modelValue));

function editValue(val: number): string {
	if (val === null || val === undefined || isNaN(val)) return "";
	const { decimalStr } = getNumberFormatInfo();
	const text = String(val);
	return decimalStr && decimalStr !== "." ? text.split(".").join(decimalStr) : text;
}

function parseInput(raw: string): number | null {
	const cleaned = raw.trim();
	if (!cleaned || !/\d/.test(cleaned)) return null;
	const num = parseNumber(cleaned);
	return Number.isFinite(num) ? num : null;
}

function clampValue(val: number): number {
	if (props.min !== undefined && val < props.min) return props.min;
	if (props.max !== undefined && val > props.max) return props.max;
	return val;
}

function commitValue(val: number): void {
	const clamped = clampValue(val);
	const rounded = roundTo(clamped, effectivePrecision.value);
	emit("update:modelValue", rounded);
	emit("change", rounded);
}

watch(
	() => props.modelValue,
	(newVal) => {
		if (!isFocused.value) {
			displayValue.value = formatNumber(newVal ?? 0);
		}
	},
);

function onFocus(event: FocusEvent): void {
	isFocused.value = true;
	const val = props.modelValue ?? 0;
	displayValue.value = val === 0 ? "" : editValue(val);
	if (props.selectOnFocus) {
		requestAnimationFrame(() => {
			(event.target as HTMLInputElement)?.select();
		});
	}
}

function onBlur(): void {
	isFocused.value = false;
	const parsed = parseInput(displayValue.value);
	if (parsed !== null) {
		commitValue(parsed);
		displayValue.value = formatNumber(clampValue(parsed));
	} else {
		displayValue.value = formatNumber(props.modelValue ?? 0);
	}
}

function onInput(event: Event): void {
	const target = event.target as HTMLInputElement;
	displayValue.value = target.value;
	const parsed = parseInput(target.value);
	if (parsed !== null) {
		emit("update:modelValue", clampValue(parsed));
	}
}

function onKeyDown(event: KeyboardEvent): void {
	const blocked = ["e", "E"];
	if (!props.allowDecimal) {
		blocked.push(".", ",");
	}
	if (blocked.includes(event.key)) {
		event.preventDefault();
		return;
	}

	if (!props.disableSpinner && event.key === "ArrowUp") {
		event.preventDefault();
		const current = props.modelValue ?? 0;
		commitValue(current + props.step);
		displayValue.value = formatNumber(clampValue(current + props.step));
	} else if (!props.disableSpinner && event.key === "ArrowDown") {
		event.preventDefault();
		const current = props.modelValue ?? 0;
		commitValue(current - props.step);
		displayValue.value = formatNumber(clampValue(current - props.step));
	} else if (event.key === "Enter") {
		(event.target as HTMLInputElement)?.blur();
	}
}

function focus() {
	inputRef.value?.focus();
}

function select() {
	inputRef.value?.select();
}

function setValue(val: number): void {
	const clamped = clampValue(val);
	const rounded = roundTo(clamped, effectivePrecision.value);
	displayValue.value = isFocused.value ? editValue(rounded) : formatNumber(rounded);
	emit("update:modelValue", rounded);
	emit("change", rounded);
}

defineExpose({ inputRef, focus, select, setValue });
</script>

<template>
	<input
		ref="inputRef"
		type="text"
		inputmode="decimal"
		autocomplete="off"
		:value="displayValue"
		:placeholder="placeholder"
		:disabled="disabled"
		:readonly="readonly"
		:class="
			cn(
				'flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
				props.class,
			)
		"
		@focus="onFocus"
		@blur="onBlur"
		@input="onInput"
		@keydown="onKeyDown"
	/>
</template>
