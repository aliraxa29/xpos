<template>
	<div class="h-full min-h-0">
		<BaseListView
			v-if="isElectronMode"
			:title="__('Bank Drops')"
			:fields="allFilterableFields"
			:standard-filter-fields="standardFilterFields"
			:standard-filters="standardFilterModel"
			:query-filters="queryFilterModel"
			:order-by="sortOrder"
			:is-loading="isLoading"
			:items="paginatedDrops"
			:total="filteredDrops.length"
			:page-size="pageSize"
			:current-page="currentPage"
			empty-title="No bank drops found"
			:empty-description="emptyDescription"
			:empty-icon="Landmark"
			item-key="name"
			@update:standard-filters="onStandardFilterUpdate"
			@update:query-filters="onQueryFilterUpdate"
			@update:order-by="setSortOrder"
			@refresh="loadDrops"
			@clear-filters="clearAllFilters"
			@update:current-page="handlePageChange"
			@update:page-size="handlePageSizeChange"
		>
			<template #header-actions>
				<Button size="sm" @click="openForm" :disabled="!canAddBankDrop">
					<Plus class="w-4 h-4 me-1" />
					{{ __("New Bank Drop") }}
				</Button>
			</template>

			<template #item="{ item: drop }">
				<Card
					class="p-3 sm:p-4 cursor-pointer transition-all duration-200 border-border/60 dark:border-transparent hover:border-primary/40 hover:shadow-md dark:hover:bg-accent/50 dark:hover:shadow-primary/5"
					@click="openBankDropDetail(drop)"
				>
					<div class="flex items-center gap-2 sm:gap-4">
						<div
							class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500/10 text-emerald-500"
						>
							<ArrowUpCircle class="w-4 h-4" />
						</div>
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2 mb-1 flex-wrap">
								<span class="font-semibold text-foreground text-sm leading-tight">
									{{ bankDropTitle(drop) }}
								</span>
								<Badge :variant="statusVariant(drop.docstatus)" class="text-[10px]">
									{{ __(statusLabel(drop.docstatus)) }}
								</Badge>
							</div>
							<div
								class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground"
							>
								<span class="flex items-center gap-1 min-w-0 truncate max-w-30 sm:max-w-none">
									{{ drop.name }}
								</span>
								<span
									v-if="drop.posting_date"
									class="flex items-center gap-1 whitespace-nowrap"
								>
									<CalendarIcon class="h-3 w-3 shrink-0" />
									{{ formatDate(drop.posting_date) }}
								</span>
								<span
									v-if="drop.target_account"
									class="min-w-0 truncate max-w-40 sm:max-w-none"
								>
									{{ drop.target_account }}
								</span>
								<span v-if="drop.remarks" class="hidden sm:inline min-w-0 truncate max-w-70">
									{{ drop.remarks }}
								</span>
							</div>
						</div>

						<div class="text-end shrink-0">
							<div class="font-bold text-base sm:text-lg leading-tight text-emerald-500">
								{{ money(drop.amount) }}
							</div>
							<div class="text-xs text-muted-foreground whitespace-nowrap">
								{{ __("Deposit") }}
							</div>
						</div>

						<Button
							v-if="canDelete(drop)"
							variant="ghost"
							size="icon"
							class="text-destructive h-8 w-8 shrink-0"
							@click.stop="handleDelete(drop.id)"
						>
							<Trash2 class="w-4 h-4" />
						</Button>

						<ChevronRight class="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground/40 shrink-0" />
					</div>
				</Card>
			</template>
		</BaseListView>

		<ListView
			v-else
			:key="browserListKey"
			:title="__('Bank Drops')"
			doctype="POS Cash Movement"
			:fields="browserFields"
			:base-filters="browserBaseFilters"
			default-order-by="posting_date desc, creation desc"
			:default-page-size="20"
			empty-title="No bank drops found"
			:empty-description="emptyDescription"
			:empty-icon="Landmark"
			item-key="name"
		>
			<template #header-actions>
				<Button size="sm" @click="openForm" :disabled="!canAddBankDrop">
					<Plus class="w-4 h-4 me-1" />
					{{ __("New Bank Drop") }}
				</Button>
			</template>

			<template #item="{ item: drop }">
				<Card
					class="p-3 sm:p-4 cursor-pointer transition-all duration-200 border-border/60 dark:border-transparent hover:border-primary/40 hover:shadow-md dark:hover:bg-accent/50 dark:hover:shadow-primary/5"
					@click="openBankDropDetail(drop)"
				>
					<div class="flex items-center gap-2 sm:gap-4">
						<div
							class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500/10 text-emerald-500"
						>
							<ArrowUpCircle class="w-4 h-4" />
						</div>
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2 mb-1 flex-wrap">
								<span class="font-semibold text-foreground text-sm leading-tight">
									{{ bankDropTitle(drop) }}
								</span>
								<Badge
									:variant="statusVariant(Number(drop.docstatus || 0))"
									class="text-[10px]"
								>
									{{ __(statusLabel(Number(drop.docstatus || 0))) }}
								</Badge>
							</div>
							<div
								class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground"
							>
								<span class="flex items-center gap-1 min-w-0 truncate max-w-30 sm:max-w-none">
									{{ drop.name }}
								</span>
								<span
									v-if="drop.posting_date"
									class="flex items-center gap-1 whitespace-nowrap"
								>
									<CalendarIcon class="h-3 w-3 shrink-0" />
									{{ formatDate(String(drop.posting_date)) }}
								</span>
								<span
									v-if="drop.target_account"
									class="min-w-0 truncate max-w-40 sm:max-w-none"
								>
									{{ drop.target_account }}
								</span>
								<span v-if="drop.remarks" class="hidden sm:inline min-w-0 truncate max-w-70">
									{{ drop.remarks }}
								</span>
							</div>
						</div>

						<div class="text-end shrink-0">
							<div class="font-bold text-base sm:text-lg leading-tight text-emerald-500">
								{{ money(drop.amount) }}
							</div>
							<div class="text-xs text-muted-foreground whitespace-nowrap">
								{{ __("Deposit") }}
							</div>
						</div>

						<Button
							v-if="canDelete(normalizeBankDrop(drop))"
							variant="ghost"
							size="icon"
							class="text-destructive h-8 w-8 shrink-0"
							@click.stop="handleDelete(String(drop.name || drop.id || ''))"
						>
							<Trash2 class="w-4 h-4" />
						</Button>

						<ChevronRight class="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground/40 shrink-0" />
					</div>
				</Card>
			</template>
		</ListView>

		<Dialog :open="showForm" @update:open="showForm = $event">
			<DialogContent class="sm:max-w-md">
				<DialogHeader>
					<div class="flex items-center gap-2">
						<div
							class="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-500"
						>
							<ArrowUpCircle class="w-4 h-4" />
						</div>
						<div>
							<DialogTitle class="text-base">{{ __("Cash Deposit") }}</DialogTitle>
							<DialogDescription class="text-xs">
								{{ __("Record a cash deposit") }}
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>
				<div class="space-y-4">
					<div>
						<label class="text-sm font-semibold text-foreground mb-1.5 block">
							{{ __("Deposit To") }}
						</label>
						<Select v-model="form.target_account" :items="depositAccountOptions" />
					</div>
					<div>
						<label class="text-sm font-semibold text-foreground mb-1.5 block">
							{{ __("Amount") }}
						</label>
						<NumberInput
							v-model="form.amount"
							:min="0"
							:precision="moneyPrecision"
							class="text-lg font-bold"
							placeholder="0.00"
						/>
					</div>
					<div>
						<label class="text-sm font-semibold text-foreground mb-1.5 block">
							{{ __("Reason / Notes") }}
						</label>
						<textarea
							v-model="form.reason"
							rows="3"
							class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
							:placeholder="__('Enter reason for this transaction...')"
						/>
					</div>
				</div>
				<DialogFooter class="mt-4">
					<Button variant="outline" class="flex-1" @click="showForm = false">
						{{ __("Cancel") }}
					</Button>
					<Button
						class="flex-1 font-bold bg-emerald-500 hover:bg-emerald-600 text-white"
						:disabled="!canSubmit || isSaving"
						@click="handleSave"
					>
						<template v-if="isSaving">
							<Loader2 class="w-4 h-4 animate-spin" />
						</template>
						<template v-else>{{ __("Record Deposit") }}</template>
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>

		<BankDropDetailDialog :bank-drop="selectedBankDrop" @close="selectedBankDrop = null" />
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { usePosStore } from "@/stores/posStore";
import { useMoney } from "@/composables/useMoney";
import { useAuthStore } from "@/stores/authStore";
import { usePaymentStore } from "@/stores/paymentStore";
import { hasPermission } from "@/services/userRights";
import { createBankDrop, getBankDrops, deleteBankDrop } from "@/services/dbBridge";
import { isElectron } from "@/services/electronBridge";
import { call, showSuccess, showError } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BaseListView from "@/components/core/BaseListView.vue";
import ListView from "@/components/core/ListView.vue";
import BankDropDetailDialog from "@/components/dialogs/BankDropDetailDialog.vue";
import { NumberInput } from "@/components/ui/number-input";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Plus,
	Trash2,
	Landmark,
	Loader2,
	ArrowUpCircle,
	Calendar as CalendarIcon,
	ChevronRight,
} from "lucide-vue-next";
import __ from "@/lib/translate";
import type { DocField } from "@/services/doctypeMeta";
import type { QueryFilter } from "@/composables/useListView";
import { Select } from "@/components/ui/select";

const posStore = usePosStore();
const { money, moneyPrecision } = useMoney();
const authStore = useAuthStore();
const paymentStore = usePaymentStore();

interface BankDrop {
	id: number | string;
	name: string;
	target_account?: string;
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
const selectedBankDrop = ref<BankDrop | null>(null);
const browserListKey = ref(0);
const rawDrops = ref<BankDrop[]>([]);
const isElectronMode = isElectron();

const browserFields = [
	"name",
	"posting_date",
	"target_account",
	"remarks",
	"amount",
	"docstatus",
	"company",
	"pos_profile",
	"user",
	"creation",
];

const browserBaseFilters = computed(() => ({
	movement_type: "Deposit",
	pos_opening_shift: posStore.posOpeningShift?.name || "__missing_shift__",
}));

const emptyDescription = computed(() =>
	posStore.posOpeningShift?.name ? __("Try adjusting your filters") : __("Open a shift to view bank drops"),
);

const currentPage = ref(1);
const pageSize = ref(20);
const sortOrder = ref("posting_date desc");
const standardFilters = ref<Record<string, unknown>>({});
const queryFilters = ref<QueryFilter[]>([]);

const canAddBankDrop = computed(() => hasPermission("bank_drop") && posStore.allowCashDeposit);

const form = ref({
	target_account: "",
	amount: 0,
	reason: "",
});

const allFilterableFields = computed<DocField[]>(() => [
	{ fieldname: "name", fieldtype: "Data", label: __("ID"), in_standard_filter: 1 },
	{ fieldname: "posting_date", fieldtype: "Date", label: __("Posting Date"), in_standard_filter: 1 },
	{
		fieldname: "target_account",
		fieldtype: "Data",
		label: __("Deposit To"),
		in_standard_filter: 1,
	},
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

const depositAccountOptions = computed(() => {
	const ctx = paymentStore.cashMovementContext;
	if (ctx?.deposit_accounts) {
		return ctx.deposit_accounts.map((account) => ({
			label: account.name,
			value: account.name,
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

const filteredDrops = computed(() => {
	const rows = [...rawDrops.value].filter((drop) => {
		for (const [field, value] of Object.entries(standardFilters.value)) {
			if (!matchesStandardFilter(drop, field, value)) {
				return false;
			}
		}

		for (const filter of queryFilters.value) {
			if (!matchesQueryFilter(drop, filter)) {
				return false;
			}
		}

		return true;
	});

	const { field, direction } = parseSortOrder(sortOrder.value);
	rows.sort((left, right) => compareBankDrops(left, right, field, direction));

	return rows;
});

const paginatedDrops = computed(() => {
	const start = (currentPage.value - 1) * pageSize.value;
	return filteredDrops.value.slice(start, start + pageSize.value);
});

const canSubmit = computed(() => form.value.amount > 0 && form.value.target_account.trim() !== "");

watch(
	() => filteredDrops.value.length,
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

function bankDropTitle(drop: BankDrop | Record<string, unknown>) {
	const bankDrop = normalizeBankDrop(drop);
	return bankDrop.remarks?.trim() || bankDrop.target_account || bankDrop.to_account || __("Cash Deposit");
}

function canDelete(drop: BankDrop) {
	return drop.docstatus === 0 || !!drop.can_delete;
}

function getFieldDefinition(fieldname: string) {
	return allFilterableFields.value.find((field) => field.fieldname === fieldname);
}

function getFieldValue(drop: BankDrop, fieldname: string): unknown {
	if (fieldname === "status") {
		return statusLabel(drop.docstatus);
	}
	if (fieldname === "name") {
		return drop.name;
	}
	return (drop as unknown as Record<string, unknown>)[fieldname];
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

function matchesStandardFilter(drop: BankDrop, fieldname: string, filterValue: unknown) {
	if (filterValue === undefined || filterValue === null || filterValue === "") {
		return true;
	}

	const field = getFieldDefinition(fieldname);
	const value = getFieldValue(drop, fieldname);

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

function matchesQueryFilter(drop: BankDrop, filter: QueryFilter) {
	const field = getFieldDefinition(filter.field);
	const value = getFieldValue(drop, filter.field);
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

function compareBankDrops(left: BankDrop, right: BankDrop, fieldname: string, direction: "asc" | "desc") {
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
	form.value = { target_account: "", amount: 0, reason: "" };
	if (posStore.backOfficeCashAccount) {
		const hasDefault = depositAccountOptions.value.some(
			(account) => account.value === posStore.backOfficeCashAccount,
		);
		if (hasDefault) {
			form.value.target_account = posStore.backOfficeCashAccount;
		}
	}
	showForm.value = true;
}

function openBankDropDetail(drop: BankDrop | Record<string, unknown>) {
	selectedBankDrop.value = normalizeBankDrop(drop);
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

function normalizeBankDrop(row: Record<string, unknown> | BankDrop): BankDrop {
	const record = row as Record<string, unknown>;
	const name = String(record.name || record.id || "");
	return {
		id: String(record.id || name),
		name,
		target_account: String(record.target_account || record.to_account || "") || undefined,
		to_account: String(record.to_account || record.target_account || "") || undefined,
		amount: Number(record.amount || 0),
		remarks: String(record.remarks || "") || undefined,
		posting_date: String(record.posting_date || "") || undefined,
		docstatus: Number(record.docstatus || 0),
		can_delete: Boolean(record.can_delete ?? Number(record.docstatus || 0) < 2),
		company: String(record.company || "") || undefined,
		pos_profile: String(record.pos_profile || "") || undefined,
		user: String(record.user || "") || undefined,
		movement_type: String(record.movement_type || "Deposit") || undefined,
		creation: String(record.creation || "") || undefined,
	};
}

async function loadDrops() {
	isLoading.value = true;
	try {
		const rows = await getBankDrops({ user: authStore.userEmail });
		rawDrops.value = (rows as BankDrop[]).map((drop) => normalizeBankDrop(drop));
	} catch (error) {
		console.error("Failed to load bank drops", error);
		showError(__("Failed to load bank drops"));
	} finally {
		isLoading.value = false;
	}
}

async function handleSave() {
	if (!canSubmit.value) return;
	isSaving.value = true;
	try {
		const postingDate = new Date().toISOString().slice(0, 10);
		if (isElectronMode) {
			await createBankDrop({
				to_account: form.value.target_account,
				amount: form.value.amount,
				remarks: form.value.reason,
				posting_date: postingDate,
				company: posStore.companyName,
				user: authStore.userEmail,
				pos_opening_entry_id: posStore.posOpeningShift?.name
					? Number(posStore.posOpeningShift.name)
					: null,
			});
		} else {
			await paymentStore.createCashDeposit({
				pos_profile: posStore.profileName,
				company: posStore.companyName,
				target_account: form.value.target_account,
				amount: form.value.amount,
				reason: form.value.reason,
				pos_opening_shift: posStore.posOpeningShift?.name || "",
			});
		}

		showSuccess(__("Cash deposit recorded"));
		showForm.value = false;
		if (isElectronMode) {
			await loadDrops();
		} else {
			refreshBrowserList();
		}
	} catch (error) {
		showError(__("Failed to record deposit"));
		console.error("Failed to save bank drop", error);
	} finally {
		isSaving.value = false;
	}
}

async function handleDelete(id: number | string) {
	try {
		if (isElectronMode) {
			await deleteBankDrop(id);
		} else {
			await call("frappe.client.cancel", { doctype: "POS Cash Movement", name: String(id) });
		}

		if (selectedBankDrop.value && String(selectedBankDrop.value.id) === String(id)) {
			selectedBankDrop.value = null;
		}

		showSuccess(__("Deposit cancelled"));
		if (isElectronMode) {
			await loadDrops();
		} else {
			refreshBrowserList();
		}
	} catch (error) {
		showError(__("Failed to cancel deposit"));
		console.error("Failed to cancel bank drop:", error);
	}
}

watch(
	[() => posStore.posOpeningShift?.name, () => posStore.profileName],
	async ([shift, profileName]) => {
		if (shift && profileName) {
			await paymentStore.fetchCashMovementContext(profileName, shift);
		}

		if (isElectronMode) {
			await loadDrops();
		}
	},
	{ immediate: true },
);
</script>
