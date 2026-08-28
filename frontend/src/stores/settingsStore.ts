import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { call } from "@/services/api";
import { cacheERPSettings, getCachedERPSettings } from "@/services/dbBridge";
import { isOnline } from "@/utils";
import { isElectron } from "@/services/electronBridge";
import {
	DEFAULT_NUMBER_FORMAT,
	setNumberFormatSettings,
	numberFormatSettings as readNumberFormatSettings,
} from "@/utils/numberFormat";
import type {
	ERPSettings,
	SellingSettings,
	BuyingSettings,
	ERPStockSettings,
	AccountsSettings,
	GlobalDefaults,
	CurrencyPrecision,
	ItemSearchSettings,
	NumberFormatSettings,
} from "@/types/pos.types";

const emptySellingSettings: SellingSettings = {
	selling_price_list: "",
	default_selling_price_list: "",
	customer_group: "",
	territory: "",
	campaign: "",
	allow_multiple_items: 0,
	allow_against_multiple_purchase_orders: 0,
	validate_selling_price: 0,
	editable_bundle_item_rates: 0,
	hide_tax_id: 0,
	so_required: "No",
	dn_required: "No",
	allow_sales_order_creation_for_expired_quotation: 0,
	default_valid_till: "",
};

const emptyBuyingSettings: BuyingSettings = {
	buying_price_list: "",
	default_buying_price_list: "",
	supplier_group: "",
	supp_master_name: "Supplier Name",
	maintain_same_rate: 0,
	allow_multiple_items: 0,
	po_required: "No",
	pr_required: "No",
};

const emptyStockSettings: ERPStockSettings = {
	allow_negative_stock: 0,
	valuation_method: "FIFO",
	show_barcode_field: 0,
	auto_insert_price_list_rate_if_missing: 0,
	automatically_set_serial_nos_based_on_fifo: 0,
	default_warehouse: "",
	stock_uom: "Nos",
	over_delivery_receipt_allowance: 0,
	item_naming_by: "Item Code",
};

const emptyAccountsSettings: AccountsSettings = {
	allow_stale: 0,
	stale_days: 0,
	make_payment_via_journal_entry: 0,
	over_billing_allowance: 0,
	credit_controller: "",
	add_taxes_from_item_tax_template: 0,
	automatically_fetch_payment_terms: 0,
	enable_discount_accounting: 0,
	unlink_payment_on_cancellation_of_invoice: 0,
	book_asset_depreciation_entry_automatically: 0,
};

const emptyGlobalDefaults: GlobalDefaults = {
	default_currency: "",
	default_company: "",
	country: "",
	language: "",
	disable_rounded_total: 0,
	disable_in_words: 0,
};

const emptyItemSearchSettings: ItemSearchSettings = {
	fields: ["name", "item_name", "item_code"],
	item_search_limit: 20,
	search_serial_no: 0,
	search_batch_no: 0,
};

const emptyCurrencyPrecision: CurrencyPrecision = {
	currency_precision: "",
	float_precision: "",
};

const emptyNumberFormat: NumberFormatSettings = {
	number_format: DEFAULT_NUMBER_FORMAT,
	float_precision: "",
	currency_precision: "",
	use_number_format_from_currency: 0,
	hide_currency_symbol: 0,
};

export const useSettingsStore = defineStore("settings", () => {
	const isLoaded = ref(false);
	const sellingSettings = ref<SellingSettings>({ ...emptySellingSettings });
	const buyingSettings = ref<BuyingSettings>({ ...emptyBuyingSettings });
	const erpStockSettings = ref<ERPStockSettings>({ ...emptyStockSettings });
	const accountsSettings = ref<AccountsSettings>({ ...emptyAccountsSettings });
	const globalDefaults = ref<GlobalDefaults>({ ...emptyGlobalDefaults });
	const currencyPrecision = ref<CurrencyPrecision>({ ...emptyCurrencyPrecision });
	const numberFormat = ref<NumberFormatSettings>({ ...emptyNumberFormat });
	const itemSearch = ref<ItemSearchSettings>({ ...emptyItemSearchSettings });

	const defaultSellingPriceList = computed(() => sellingSettings.value.default_selling_price_list);

	const defaultBuyingPriceList = computed(() => buyingSettings.value.default_buying_price_list);

	const defaultCurrency = computed(() => globalDefaults.value.default_currency);

	const defaultCompany = computed(() => globalDefaults.value.default_company);

	const country = computed(() => globalDefaults.value.country);

	const language = computed(() => globalDefaults.value.language);

	const allowNegativeStock = computed(() => !!erpStockSettings.value.allow_negative_stock);

	const valuationMethod = computed(() => erpStockSettings.value.valuation_method);

	const showBarcodeField = computed(() => !!erpStockSettings.value.show_barcode_field);

	const validateSellingPrice = computed(() => !!sellingSettings.value.validate_selling_price);

	const defaultCustomerGroup = computed(() => sellingSettings.value.customer_group);

	const defaultTerritory = computed(() => sellingSettings.value.territory);

	const disableRoundedTotal = computed(() => !!globalDefaults.value.disable_rounded_total);

	const disableInWords = computed(() => !!globalDefaults.value.disable_in_words);

	const addTaxesFromItemTaxTemplate = computed(
		() => !!accountsSettings.value.add_taxes_from_item_tax_template,
	);

	const enableDiscountAccounting = computed(() => !!accountsSettings.value.enable_discount_accounting);

	const overBillingAllowance = computed(() => accountsSettings.value.over_billing_allowance);

	const maintainSameRate = computed(() => !!buyingSettings.value.maintain_same_rate);

	const itemSearchFields = computed(() => itemSearch.value.fields);

	const itemSearchLimit = computed(() => itemSearch.value.item_search_limit);

	const searchSerialNo = computed(() => !!itemSearch.value.search_serial_no);

	const searchBatchNo = computed(() => !!itemSearch.value.search_batch_no);

	function applyNumberFormat(data: NumberFormatSettings | undefined) {
		const resolved = { ...emptyNumberFormat, ...readNumberFormatSettings(), ...(data || {}) };
		numberFormat.value = resolved;
		setNumberFormatSettings(resolved);
	}

	function _applySettings(data: ERPSettings) {
		sellingSettings.value = { ...emptySellingSettings, ...data.selling_settings };
		buyingSettings.value = { ...emptyBuyingSettings, ...data.buying_settings };
		erpStockSettings.value = { ...emptyStockSettings, ...data.stock_settings };
		accountsSettings.value = { ...emptyAccountsSettings, ...data.accounts_settings };
		globalDefaults.value = { ...emptyGlobalDefaults, ...data.global_defaults };
		currencyPrecision.value = { ...emptyCurrencyPrecision, ...data.currency_precision };
		applyNumberFormat(data.number_format);
		itemSearch.value = { ...emptyItemSearchSettings, ...data.item_search };
		isLoaded.value = true;
	}

	async function fetchSettings(): Promise<void> {
		if (!isElectron() && window.xpos?.boot) {
			const boot = window.xpos.boot;
			if (
				boot.selling_settings ||
				boot.buying_settings ||
				boot.stock_settings ||
				boot.accounts_settings
			) {
				const data: ERPSettings = {
					selling_settings: boot.selling_settings || {},
					buying_settings: boot.buying_settings || {},
					stock_settings: boot.stock_settings || {},
					accounts_settings: boot.accounts_settings || {},
					global_defaults: boot.sysdefaults || {},
					currency_precision: boot.currency_precision || {},
					number_format: boot.xpos_number_format || boot.sysdefaults || {},
					pos_settings: boot.pos_settings || {},
					item_search: boot.xpos_item_search || {},
				} as ERPSettings;
				_applySettings(data);
				return;
			}
		}

		try {
			if (isOnline()) {
				const data = await call<ERPSettings>("xpos.api.settings.get_erp_settings");
				_applySettings(data);

				const { usePosStore } = await import("@/stores/posStore");
				if (usePosStore().useOfflineMode) {
					await cacheERPSettings(data).catch((err) =>
						console.warn("[XPOS] Failed to cache ERP settings:", err),
					);
				}
				return;
			}
		} catch (error) {
			console.warn("[XPOS] Failed to fetch ERP settings from server:", error);
		}

		const { usePosStore } = await import("@/stores/posStore");
		if (usePosStore().useOfflineMode) {
			try {
				const cached = (await getCachedERPSettings()) as ERPSettings | null;
				if (cached) {
					_applySettings(cached);
				}
			} catch (error) {
				console.warn("[XPOS] Failed to load cached ERP settings:", error);
			}
		}
	}

	function reset() {
		sellingSettings.value = { ...emptySellingSettings };
		buyingSettings.value = { ...emptyBuyingSettings };
		erpStockSettings.value = { ...emptyStockSettings };
		accountsSettings.value = { ...emptyAccountsSettings };
		globalDefaults.value = { ...emptyGlobalDefaults };
		currencyPrecision.value = { ...emptyCurrencyPrecision };
		numberFormat.value = { ...emptyNumberFormat };
		itemSearch.value = { ...emptyItemSearchSettings };
		isLoaded.value = false;
	}

	return {
		isLoaded,
		sellingSettings,
		buyingSettings,
		erpStockSettings,
		accountsSettings,
		globalDefaults,
		currencyPrecision,
		numberFormat,
		itemSearch,
		defaultSellingPriceList,
		defaultBuyingPriceList,
		defaultCurrency,
		defaultCompany,
		country,
		language,
		allowNegativeStock,
		valuationMethod,
		showBarcodeField,
		validateSellingPrice,
		defaultCustomerGroup,
		defaultTerritory,
		disableRoundedTotal,
		disableInWords,
		addTaxesFromItemTaxTemplate,
		enableDiscountAccounting,
		overBillingAllowance,
		maintainSameRate,
		itemSearchFields,
		itemSearchLimit,
		searchSerialNo,
		searchBatchNo,
		fetchSettings,
		reset,
	};
});
