<template>
	<div class="h-full min-h-0">
		<BaseListView
			v-if="isElectronMode"
			:title="__('Expenses')"
			:fields="allFilterableFields"
			:standard-filter-fields="standardFilterFields"
			:standard-filters="standardFilterModel"
			:query-filters="queryFilterModel"
			:order-by="sortOrder"
			:is-loading="isLoading"
			:items="paginatedExpenses"
			:total="filteredExpenses.length"
			:page-size="pageSize"
			:current-page="currentPage"
			empty-title="No expenses found"
			:empty-description="emptyDescription"
			:empty-icon="Receipt"
			item-key="name"
			@update:standard-filters="onStandardFilterUpdate"
			@update:query-filters="onQueryFilterUpdate"
			@update:order-by="setSortOrder"
			@refresh="loadExpenses"
			@clear-filters="clearAllFilters"
			@update:current-page="handlePageChange"
			@update:page-size="handlePageSizeChange"
		>
			<template #header-actions>
				<Button size="sm" @click="openForm" :disabled="!canAddExpense">
					<Plus class="w-4 h-4 me-1" />
					{{ __("New Expense") }}
				</Button>
			</template>

			<template #item="{ item: expense }">
				<Card
					class="p-3 sm:p-4 cursor-pointer transition-all duration-200 border-border/60 dark:border-transparent hover:border-primary/40 hover:shadow-md dark:hover:bg-accent/50 dark:hover:shadow-primary/5"
					@click="openExpenseDetail(expense)"
				>
					<div class="flex items-center gap-2 sm:gap-4">
						<div
							class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-red-500/10 text-red-500"
						>
							<ArrowDownCircle class="w-4 h-4" />
						</div>
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2 mb-1 flex-wrap">
								<span class="font-semibold text-foreground text-sm leading-tight">
									{{ expenseTitle(expense) }}
								</span>
								<Badge :variant="statusVariant(expense.docstatus)" class="text-[10px]">
									{{ __(statusLabel(expense.docstatus)) }}
								</Badge>
							</div>
							<div
								class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground"
							>
								<span class="flex items-center gap-1 min-w-0 truncate max-w-30 sm:max-w-none">
									{{ expense.name }}
								</span>
								<span
									v-if="expense.posting_date"
									class="flex items-center gap-1 whitespace-nowrap"
								>
									<CalendarIcon class="h-3 w-3 shrink-0" />
									{{ formatDate(expense.posting_date) }}
								</span>
								<span
									v-if="expense.expense_account"
									class="min-w-0 truncate max-w-40 sm:max-w-none"
								>
									{{ expense.expense_account }}
								</span>
								<span
									v-if="expense.remarks"
									class="hidden sm:inline min-w-0 truncate max-w-70"
								>
									{{ expense.remarks }}
								</span>
							</div>
						</div>

						<div class="text-end shrink-0">
							<div class="font-bold text-base sm:text-lg leading-tight text-red-500">
								{{ money(expense.amount) }}
							</div>
							<div class="text-xs text-muted-foreground whitespace-nowrap">
								{{ __("Expense") }}
							</div>
						</div>

						<Button
							v-if="canDelete(expense)"
							variant="ghost"
							size="icon"
							class="text-destructive h-8 w-8 shrink-0"
							@click.stop="handleDelete(expense.name)"
						>
							<Trash2 class="w-4 h-4" />
						</Button>
					</div>
				</Card>
			</template>
		</BaseListView>

		<ListView
			v-else
			:key="browserListKey"
			:title="__('Expenses')"
			doctype="POS Cash Movement"
			:fields="browserFields"
			:base-filters="browserBaseFilters"
			default-order-by="posting_date desc, creation desc"
			:default-page-size="20"
			empty-title="No expenses found"
			:empty-description="emptyDescription"
			:empty-icon="Receipt"
			item-key="name"
		>
			<template #header-actions>
				<Button size="sm" @click="openForm" :disabled="!canAddExpense">
					<Plus class="w-4 h-4 me-1" />
					{{ __("New Expense") }}
				</Button>
			</template>

			<template #item="{ item: expense }">
				<Card
					class="p-3 sm:p-4 cursor-pointer transition-all duration-200 border-border/60 dark:border-transparent hover:border-primary/40 hover:shadow-md dark:hover:bg-accent/50 dark:hover:shadow-primary/5"
					@click="openExpenseDetail(expense)"
				>
					<div class="flex items-center gap-2 sm:gap-4">
						<div
							class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-red-500/10 text-red-500"
						>
							<ArrowDownCircle class="w-4 h-4" />
						</div>
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2 mb-1 flex-wrap">
								<span class="font-semibold text-foreground text-sm leading-tight">
									{{ expenseTitle(expense) }}
								</span>
								<Badge :variant="statusVariant(expense.docstatus)" class="text-[10px]">
									{{ __(statusLabel(expense.docstatus)) }}
								</Badge>
							</div>
							<div
								class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground"
							>
								<span class="flex items-center gap-1 min-w-0 truncate max-w-30 sm:max-w-none">
									{{ expense.name }}
								</span>
								<span
									v-if="expense.posting_date"
									class="flex items-center gap-1 whitespace-nowrap"
								>
									<CalendarIcon class="h-3 w-3 shrink-0" />
									{{ formatDate(expense.posting_date) }}
								</span>
								<span
									v-if="expense.expense_account"
									class="min-w-0 truncate max-w-40 sm:max-w-none"
								>
									{{ expense.expense_account }}
								</span>
								<span
									v-if="expense.remarks"
									class="hidden sm:inline min-w-0 truncate max-w-70"
								>
									{{ expense.remarks }}
								</span>
							</div>
						</div>

						<div class="text-end shrink-0">
							<div class="font-bold text-base sm:text-lg leading-tight text-red-500">
								{{ money(expense.amount) }}
							</div>
							<div class="text-xs text-muted-foreground whitespace-nowrap">
								{{ __("Expense") }}
							</div>
						</div>

						<Button
							v-if="canDelete(expense)"
							variant="ghost"
							size="icon"
							class="text-destructive h-8 w-8 shrink-0"
							@click.stop="handleDelete(expense.name)"
						>
							<Trash2 class="w-4 h-4" />
						</Button>
					</div>
				</Card>
			</template>
		</ListView>

		<ExpenseFormDialog
			:open="showForm"
			:expense-account-options="expenseAccountOptions"
			:default-expense-account="posStore.defaultPosExpenseAccount"
			:require-remarks="posStore.requireCashMovementRemarks"
			:is-saving="isSaving"
			@update:open="showForm = $event"
			@submit="handleSave"
		/>

		<ExpenseDetailDialog :expense="selectedExpense" @close="selectedExpense = null" />
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { usePosStore } from "@/stores/posStore";
import { useMoney } from "@/composables/useMoney";
import { useAuthStore } from "@/stores/authStore";
import { usePaymentStore } from "@/stores/paymentStore";
import { hasPermission } from "@/services/userRights";
import { createExpense, getExpenses, deleteExpense } from "@/services/dbBridge";
import { isElectron } from "@/services/electronBridge";
import { call, showSuccess, showError } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BaseListView from "@/components/core/BaseListView.vue";
import ListView from "@/components/core/ListView.vue";
import ExpenseDetailDialog from "@/components/dialogs/ExpenseDetailDialog.vue";
import ExpenseFormDialog from "@/components/dialogs/ExpenseFormDialog.vue";
import { Plus, Trash2, Receipt, ArrowDownCircle, Calendar as CalendarIcon } from "lucide-vue-next";
import __ from "@/lib/translate";
import type { DocField } from "@/services/doctypeMeta";
import type { QueryFilter } from "@/composables/useListView";

const posStore = usePosStore();
const { money } = useMoney();
const authStore = useAuthStore();
const paymentStore = usePaymentStore();

interface Expense {
	id: number | string;
	name: string;
	expense_account?: string;
	to_account?: string;
	amount: number;
	remarks?: string;
	posting_date?: string;
	docstatus: number;
	can_delete?: boolean;
	company?: string;
	pos_profile?: string;
	user?: string;
	movement_type?: string;
	creation?: string;
}

const isLoading = ref(false);
const isSaving = ref(false);
const showForm = ref(false);
const selectedExpense = ref<Expense | null>(null);
const browserListKey = ref(0);
const rawExpenses = ref<Expense[]>([]);
const isElectronMode = isElectron();

const browserFields = [
	"name",
	"posting_date",
	"expense_account",
	"remarks",
	"amount",
	"docstatus",
	"company",
	"pos_profile",
	"user",
	"creation",
];

const browserBaseFilters = computed(() => ({
	movement_type: "Expense",
	pos_opening_shift: posStore.posOpeningShift?.name || "__missing_shift__",
}));

const emptyDescription = computed(() =>
	posStore.posOpeningShift?.name ? __("Try adjusting your filters") : __("Open a shift to view expenses"),
);

const currentPage = ref(1);
const pageSize = ref(20);
const sortOrder = ref("posting_date desc");
const standardFilters = ref<Record<string, unknown>>({});
const queryFilters = ref<QueryFilter[]>([]);

const canAddExpense = computed(() => hasPermission("expense") && posStore.allowPosExpense);

const allFilterableFields = computed<DocField[]>(() => [
	{ fieldname: "name", fieldtype: "Data", label: __("ID"), in_standard_filter: 1 },
	{ fieldname: "posting_date", fieldtype: "Date", label: __("Posting Date"), in_standard_filter: 1 },
	{ fieldname: "expense_account", fieldtype: "Data", label: __("Expense Account"), in_standard_filter: 1 },
	{ fieldname: "remarks", fieldtype: "Data", label: __("Remarks"), in_standard_filter: 1 },
	{
		fieldname: "status",
		fieldtype: "Select",
		label: __("Status"),
		options: "Draft\nSubmitted\nCancelled",
		in_standard_filter: 1,
	},
	{ fieldname: "amount", fieldtype: "Currency", label: __("Amount") },
]);

const standardFilterFields = computed(() =>
	allFilterableFields.value.filter((field) => field.in_standard_filter === 1),
);

const expenseAccountOptions = computed(() => {
	const ctx = paymentStore.cashMovementContext;
	if (ctx?.expense_accounts) {
		return ctx.expense_accounts.map((account) => ({
			label: account.account,
			value: account.account,
		}));
	}
	return [];
});

const standardFilterModel = computed(() => ({ ...standardFilters.value }));

const queryFilterModel = computed(() =>
	queryFilters.value.map((filter) => ({
		field: filter.field,
		operator: filter.operator,
		value: filter.value,
	})),
);

const filteredExpenses = computed(() => {
	const rows = [...rawExpenses.value].filter((expense) => {
		for (const [field, value] of Object.entries(standardFilters.value)) {
			if (!matchesStandardFilter(expense, field, value)) {
				return false;
			}
		}

		for (const filter of queryFilters.value) {
			if (!matchesQueryFilter(expense, filter)) {
				return false;
			}
		}

		return true;
	});

	const { field, direction } = parseSortOrder(sortOrder.value);
	rows.sort((left, right) => compareExpenses(left, right, field, direction));

	return rows;
});

const paginatedExpenses = computed(() => {
	const start = (currentPage.value - 1) * pageSize.value;
	return filteredExpenses.value.slice(start, start + pageSize.value);
});

watch(
	() => filteredExpenses.value.length,
	(length) => {
		const maxPage = Math.max(1, Math.ceil(length / pageSize.value));
		if (currentPage.value > maxPage) {
			currentPage.value = maxPage;
		}
	},
);

function formatDate(date: string) {
	if (!date) return "";
	return new Date(date).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function statusLabel(docstatus: number) {
	return (
		{
			0: "Draft",
			1: "Submitted",
			2: "Cancelled",
		}[Number(docstatus) || 0] || "Unknown"
	);
}

function statusVariant(
	docstatus: number,
): "default" | "success" | "warning" | "destructive" | "secondary" | "outline" {
	const variants: Record<number, "success" | "secondary" | "outline"> = {
		0: "outline",
		1: "success",
		2: "secondary",
	};
	return variants[Number(docstatus) || 0] || "secondary";
}

function expenseTitle(expense: Expense) {
	return expense.remarks?.trim() || expense.expense_account || expense.to_account || __("Expense");
}

function canDelete(expense: Expense) {
	return expense.docstatus === 0 || !!expense.can_delete;
}

function getFieldDefinition(fieldname: string) {
	return allFilterableFields.value.find((field) => field.fieldname === fieldname);
}

function getFieldValue(expense: Expense, fieldname: string): unknown {
	if (fieldname === "status") {
		return statusLabel(expense.docstatus);
	}
	if (fieldname === "name") {
		return expense.name;
	}
	return (expense as unknown as Record<string, unknown>)[fieldname];
}

function normalizeText(value: unknown) {
	return String(value ?? "")
		.trim()
		.toLowerCase();
}

function normalizeNumber(value: unknown) {
	const number = Number(value);
	return Number.isFinite(number) ? number : 0;
}

function normalizeDate(value: unknown) {
	return String(value ?? "").trim();
}

function matchesStandardFilter(expense: Expense, fieldname: string, filterValue: unknown) {
	if (filterValue === undefined || filterValue === null || filterValue === "") {
		return true;
	}

	const field = getFieldDefinition(fieldname);
	const value = getFieldValue(expense, fieldname);

	if (field?.fieldtype === "Select") {
		return normalizeText(value) === normalizeText(filterValue);
	}

	if (field?.fieldtype === "Currency") {
		return normalizeNumber(value) === normalizeNumber(filterValue);
	}

	if (field?.fieldtype === "Date") {
		return normalizeDate(value) === normalizeDate(filterValue);
	}

	return normalizeText(value).includes(normalizeText(filterValue));
}

function matchesQueryFilter(expense: Expense, filter: QueryFilter) {
	const field = getFieldDefinition(filter.field);
	const value = getFieldValue(expense, filter.field);
	const operator = filter.operator;
	const filterValue = filter.value;

	if (operator === "is" || operator === "is not") {
		const isSet = normalizeText(value) !== "";
		const wantsSet = normalizeText(filterValue) === "set";
		return operator === "is" ? isSet === wantsSet : isSet !== wantsSet;
	}

	if (field?.fieldtype === "Currency") {
		const left = normalizeNumber(value);
		const right = normalizeNumber(filterValue);
		return compareByOperator(left, right, operator);
	}

	if (field?.fieldtype === "Date") {
		const left = normalizeDate(value);
		if (operator === "between") {
			const [from, to] = filterValue.split(",").map((part) => part.trim());
			if (!from || !to) return true;
			return left >= from && left <= to;
		}
		return compareByOperator(left, normalizeDate(filterValue), operator);
	}

	const left = normalizeText(value);
	const right = normalizeText(filterValue);

	if (operator === "like") {
		return left.includes(right);
	}
	if (operator === "not like") {
		return !left.includes(right);
	}

	return compareByOperator(left, right, operator);
}

function compareByOperator<T>(left: T, right: T, operator: string) {
	switch (operator) {
		case "=":
			return left === right;
		case "!=":
			return left !== right;
		case ">":
			return left > right;
		case "<":
			return left < right;
		case ">=":
			return left >= right;
		case "<=":
			return left <= right;
		default:
			return true;
	}
}

function parseSortOrder(order: string) {
	const [field = "posting_date", direction = "desc"] = order.trim().split(/\s+/);
	return {
		field,
		direction: direction.toLowerCase() === "asc" ? "asc" : "desc",
	} as const;
}

function compareExpenses(left: Expense, right: Expense, fieldname: string, direction: "asc" | "desc") {
	const field = getFieldDefinition(fieldname);
	const multiplier = direction === "asc" ? 1 : -1;

	if (fieldname === "status") {
		return (left.docstatus - right.docstatus) * multiplier;
	}

	const leftValue = getFieldValue(left, fieldname);
	const rightValue = getFieldValue(right, fieldname);

	if (field?.fieldtype === "Currency") {
		return (normalizeNumber(leftValue) - normalizeNumber(rightValue)) * multiplier;
	}

	if (field?.fieldtype === "Date") {
		return normalizeDate(leftValue).localeCompare(normalizeDate(rightValue)) * multiplier;
	}

	return normalizeText(leftValue).localeCompare(normalizeText(rightValue)) * multiplier;
}

function onStandardFilterUpdate(updated: Record<string, unknown>) {
	standardFilters.value = updated;
	currentPage.value = 1;
}

function onQueryFilterUpdate(filters: { field: string; operator: string; value: string }[]) {
	queryFilters.value = filters.map((filter) => ({
		field: filter.field,
		operator: filter.operator as QueryFilter["operator"],
		value: filter.value,
	}));
	currentPage.value = 1;
}

function clearAllFilters() {
	standardFilters.value = {};
	queryFilters.value = [];
	currentPage.value = 1;
}

function setSortOrder(value: string) {
	sortOrder.value = value;
	currentPage.value = 1;
}

function openForm() {
	showForm.value = true;
}

function openExpenseDetail(expense: Expense | Record<string, unknown>) {
	selectedExpense.value = normalizeExpense(expense);
}

function refreshBrowserList() {
	browserListKey.value += 1;
}

function handlePageChange(page: number) {
	currentPage.value = page;
}

function handlePageSizeChange(size: number) {
	pageSize.value = size;
	currentPage.value = 1;
}

function normalizeExpense(row: Record<string, unknown> | Expense): Expense {
	const record = row as Record<string, unknown>;
	const name = String(record.name || record.id || "");
	return {
		id: String(record.id || name),
		name,
		expense_account: String(record.expense_account || record.to_account || "") || undefined,
		to_account: String(record.to_account || record.expense_account || "") || undefined,
		amount: Number(record.amount || 0),
		remarks: String(record.remarks || "") || undefined,
		posting_date: String(record.posting_date || "") || undefined,
		docstatus: Number(record.docstatus || 0),
		can_delete: Boolean(record.can_delete ?? Number(record.docstatus || 0) < 2),
		company: String(record.company || "") || undefined,
		pos_profile: String(record.pos_profile || "") || undefined,
		user: String(record.user || "") || undefined,
		movement_type: String(record.movement_type || "Expense") || undefined,
		creation: String(record.creation || "") || undefined,
	};
}

async function loadExpenses() {
	isLoading.value = true;
	try {
		const rows = await getExpenses({ user: authStore.userEmail });
		rawExpenses.value = (rows as Expense[]).map((expense) => normalizeExpense(expense));
	} catch (error) {
		console.error("Failed to load expenses", error);
		showError(__("Failed to load expenses"));
	} finally {
		isLoading.value = false;
	}
}

async function handleSave(values: { expense_account: string; amount: number; reason: string }) {
	isSaving.value = true;
	try {
		const postingDate = new Date().toISOString().slice(0, 10);
		if (isElectronMode) {
			await createExpense({
				to_account: values.expense_account,
				amount: values.amount,
				remarks: values.reason,
				posting_date: postingDate,
				company: posStore.companyName,
				user: authStore.userEmail,
				pos_opening_entry_id: posStore.posOpeningShift?.name
					? Number(posStore.posOpeningShift.name)
					: null,
			});
		} else {
			await paymentStore.createPosExpense({
				pos_profile: posStore.profileName,
				company: posStore.companyName,
				expense_account: values.expense_account,
				amount: values.amount,
				reason: values.reason,
				pos_opening_shift: posStore.posOpeningShift?.name || "",
			});
		}

		showSuccess(__("POS expense recorded"));
		showForm.value = false;
		if (isElectronMode) {
			await loadExpenses();
		} else {
			refreshBrowserList();
		}
	} catch (error) {
		showError(__("Failed to record expense"));
		console.error("Failed to save expense", error);
	} finally {
		isSaving.value = false;
	}
}

async function handleDelete(id: number | string) {
	try {
		if (isElectronMode) {
			await deleteExpense(id);
		} else {
			await call("frappe.client.cancel", { doctype: "POS Cash Movement", name: String(id) });
		}
		showSuccess(__("Expense cancelled"));
		if (isElectronMode) {
			await loadExpenses();
		} else {
			refreshBrowserList();
		}
	} catch (error) {
		showError(__("Failed to cancel expense"));
		console.error("Failed to cancel expense:", error);
	}
}

watch(
	[() => posStore.posOpeningShift?.name, () => posStore.profileName],
	async ([shift, profileName]) => {
		if (shift && profileName) {
			await paymentStore.fetchCashMovementContext(profileName, shift);
		}

		if (isElectronMode) {
			await loadExpenses();
		}
	},
	{ immediate: true },
);
</script>
