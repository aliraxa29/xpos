<script setup lang="ts">
import { computed } from "vue";
import { ArrowDown, ArrowUp, ChevronsUpDown, Table2 } from "lucide-vue-next";
import {
	formatReportCell,
	getVisibleReportColumns,
	isReportNumericColumn,
	isReportTotalRow,
	type ReportColumn,
} from "@/services/reports";

export interface ReportSortState {
	fieldname: string;
	direction: "asc" | "desc";
}

const props = withDefaults(
	defineProps<{
		columns: ReportColumn[];
		rows: Record<string, unknown>[];
		totals?: Record<string, unknown>[];
		currencySymbol: string;
		sortState: ReportSortState | null;
		emptyTitle?: string;
		emptyDescription?: string;
	}>(),
	{
		totals: () => [],
		emptyTitle: "No rows found",
		emptyDescription: "Adjust filters or refresh the report.",
	},
);

const emit = defineEmits<{
	(e: "sort-change", fieldname: string): void;
}>();

const visibleColumns = computed(() => getVisibleReportColumns(props.columns));

function sortIndicator(column: ReportColumn): "asc" | "desc" | "none" {
	if (!props.sortState || props.sortState.fieldname !== column.fieldname) return "none";
	return props.sortState.direction;
}

function rowKey(row: Record<string, unknown>, index: number): string {
	return String(row.name ?? row.item_code ?? row.code ?? row.id ?? index);
}

function totalCell(row: Record<string, unknown>, column: ReportColumn): string {
	const value = row[column.fieldname];
	if (value === null || value === undefined || value === "") return "";
	return formatReportCell(column, value, props.currencySymbol);
}
</script>

<template>
	<div v-if="rows.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
		<div class="mb-4 rounded-full bg-muted/60 p-4">
			<Table2 class="h-6 w-6 text-muted-foreground" />
		</div>
		<p class="text-base font-semibold text-foreground">{{ emptyTitle }}</p>
		<p class="mt-1 max-w-md text-sm text-muted-foreground">{{ emptyDescription }}</p>
	</div>

	<div v-else class="overflow-x-auto rounded-xl border border-border bg-card">
		<table class="min-w-full text-sm">
			<thead class="sticky top-0 z-10 border-b border-border bg-muted/90 backdrop-blur">
				<tr>
					<th
						class="w-12 px-3 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-muted-foreground"
					>
						#
					</th>
					<th
						v-for="column in visibleColumns"
						:key="column.fieldname"
						class="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
						:class="isReportNumericColumn(column) ? 'text-end' : 'text-start'"
						:style="column.width ? { width: `${column.width}px` } : undefined"
					>
						<button
							type="button"
							class="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
							@click="emit('sort-change', column.fieldname)"
						>
							<span>{{ column.label }}</span>
							<ArrowUp
								v-if="sortIndicator(column) === 'asc'"
								class="h-3.5 w-3.5 text-primary"
							/>
							<ArrowDown
								v-else-if="sortIndicator(column) === 'desc'"
								class="h-3.5 w-3.5 text-primary"
							/>
							<ChevronsUpDown v-else class="h-3.5 w-3.5 text-muted-foreground/60" />
						</button>
					</th>
				</tr>
			</thead>

			<tbody class="divide-y divide-border">
				<tr
					v-for="(row, index) in rows"
					:key="rowKey(row, index)"
					class="transition-colors hover:bg-muted/50"
					:class="{ 'bg-amber-500/5 font-medium': isReportTotalRow(row) }"
				>
					<td class="px-3 py-2 text-muted-foreground">{{ index + 1 }}</td>
					<td
						v-for="column in visibleColumns"
						:key="`${rowKey(row, index)}-${column.fieldname}`"
						class="px-3 py-2 align-top"
						:class="isReportNumericColumn(column) ? 'text-end tabular-nums' : 'text-start'"
					>
						<div
							class="max-w-[340px] break-words"
							:class="isReportNumericColumn(column) ? 'ms-auto' : ''"
						>
							{{ formatReportCell(column, row[column.fieldname], currencySymbol) }}
						</div>
					</td>
				</tr>
			</tbody>

			<tfoot v-if="totals.length > 0" class="sticky bottom-0 z-10">
				<tr
					v-for="(total, totalIndex) in totals"
					:key="`total-${totalIndex}`"
					class="border-t-2 border-border bg-muted/95 font-semibold backdrop-blur"
				>
					<td class="px-3 py-2.5 text-muted-foreground">Σ</td>
					<td
						v-for="column in visibleColumns"
						:key="`total-${totalIndex}-${column.fieldname}`"
						class="px-3 py-2.5 align-top"
						:class="isReportNumericColumn(column) ? 'text-end tabular-nums' : 'text-start'"
					>
						<div :class="isReportNumericColumn(column) ? 'ms-auto' : ''">
							{{ totalCell(total, column) }}
						</div>
					</td>
				</tr>
			</tfoot>
		</table>
	</div>
</template>
