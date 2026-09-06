<script setup lang="ts">
import { AlertTriangle, Filter, RefreshCw } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Autocomplete } from "@/components/ui/autocomplete";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import MultiLinkInput from "@/components/reports/MultiLinkInput.vue";
import __ from "@/lib/translate";
import { resolveReportLinkFilters, type ReportFilterDefinition } from "@/services/reports";

const props = defineProps<{
	filters: ReportFilterDefinition[];
	values: Record<string, unknown>;
	loading?: boolean;
	missingRequired?: string[];
}>();

const emit = defineEmits<{
	(e: "set", fieldname: string, value: unknown): void;
	(e: "apply"): void;
	(e: "reset"): void;
}>();

function emptyValueFor(fieldname: string): unknown {
	const def = props.filters.find((filter) => filter.fieldname === fieldname);
	return def?.type === "multi-link" ? [] : "";
}

function setValue(filter: ReportFilterDefinition, value: unknown) {
	emit("set", filter.fieldname, value);
	for (const dependent of filter.clears ?? []) {
		emit("set", dependent, emptyValueFor(dependent));
	}
}

function stringValue(fieldname: string): string {
	const value = props.values[fieldname];
	if (value === null || value === undefined) return "";
	if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
	return String(value);
}

function multiValue(fieldname: string): string[] {
	const value = props.values[fieldname];
	return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function placeholder(filter: ReportFilterDefinition): string {
	if (filter.placeholder) return filter.placeholder;
	if (filter.type === "multi-link") return `Search and add ${filter.label.toLowerCase()}...`;
	if (filter.type === "link") return `Search ${filter.label.toLowerCase()}...`;
	return filter.label;
}
</script>

<template>
	<Card class="border-border/70 bg-card p-4 sm:p-5">
		<div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
			<div class="flex items-center gap-2">
				<Filter class="h-4 w-4 text-muted-foreground" />
				<h2 class="text-base font-semibold text-foreground">{{ __("Filters") }}</h2>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<Badge v-if="missingRequired && missingRequired.length > 0" variant="warning" class="gap-1.5">
					<AlertTriangle class="h-3.5 w-3.5" />
					{{ missingRequired.length }} {{ __("required") }}
				</Badge>
				<Button variant="outline" size="sm" class="h-9" @click="emit('reset')">
					{{ __("Reset") }}
				</Button>
				<Button size="sm" class="h-9" :disabled="loading" @click="emit('apply')">
					<RefreshCw class="h-4 w-4" :class="{ 'animate-spin': loading }" />
					{{ __("Run") }}
				</Button>
			</div>
		</div>

		<div v-if="filters.length === 0" class="text-sm text-muted-foreground">
			{{ __("This report has no filters.") }}
		</div>

		<div v-else class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
			<div v-for="filter in filters" :key="filter.fieldname" class="space-y-1.5">
				<label class="flex items-center gap-1.5 text-sm font-medium text-foreground">
					{{ filter.label }}
					<span v-if="filter.required" class="text-destructive">*</span>
				</label>

				<Autocomplete
					v-if="filter.type === 'link'"
					:model-value="stringValue(filter.fieldname)"
					:doctype="filter.doctype || 'DocType'"
					:filters="resolveReportLinkFilters(filter, values)"
					:placeholder="placeholder(filter)"
					:open-on-focus="true"
					:clearable="true"
					class="w-full"
					@update:model-value="(value) => setValue(filter, value)"
				/>

				<MultiLinkInput
					v-else-if="filter.type === 'multi-link'"
					:model-value="multiValue(filter.fieldname)"
					:doctype="filter.doctype || 'DocType'"
					:filters="resolveReportLinkFilters(filter, values)"
					:placeholder="placeholder(filter)"
					class="w-full"
					@update:model-value="(value) => setValue(filter, value)"
				/>

				<DateTimePicker
					v-else-if="filter.type === 'date'"
					:model-value="stringValue(filter.fieldname)"
					mode="date"
					:show-today="true"
					:clearable="true"
					:placeholder="placeholder(filter)"
					class="w-full"
					@change="(value) => setValue(filter, value)"
				/>

				<Select
					v-else-if="filter.type === 'select'"
					:model-value="stringValue(filter.fieldname)"
					:placeholder="placeholder(filter)"
					:items="filter.options || []"
					@update:model-value="(value) => setValue(filter, value)"
				/>

				<Input
					v-else
					:model-value="stringValue(filter.fieldname)"
					:type="filter.type === 'text' ? 'text' : 'number'"
					:step="filter.type === 'float' ? '0.01' : '1'"
					:placeholder="placeholder(filter)"
					class="w-full"
					@update:model-value="(value) => setValue(filter, value)"
				/>
			</div>
		</div>
	</Card>
</template>
