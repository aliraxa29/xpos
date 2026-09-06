<template>
	<Dialog
		:open="customerStore.showCustomerEditDialog"
		@update:open="
			(val: boolean) => {
				if (!val) close();
			}
		"
	>
		<DialogContent class="max-w-md max-h-[80vh] flex flex-col p-0 gap-0">
			<DialogHeader class="shrink-0 px-5 pt-5 pb-3 border-b border-border">
				<div class="flex items-center gap-3">
					<div>
						<DialogTitle>{{ __("Edit Customer") }}</DialogTitle>
						<DialogDescription class="text-xs text-muted-foreground mt-0.5">
							{{ __("Update customer information") }}
						</DialogDescription>
					</div>
				</div>
			</DialogHeader>

			<div v-if="isLoadingInfo" class="flex-1 flex items-center justify-center p-8">
				<Loader2 class="w-6 h-6 animate-spin text-primary" />
			</div>

			<div v-else class="flex-1 overflow-y-auto p-5 space-y-4 xpos-scrollbar">
				<div>
					<label class="text-xs font-medium text-muted-foreground mb-1 block"
						>{{ __("Customer Name") }} *</label
					>
					<Input
						ref="customerNameInput"
						v-model="form.customer_name"
						type="text"
						:placeholder="__('Full name')"
					/>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="text-xs font-medium text-muted-foreground mb-1 block">{{
							__("Tax ID")
						}}</label>
						<Input v-model="form.tax_id" type="text" :placeholder="__('Tax ID')" />
					</div>
					<div>
						<label class="text-xs font-medium text-muted-foreground mb-1 block">{{
							__("Mobile No")
						}}</label>
						<Input v-model="form.mobile_no" type="tel" :placeholder="__('Mobile No')" />
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="text-xs font-medium text-muted-foreground mb-1 block">{{
							__("Email")
						}}</label>
						<Input v-model="form.email_id" type="email" :placeholder="__('Email')" />
					</div>
					<div>
						<label class="text-xs font-medium text-muted-foreground mb-1 block">{{
							__("Gender")
						}}</label>
						<Autocomplete
							v-model="form.gender"
							:options="genderOptions"
							:placeholder="__('Select gender')"
							:show-search-icon="false"
							:max-visible="5"
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="text-xs font-medium text-muted-foreground mb-1 block"
							>{{ __("Customer Group") }} *</label
						>
						<Autocomplete
							v-model="form.customer_group"
							:options="customerGroupOptions"
							:placeholder="__('Select group')"
							:show-search-icon="false"
							:max-visible="10"
						/>
					</div>
					<div>
						<label class="text-xs font-medium text-muted-foreground mb-1 block"
							>{{ __("Territory") }} *</label
						>
						<Autocomplete
							v-model="form.territory"
							:options="territoryOptions"
							:placeholder="__('Select territory')"
							:show-search-icon="true"
							:max-visible="10"
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label class="text-xs font-medium text-muted-foreground mb-1 block">{{
							__("Referral Code")
						}}</label>
						<Input v-model="form.referral_code" type="text" :placeholder="__('Referral code')" />
					</div>
					<div>
						<label class="text-xs font-medium text-muted-foreground mb-1 block">{{
							__("Birthday")
						}}</label>
						<DateTimePicker
							v-model="form.birthday"
							:placeholder="__('Select birthday')"
							mode="date"
						/>
					</div>
				</div>
			</div>

			<DialogFooter class="shrink-0 border-t border-border px-5 py-4">
				<Button variant="outline" class="flex-1" @click="close">
					{{ __("Cancel") }}
				</Button>
				<Button class="flex-1 font-bold" :disabled="!canSave || isSaving" @click="saveChanges">
					<Loader2 v-if="isSaving" class="w-4 h-4 animate-spin me-1" />
					{{ isSaving ? __("Saving...") : __("Save Changes") }}
				</Button>
			</DialogFooter>
		</DialogContent>
	</Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useCartStore } from "@/stores/cartStore";
import { useCustomerStore } from "@/stores/customerStore";
import { showSuccess, showError, call } from "@/services/api";
import {
	cacheCustomerGroups,
	getCachedCustomerGroups,
	cacheTerritories,
	getCachedTerritories,
	cacheCountries,
	getCachedCountries,
} from "@/services/dbBridge";
import { isOnline } from "@/utils";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Autocomplete } from "@/components/ui/autocomplete";
import type { AutocompleteOption } from "@/components/ui/autocomplete";
import { Loader2 } from "lucide-vue-next";
import __ from "@/lib/translate";
import DateTimePicker from "@/components/ui/datetime-picker/DateTimePicker.vue";

const cartStore = useCartStore();
const customerStore = useCustomerStore();

const customerNameInput = ref<InstanceType<typeof Input> | null>(null);
const isLoadingInfo = ref(false);
const isSaving = ref(false);
const customerGroups = ref<string[]>([]);
const territories = ref<string[]>([]);
const countries = ref<string[]>([]);

const genderOptions: AutocompleteOption[] = [
	{ label: __("Male"), value: "Male" },
	{ label: __("Female"), value: "Female" },
	{ label: __("Other"), value: "Other" },
	{ label: __("Prefer not to say"), value: "Prefer not to say" },
];

const customerGroupOptions = computed<AutocompleteOption[]>(() =>
	customerGroups.value.map((g) => ({ label: g, value: g })),
);

const territoryOptions = computed<AutocompleteOption[]>(() =>
	territories.value.map((t) => ({ label: t, value: t })),
);

const defaultForm = () => ({
	customer_name: "",
	tax_id: "",
	mobile_no: "",
	email_id: "",
	gender: "",
	referral_code: "",
	birthday: "",
	customer_group: "",
	territory: "",
});

const form = ref(defaultForm());

const canSave = computed(
	() => !!form.value.customer_name.trim() && !!form.value.customer_group && !!form.value.territory,
);

watch(
	() => customerStore.showCustomerEditDialog,
	async (isOpen) => {
		if (isOpen && cartStore.customer?.name) {
			await loadCustomerData(cartStore.customer.name);
			loadDropdownData();
		}
	},
);

async function loadCustomerData(customerName: string) {
	isLoadingInfo.value = true;
	try {
		const info = await customerStore.getCustomerInfo(customerName);
		if (info) {
			form.value = {
				customer_name: info.customer_name || "",
				tax_id: ((info as Record<string, unknown>).tax_id as string) || "",
				mobile_no: info.mobile_no || "",
				email_id: info.email_id || "",
				gender: ((info as Record<string, unknown>).gender as string) || "",
				referral_code: ((info as Record<string, unknown>).referral_code as string) || "",
				birthday: ((info as Record<string, unknown>).birthday as string) || "",
				customer_group: info.customer_group || "",
				territory: info.territory || "",
			};
		}
		nextTick(() => {
			const el = customerNameInput.value?.$el as HTMLElement | undefined;
			const input = el?.querySelector?.("input") || el;
			(input as HTMLInputElement)?.focus();
		});
	} finally {
		isLoadingInfo.value = false;
	}
}

function loadDropdownData() {
	const boot = window.xpos?.boot;
	if (boot?.countries?.length) {
		countries.value = boot.countries.map((c) => c.name || "").filter(Boolean);
	}
	if (boot?.territories?.length) {
		territories.value = boot.territories.map((t) => t.name || t.territory_name || "").filter(Boolean);
	}
	fetchDropdownOptions();
}

async function fetchDropdownOptions() {
	const [cachedGroups, cachedTerritories, cachedCountries] = await Promise.all([
		getCachedCustomerGroups(),
		getCachedTerritories(),
		getCachedCountries(),
	]);

	if (cachedGroups.length) customerGroups.value = cachedGroups;
	if (!territories.value.length && cachedTerritories.length) territories.value = cachedTerritories;
	if (!countries.value.length && cachedCountries.length) countries.value = cachedCountries;

	if (!isOnline()) {
		if (!customerGroups.value.length) customerGroups.value = ["All Customer Groups"];
		if (!territories.value.length) territories.value = ["All Territories"];
		return;
	}

	try {
		const groupsResult = await call<string[]>("xpos.api.customers.get_customer_groups").catch(
			() => [] as string[],
		);
		if (groupsResult?.length) {
			customerGroups.value = groupsResult;
			await cacheCustomerGroups(groupsResult).catch(() => {});
		} else if (!customerGroups.value.length) {
			customerGroups.value = ["All Customer Groups"];
		}

		if (territories.value.length) {
			await cacheTerritories(territories.value).catch(() => {});
		} else {
			territories.value = ["All Territories"];
		}
	} catch {
		if (!customerGroups.value.length) customerGroups.value = ["All Customer Groups"];
		if (!territories.value.length) territories.value = ["All Territories"];
	}
}

async function saveChanges() {
	if (!canSave.value || !cartStore.customer?.name) return;
	isSaving.value = true;

	try {
		const payload: Record<string, unknown> = {
			customer_name: form.value.customer_name,
			mobile_no: form.value.mobile_no || undefined,
			email_id: form.value.email_id || undefined,
			tax_id: form.value.tax_id || undefined,
			gender: form.value.gender || undefined,
			referral_code: form.value.referral_code || undefined,
			birthday: form.value.birthday || undefined,
			customer_group: form.value.customer_group || undefined,
			territory: form.value.territory || undefined,
		};

		Object.keys(payload).forEach((key) => {
			if (payload[key] === undefined) delete payload[key];
		});

		const result = await customerStore.updateCustomer(cartStore.customer.name, payload);

		cartStore.setCustomer({
			name: cartStore.customer.name,
			customer_name: result.customer_name || form.value.customer_name,
			image: cartStore.customer.image,
			mobile_no: result.mobile_no || form.value.mobile_no,
			email_id: result.email_id || form.value.email_id,
		});

		showSuccess(__("Customer updated successfully!"));
		close();
	} catch (error: unknown) {
		showError(__("Failed to update customer: ") + ((error as Error)?.message || String(error)));
	} finally {
		isSaving.value = false;
	}
}

function close() {
	customerStore.showCustomerEditDialog = false;
	form.value = defaultForm();
}
</script>
