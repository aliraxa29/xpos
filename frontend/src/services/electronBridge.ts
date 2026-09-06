export interface ElectronAPI {
	isFirstRun: () => Promise<boolean>;
	testErpNext: (config: {
		url: string;
		apiKey?: string;
		apiSecret?: string;
	}) => Promise<{ success: boolean; error?: string }>;
	getServerUrl: () => Promise<string>;
	setServerUrl: (url: string) => Promise<boolean>;
	getPlatformInfo: () => Promise<{
		platform: string;
		arch: string;
		version: string;
		isElectron: boolean;
		logDir: string;
	}>;
	checkMariaDb: () => Promise<{
		installed: boolean;
		version: string | null;
		binary: string | null;
	}>;
	setAuthCookie: (cookies: { name: string; value: string; domain: string }[]) => Promise<boolean>;
	clearAuth: () => Promise<boolean>;
	onSyncStatus: (
		callback: (status: { phase: string; table?: string; progress?: number }) => void,
	) => () => void;
	onSyncError: (callback: (error: { message: string; table?: string }) => void) => () => void;
	onSyncComplete: (callback: (summary: { pulled: number; pushed: number }) => void) => () => void;
	onSyncDeadLetter: (
		callback: (info: {
			table: string;
			pendingTable: string;
			id: number;
			localId: string;
			retryCount: number;
			error: string;
		}) => void,
	) => () => void;
	onStockUpdated: (
		callback: (data: { warehouse: string; item_code: string; actual_qty: number }) => void,
	) => () => void;
	onMainError: (callback: (err: { message: string; stack?: string }) => void) => () => void;
	logs: ElectronLogsAPI;
	triggerSync: () => Promise<boolean>;
	startSyncEngine: (opts?: {
		csrfToken?: string;
		sessionCookies?: string;
	}) => Promise<{ success: boolean; error?: string }>;
	getSyncState: () => Promise<{
		isSyncing: boolean;
		lastSyncTime: string | null;
		pendingPushCount: number;
	}>;
	db: ElectronDbAPI;
	update: ElectronUpdateAPI;
	node: ElectronNodeAPI;
	print: ElectronPrintAPI;
	fbr: ElectronFbrAPI;
}

export interface ElectronLogsAPI {
	list: () => Promise<string[]>;
	read: (name: string) => Promise<string>;
}

export interface ElectronFbrAPI {
	fiscalizeLocal: (
		url: string,
		payload: Record<string, unknown>,
	) => Promise<{ success: boolean; data?: unknown; error?: string }>;
}

export interface ElectronPrintAPI {
	printInvoice: (data: {
		localId: number;
		data: unknown;
		customerName: string;
		grandTotal: number;
		isReturn: boolean;
		printFormat: string;
		letterHead: string;
		companyName: string;
	}) => Promise<{ success: boolean; error?: string }>;
	printReport: (
		html: string,
		options?: {
			landscape?: boolean;
			margins?: Record<string, number>;
		},
	) => Promise<{ success: boolean; error?: string }>;
}

export interface ElectronUpdateAPI {
	check: () => Promise<{ success: boolean; version?: string; error?: string }>;
	download: () => Promise<{ success: boolean; error?: string }>;
	install: () => Promise<void>;
	onStatus: (callback: (status: Record<string, unknown>) => void) => () => void;
}

export interface ElectronNodeAPI {
	getRole: () => Promise<string>;
	setRole: (config: {
		role: string;
		hubUrl?: string;
		tillId?: string;
		hubApiPort?: number;
		hubSecret?: string;
	}) => Promise<{ success: boolean; error?: string }>;
	pingHub: () => Promise<boolean>;
	getHubSecret: () => Promise<string | null>;
	triggerTillSync: () => Promise<Record<string, unknown>>;
}

export interface ElectronDbAPI {
	getItemPrice(itemCode: string, priceList: string): unknown;
	getItemPrices(opts: { priceList?: string; selling?: boolean } | undefined): unknown;
	getItemByBarcode(barcode: string): unknown;
	getItemTaxTemplates(company: string | undefined): unknown;
	getItemTaxTemplateDetails(templateName: string): unknown;
	getSalesTaxTemplates(company: string | undefined): unknown;
	getSalesTaxCharges(templateName: string): unknown;
	getPricingRules(opts: { company?: string; itemCode?: string } | undefined): unknown;
	getPricingRuleItems(parent: string): unknown;
	getPricingRuleGroups(parent: string): unknown;
	getPricingRuleBrands(parent: string): unknown;
	getBin(itemCode: string, warehouse: string): unknown;
	getBins(warehouse: string | undefined): unknown;
	closePosShift(localId: string): unknown;
	getPosOpeningShifts(opts: { user?: string; status?: string } | undefined): unknown;
	createPosClosingEntry(entry: Record<string, unknown>): unknown;
	getPosClosingEntries(opts: { user?: string; status?: string } | undefined): unknown;
	getPosClosingEntryDetails(parentId: number): unknown;
	saveSalesInvoice(invoice: Record<string, unknown>): unknown;
	getSalesInvoices(
		opts:
			| {
					customer?: string;
					posProfile?: string;
					shiftLocalId?: string;
					fromDate?: string;
					toDate?: string;
					limit?: number;
			  }
			| undefined,
	): unknown;
	getSalesInvoice(localId: string): unknown;
	getShiftSalesSummary(shiftLocalId: string): unknown;
	createExpense(expense: Record<string, unknown>): unknown;
	getExpenses(
		opts:
			| {
					user?: string;
					fromDate?: string;
					toDate?: string;
					shiftLocalId?: string;
					syncStatus?: string;
			  }
			| undefined,
	): unknown;
	deleteExpense(id: number): unknown;
	createBankDrop(drop: Record<string, unknown>): unknown;
	getBankDrops(
		opts:
			| {
					user?: string;
					fromDate?: string;
					toDate?: string;
					shiftLocalId?: string;
					syncStatus?: string;
			  }
			| undefined,
	): unknown;
	deleteBankDrop(id: number): unknown;
	createStockAdjustment(adj: Record<string, unknown>): unknown;
	getStockAdjustments(
		opts: { warehouse?: string; syncStatus?: string; fromDate?: string; toDate?: string } | undefined,
	): unknown;
	saveQuotation(quotation: Record<string, unknown>): unknown;
	getQuotations(
		opts:
			| { customer?: string; fromDate?: string; toDate?: string; status?: string; limit?: number }
			| undefined,
	): unknown;
	getBrands(): unknown;
	getUom(): unknown;
	getUomConversions(itemCode: string): unknown;
	upsertTable(table: string, rows: Record<string, unknown>[], keyField: string): unknown;
	clearTable(table: string): unknown;
	getPosUsers(): unknown;
	getPosPaymentMethods(posProfile: string): unknown;
	getPosProfile(name: string): unknown;
	getPosProfiles(company: string | undefined): unknown;
	getModeOfPaymentAccounts(company: string): unknown;
	getModesOfPayment(): unknown;
	getPriceLists(selling: boolean | undefined): unknown;
	getCostCenters(company: string | undefined): unknown;
	getAccounts(opts: { company?: string; accountType?: string; rootType?: string } | undefined): unknown;
	getWarehouses(opts: { company?: string; isGroup?: boolean } | undefined): unknown;
	getCompanies(): unknown;
	getSetting: (key: string) => Promise<string | null>;
	setSetting: (key: string, value: string, category?: string) => Promise<boolean>;
	getSettingsByCategory: (category: string) => Promise<{ key: string; value: string }[]>;
	getAllSettings: () => Promise<{ key: string; value: string; category: string }[]>;
	testConnection: (config: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
	getConfig: () => Promise<Record<string, unknown>>;
	reinit: (config: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
	getItems: (opts?: {
		search?: string;
		group?: string;
		limit?: number;
		offset?: number;
		priceList?: string;
		warehouse?: string;
	}) => Promise<Record<string, unknown>[]>;
	getItem: (itemCode: string) => Promise<Record<string, unknown> | null>;
	upsertItems: (rows: Record<string, unknown>[]) => Promise<void>;
	countItems: () => Promise<number>;
	clearItems: () => Promise<void>;
	getItemGroups: () => Promise<Record<string, unknown>[]>;
	upsertItemGroups: (rows: Record<string, unknown>[]) => Promise<void>;
	getCustomers: (opts?: { search?: string; limit?: number }) => Promise<Record<string, unknown>[]>;
	getCustomer: (name: string) => Promise<Record<string, unknown> | null>;
	upsertCustomers: (rows: Record<string, unknown>[]) => Promise<void>;
	addLocalCustomer: (customer: Record<string, unknown>) => Promise<{ name: string; local_id: string }>;
	getSuppliers: (opts?: { search?: string; limit?: number }) => Promise<Record<string, unknown>[]>;
	upsertSuppliers: (rows: Record<string, unknown>[]) => Promise<void>;
	getStock: (
		warehouse: string,
		itemCode?: string,
	) => Promise<Record<string, unknown> | Record<string, unknown>[]>;
	upsertStock: (warehouse: string, entries: { item_code: string; actual_qty: number }[]) => Promise<void>;
	updateStockQty: (warehouse: string, itemCode: string, qty: number) => Promise<boolean>;
	addPendingInvoice: (record: {
		data: unknown;
		customer_name?: string;
		grand_total?: number;
	}) => Promise<{ id: number; local_id: string }>;
	getPendingInvoice: (id: number) => Promise<{
		id: number;
		local_id: string;
		data: Record<string, unknown>;
		status: string;
		customer_name: string | null;
		grand_total: number;
		is_return: boolean;
		is_draft: boolean;
	} | null>;
	getPendingInvoices: (status?: string) => Promise<Record<string, unknown>[]>;
	updatePendingInvoice: (id: number, updates: Record<string, unknown>) => Promise<boolean>;
	deletePendingInvoice: (id: number) => Promise<boolean>;
	countPendingInvoices: () => Promise<number>;
	getDeadLetters: () => Promise<{
		invoices: Record<string, unknown>[];
		purchases: Record<string, unknown>[];
	}>;
	countDeadLetters: () => Promise<number>;
	retryDeadLetter: (table: string, id: number) => Promise<boolean>;
	addPendingPurchase: (record: {
		type: string;
		data: unknown;
		supplier_name?: string;
		grand_total?: number;
	}) => Promise<{ id: number; local_id: string }>;
	getPendingPurchases: (opts?: { type?: string; status?: string }) => Promise<Record<string, unknown>[]>;
	updatePendingPurchase: (id: number, updates: Record<string, unknown>) => Promise<boolean>;
	deletePendingPurchase: (id: number) => Promise<boolean>;
	countPendingPurchases: () => Promise<number>;
	addSyncId: (localId: string, serverName: string, doctype: string) => Promise<boolean>;
	getServerName: (localId: string) => Promise<string | null>;
	getMeta: (key: string) => Promise<string | null>;
	setMeta: (key: string, value: string) => Promise<boolean>;
	cachePosData: (name: string, data: unknown) => Promise<boolean>;
	getCachedPosData: (name: string) => Promise<unknown>;
	cacheItemTax: (
		itemCode: string,
		company: string,
		data: { item_tax_template: string | null; item_tax_map: Record<string, number> },
	) => Promise<boolean>;
	getCachedItemTax: (
		itemCode: string,
		company: string,
	) => Promise<{ item_tax_template: string; item_tax_map: Record<string, number> } | null>;
	getPosUser: (username: string) => Promise<Record<string, unknown> | null>;
	createLocalUser: (user: {
		username: string;
		full_name: string;
		password: string;
		role?: string;
	}) => Promise<{ success: boolean; error?: string }>;
	verifyPassword: (username: string, password: string) => Promise<boolean>;
	createPosOpeningShift: (shift: Record<string, unknown>) => Promise<Record<string, unknown>>;
	getOpenShift: (user: string) => Promise<Record<string, unknown> | null>;
	checkOpenShift: (user: string) => Promise<Record<string, unknown> | null>;
	getOpeningData: () => Promise<Record<string, unknown>>;
	getCountries: () => Promise<Record<string, unknown>[]>;
	getCurrencies: () => Promise<Record<string, unknown>[]>;
	clearCachedData: () => Promise<boolean>;
	clearAllData: () => Promise<boolean>;
	clearPendingData: () => Promise<boolean>;
}

declare global {
	interface Window {
		electronAPI?: ElectronAPI;
	}
}

export function isElectron(): boolean {
	return typeof window !== "undefined" && !!window.electronAPI;
}

let _serverUrl: string | null = null;

let _apiKey: string | null = null;
let _apiSecret: string | null = null;

export async function getApiBaseUrl(): Promise<string> {
	if (!isElectron()) return "";

	if (_serverUrl) return _serverUrl;

	_serverUrl = await window.electronAPI!.getServerUrl();
	return _serverUrl;
}

export function getApiBaseUrlSync(): string {
	if (!isElectron()) return "";
	return _serverUrl || "";
}

export async function setServerUrl(url: string): Promise<void> {
	if (isElectron()) {
		await window.electronAPI!.setServerUrl(url);
	}
	_serverUrl = url;
}

export function clearServerUrlCache(): void {
	_serverUrl = null;
}

export async function warmApiCredentials(): Promise<void> {
	if (!isElectron()) return;
	_apiKey = await window.electronAPI!.db.getMeta("api_key");
	_apiSecret = await window.electronAPI!.db.getMeta("api_secret");
}

export function getApiCredentialsSync(): { apiKey: string | null; apiSecret: string | null } {
	return { apiKey: _apiKey, apiSecret: _apiSecret };
}

export function clearApiCredentialsCache(): void {
	_apiKey = null;
	_apiSecret = null;
}
