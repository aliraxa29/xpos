import { contextBridge, ipcRenderer } from "electron";

const SYNC_DATA_CHANNELS = [
  "sync-pull-batch",
  "sync-update-meta",
  "sync-update-record-status",
  "sync-delete-record",
];

for (const channel of SYNC_DATA_CHANNELS) {
  ipcRenderer.on(channel, (_event, payload) => {
    window.postMessage({ channel, payload }, "*");
  });
}

contextBridge.exposeInMainWorld("electronAPI", {
  isFirstRun: (): Promise<boolean> => ipcRenderer.invoke("app:is-first-run"),
  testErpNext: (config: { url: string; apiKey?: string; apiSecret?: string }): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("app:test-erpnext", config),
  getServerUrl: (): Promise<string> => ipcRenderer.invoke("get-server-url"),
  setServerUrl: (url: string): Promise<boolean> =>
    ipcRenderer.invoke("set-server-url", url),
  getPlatformInfo: (): Promise<{
    platform: string;
    arch: string;
    version: string;
    isElectron: boolean;
    logDir: string;
  }> => ipcRenderer.invoke("get-platform-info"),

  checkMariaDb: (): Promise<{
    installed: boolean;
    version: string | null;
    binary: string | null;
  }> => ipcRenderer.invoke("check-mariadb"),

  setAuthCookie: (
    cookies: { name: string; value: string; domain: string }[]
  ): Promise<boolean> => ipcRenderer.invoke("set-auth-cookie", cookies),
  clearAuth: (): Promise<boolean> => ipcRenderer.invoke("clear-auth"),

  onSyncStatus: (
    callback: (status: { phase: string; table?: string; progress?: number }) => void
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      status: { phase: string; table?: string; progress?: number }
    ) => callback(status);
    ipcRenderer.on("sync-status", handler);
    return () => ipcRenderer.removeListener("sync-status", handler);
  },

  onSyncError: (callback: (error: { message: string; table?: string }) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      error: { message: string; table?: string }
    ) => callback(error);
    ipcRenderer.on("sync-error", handler);
    return () => ipcRenderer.removeListener("sync-error", handler);
  },

  onSyncComplete: (callback: (summary: { pulled: number; pushed: number }) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      summary: { pulled: number; pushed: number }
    ) => callback(summary);
    ipcRenderer.on("sync-complete", handler);
    return () => ipcRenderer.removeListener("sync-complete", handler);
  },

  onStockUpdated: (callback: (data: { warehouse: string; item_code: string; actual_qty: number }) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { warehouse: string; item_code: string; actual_qty: number }
    ) => callback(data);
    ipcRenderer.on("stock-updated", handler);
    return () => ipcRenderer.removeListener("stock-updated", handler);
  },

  triggerSync: (): Promise<boolean> => ipcRenderer.invoke("trigger-sync"),
  startSyncEngine: (opts?: { csrfToken?: string; sessionCookies?: string }): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("start-sync-engine", opts),
  getSyncState: (): Promise<{
    isSyncing: boolean;
    lastSyncTime: string | null;
    pendingPushCount: number;
  }> => ipcRenderer.invoke("get-sync-state"),

  db: {
    getSetting: (key: string): Promise<string | null> =>
      ipcRenderer.invoke("db:get-setting", key),
    setSetting: (key: string, value: string, category?: string): Promise<boolean> =>
      ipcRenderer.invoke("db:set-setting", key, value, category),
    getSettingsByCategory: (category: string) =>
      ipcRenderer.invoke("db:get-settings-by-category", category),
    getAllSettings: () => ipcRenderer.invoke("db:get-all-settings"),

    testConnection: (config: Record<string, unknown>) =>
      ipcRenderer.invoke("db:test-connection", config),
    getConfig: () => ipcRenderer.invoke("db:get-config"),
    reinit: (config: Record<string, unknown>) =>
      ipcRenderer.invoke("db:reinit", config),

    getItems: (opts?: { search?: string; group?: string; limit?: number; offset?: number; priceList?: string; warehouse?: string }) =>
      ipcRenderer.invoke("db:get-items", opts),
    getItem: (itemCode: string) => ipcRenderer.invoke("db:get-item", itemCode),
    upsertItems: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-items", rows),
    countItems: (): Promise<number> => ipcRenderer.invoke("db:count-items"),
    clearItems: () => ipcRenderer.invoke("db:clear-items"),

    getItemGroups: () => ipcRenderer.invoke("db:get-item-groups"),
    upsertItemGroups: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-item-groups", rows),

    getCustomers: (opts?: { search?: string; limit?: number }) =>
      ipcRenderer.invoke("db:get-customers", opts),
    getCustomer: (name: string) => ipcRenderer.invoke("db:get-customer", name),
    upsertCustomers: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-customers", rows),
    addLocalCustomer: (customer: Record<string, unknown>) =>
      ipcRenderer.invoke("db:add-local-customer", customer),

    getSuppliers: (opts?: { search?: string; limit?: number }) =>
      ipcRenderer.invoke("db:get-suppliers", opts),
    upsertSuppliers: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-suppliers", rows),

    getStock: (warehouse: string, itemCode?: string) =>
      ipcRenderer.invoke("db:get-stock", warehouse, itemCode),
    upsertStock: (warehouse: string, entries: { item_code: string; actual_qty: number }[]) =>
      ipcRenderer.invoke("db:upsert-stock", warehouse, entries),
    updateStockQty: (warehouse: string, itemCode: string, qty: number) =>
      ipcRenderer.invoke("db:update-stock-qty", warehouse, itemCode, qty),

    addPendingInvoice: (record: { data: unknown; customer_name?: string; grand_total?: number }) =>
      ipcRenderer.invoke("db:add-pending-invoice", record),
    getPendingInvoice: (id: number) =>
      ipcRenderer.invoke("db:get-pending-invoice", id),
    getPendingInvoices: (status?: string) =>
      ipcRenderer.invoke("db:get-pending-invoices", status),
    updatePendingInvoice: (id: number, updates: Record<string, unknown>) =>
      ipcRenderer.invoke("db:update-pending-invoice", id, updates),
    deletePendingInvoice: (id: number) =>
      ipcRenderer.invoke("db:delete-pending-invoice", id),
    countPendingInvoices: (): Promise<number> =>
      ipcRenderer.invoke("db:count-pending-invoices"),

    addPendingPurchase: (record: { type: string; data: unknown; supplier_name?: string; grand_total?: number }) =>
      ipcRenderer.invoke("db:add-pending-purchase", record),
    getPendingPurchases: (opts?: { type?: string; status?: string }) =>
      ipcRenderer.invoke("db:get-pending-purchases", opts),
    updatePendingPurchase: (id: number, updates: Record<string, unknown>) =>
      ipcRenderer.invoke("db:update-pending-purchase", id, updates),
    deletePendingPurchase: (id: number) =>
      ipcRenderer.invoke("db:delete-pending-purchase", id),
    countPendingPurchases: (): Promise<number> =>
      ipcRenderer.invoke("db:count-pending-purchases"),

    addSyncId: (localId: string, serverName: string, doctype: string) =>
      ipcRenderer.invoke("db:add-sync-id", localId, serverName, doctype),
    getServerName: (localId: string): Promise<string | null> =>
      ipcRenderer.invoke("db:get-server-name", localId),

    getMeta: (key: string): Promise<string | null> =>
      ipcRenderer.invoke("db:get-meta", key),
    setMeta: (key: string, value: string) =>
      ipcRenderer.invoke("db:set-meta", key, value),

    cachePosData: (name: string, data: unknown) =>
      ipcRenderer.invoke("db:cache-pos-data", name, data),
    getCachedPosData: (name: string) =>
      ipcRenderer.invoke("db:get-cached-pos-data", name),

    cacheItemTax: (itemCode: string, company: string, data: { item_tax_template: string | null; item_tax_map: Record<string, number> }) =>
      ipcRenderer.invoke("db:cache-item-tax", itemCode, company, data),
    getCachedItemTax: (itemCode: string, company: string) =>
      ipcRenderer.invoke("db:get-cached-item-tax", itemCode, company),

    getCompanies: () => ipcRenderer.invoke("db:get-companies"),
    upsertCompanies: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-companies", rows),

    getCostCenters: (company?: string) =>
      ipcRenderer.invoke("db:get-cost-centers", company),
    upsertCostCenters: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-cost-centers", rows),

    getCountries: () => ipcRenderer.invoke("db:get-countries"),
    upsertCountries: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-countries", rows),

    getCurrencies: () => ipcRenderer.invoke("db:get-currencies"),
    upsertCurrencies: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-currencies", rows),

    getWarehouses: (opts?: { company?: string; isGroup?: boolean }) =>
      ipcRenderer.invoke("db:get-warehouses", opts),
    upsertWarehouses: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-warehouses", rows),

    getAccounts: (opts?: { company?: string; accountType?: string; rootType?: string }) =>
      ipcRenderer.invoke("db:get-accounts", opts),
    upsertAccounts: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-accounts", rows),

    getPriceLists: (selling?: boolean) =>
      ipcRenderer.invoke("db:get-price-lists", selling),
    upsertPriceLists: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-price-lists", rows),

    getUom: () => ipcRenderer.invoke("db:get-uom"),
    upsertUom: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-uom", rows),

    getUomConversions: (itemCode: string) =>
      ipcRenderer.invoke("db:get-uom-conversions", itemCode),
    upsertUomConversions: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-uom-conversions", rows),

    getBrands: () => ipcRenderer.invoke("db:get-brands"),
    upsertBrands: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-brands", rows),

    getIndustries: () => ipcRenderer.invoke("db:get-industries"),
    upsertIndustries: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-industries", rows),

    getModesOfPayment: () => ipcRenderer.invoke("db:get-modes-of-payment"),
    upsertModesOfPayment: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-modes-of-payment", rows),

    getModeOfPaymentAccounts: (company: string) =>
      ipcRenderer.invoke("db:get-mode-of-payment-accounts", company),
    upsertModeOfPaymentAccounts: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-mode-of-payment-accounts", rows),

    getItemByBarcode: (barcode: string) =>
      ipcRenderer.invoke("db:get-item-by-barcode", barcode),
    upsertItemBarcodes: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-item-barcodes", rows),

    getItemPrice: (itemCode: string, priceList: string) =>
      ipcRenderer.invoke("db:get-item-price", itemCode, priceList),
    getItemPrices: (opts?: { priceList?: string; selling?: boolean }) =>
      ipcRenderer.invoke("db:get-item-prices", opts),
    upsertItemPrices: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-item-prices", rows),

    getItemTaxTemplates: (company?: string) =>
      ipcRenderer.invoke("db:get-item-tax-templates", company),
    upsertItemTaxTemplates: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-item-tax-templates", rows),

    getItemTaxTemplateDetails: (templateName: string) =>
      ipcRenderer.invoke("db:get-item-tax-template-details", templateName),
    upsertItemTaxTemplateDetails: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-item-tax-template-details", rows),

    getItemTaxes: (itemCode: string) =>
      ipcRenderer.invoke("db:get-item-taxes", itemCode),
    upsertItemTaxes: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-item-taxes", rows),

    getItemVendors: (itemCode: string) =>
      ipcRenderer.invoke("db:get-item-vendors", itemCode),
    upsertItemVendors: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-item-vendors", rows),

    getItemReorderLevels: (itemCode: string) =>
      ipcRenderer.invoke("db:get-item-reorder-levels", itemCode),
    upsertItemReorderLevels: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-item-reorder-levels", rows),

    getPosProfiles: (company?: string) =>
      ipcRenderer.invoke("db:get-pos-profiles", company),
    getPosProfile: (name: string) =>
      ipcRenderer.invoke("db:get-pos-profile", name),
    upsertPosProfiles: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-pos-profiles", rows),

    getPosPaymentMethods: (posProfile: string) =>
      ipcRenderer.invoke("db:get-pos-payment-methods", posProfile),
    upsertPosPaymentMethods: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-pos-payment-methods", rows),

    getPosUsers: () => ipcRenderer.invoke("db:get-pos-users"),
    getPosUser: (username: string) => ipcRenderer.invoke("db:get-pos-user", username),
    upsertPosUsers: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-pos-users", rows),
    createLocalUser: (user: { username: string; password: string; fullName: string; role?: string }) =>
      ipcRenderer.invoke("db:create-local-user", user),

    getSalesTaxTemplates: (company?: string) =>
      ipcRenderer.invoke("db:get-sales-tax-templates", company),
    upsertSalesTaxTemplates: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-sales-tax-templates", rows),

    getSalesTaxCharges: (templateName: string) =>
      ipcRenderer.invoke("db:get-sales-tax-charges", templateName),
    upsertSalesTaxCharges: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-sales-tax-charges", rows),

    getPricingRules: (opts?: { company?: string; itemCode?: string }) =>
      ipcRenderer.invoke("db:get-pricing-rules", opts),
    getPricingRuleItems: (parent: string) =>
      ipcRenderer.invoke("db:get-pricing-rule-items", parent),
    getPricingRuleGroups: (parent: string) =>
      ipcRenderer.invoke("db:get-pricing-rule-groups", parent),
    getPricingRuleBrands: (parent: string) =>
      ipcRenderer.invoke("db:get-pricing-rule-brands", parent),
    upsertPricingRules: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-pricing-rules", rows),
    upsertPricingRuleItemCodes: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-pricing-rule-item-codes", rows),
    upsertPricingRuleItemGroups: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-pricing-rule-item-groups", rows),
    upsertPricingRuleBrands: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-pricing-rule-brands", rows),

    getBin: (itemCode: string, warehouse: string) =>
      ipcRenderer.invoke("db:get-bin", itemCode, warehouse),
    getBins: (warehouse?: string) =>
      ipcRenderer.invoke("db:get-bins", warehouse),
    upsertBins: (rows: Record<string, unknown>[]) =>
      ipcRenderer.invoke("db:upsert-bins", rows),

    createPosOpeningShift: (shift: Record<string, unknown>) =>
      ipcRenderer.invoke("db:create-pos-opening-shift", shift),
    getOpenShift: (user: string) =>
      ipcRenderer.invoke("db:get-open-shift", user),
    checkOpenShift: (user: string) =>
      ipcRenderer.invoke("db:check-open-shift", user),
    getOpeningData: () =>
      ipcRenderer.invoke("db:get-opening-data"),
    closePosShift: (localId: string) =>
      ipcRenderer.invoke("db:close-pos-shift", localId),
    getPosOpeningShifts: (opts?: { user?: string; status?: string }) =>
      ipcRenderer.invoke("db:get-pos-opening-shifts", opts),

    createPosClosingEntry: (entry: Record<string, unknown>) =>
      ipcRenderer.invoke("db:create-pos-closing-entry", entry),
    getPosClosingEntries: (opts?: { user?: string; status?: string }) =>
      ipcRenderer.invoke("db:get-pos-closing-entries", opts),
    getPosClosingEntryDetails: (parentId: number) =>
      ipcRenderer.invoke("db:get-pos-closing-entry-details", parentId),

    saveSalesInvoice: (invoice: Record<string, unknown>) =>
      ipcRenderer.invoke("db:save-sales-invoice", invoice),
    getSalesInvoices: (opts?: {
      customer?: string; posProfile?: string; shiftLocalId?: string;
      fromDate?: string; toDate?: string; limit?: number;
    }) => ipcRenderer.invoke("db:get-sales-invoices", opts),
    getSalesInvoice: (localId: string) =>
      ipcRenderer.invoke("db:get-sales-invoice", localId),
    getShiftSalesSummary: (shiftLocalId: string) =>
      ipcRenderer.invoke("db:get-shift-sales-summary", shiftLocalId),

    createExpense: (expense: Record<string, unknown>) =>
      ipcRenderer.invoke("db:create-expense", expense),
    getExpenses: (opts?: {
      user?: string; fromDate?: string; toDate?: string;
      shiftLocalId?: string; syncStatus?: string;
    }) => ipcRenderer.invoke("db:get-expenses", opts),
    deleteExpense: (id: number) =>
      ipcRenderer.invoke("db:delete-expense", id),

    createBankDrop: (drop: Record<string, unknown>) =>
      ipcRenderer.invoke("db:create-bank-drop", drop),
    getBankDrops: (opts?: {
      user?: string; fromDate?: string; toDate?: string;
      shiftLocalId?: string; syncStatus?: string;
    }) => ipcRenderer.invoke("db:get-bank-drops", opts),
    deleteBankDrop: (id: number) =>
      ipcRenderer.invoke("db:delete-bank-drop", id),

    createStockAdjustment: (adj: Record<string, unknown>) =>
      ipcRenderer.invoke("db:create-stock-adjustment", adj),
    getStockAdjustments: (opts?: {
      warehouse?: string; syncStatus?: string; fromDate?: string; toDate?: string;
    }) => ipcRenderer.invoke("db:get-stock-adjustments", opts),

    saveQuotation: (quotation: Record<string, unknown>) =>
      ipcRenderer.invoke("db:save-quotation", quotation),
    getQuotations: (opts?: {
      customer?: string; fromDate?: string; toDate?: string;
      status?: string; limit?: number;
    }) => ipcRenderer.invoke("db:get-quotations", opts),

    upsertTable: (table: string, rows: Record<string, unknown>[], keyField: string) =>
      ipcRenderer.invoke("db:upsert-table", table, rows, keyField),
    clearTable: (table: string) =>
      ipcRenderer.invoke("db:clear-table", table),

    clearCachedData: () => ipcRenderer.invoke("db:clear-cached-data"),
    clearAllData: () => ipcRenderer.invoke("db:clear-all-data"),
    clearPendingData: () => ipcRenderer.invoke("db:clear-pending-data"),
  },

  update: {
    check: (): Promise<{ success: boolean; version?: string; error?: string }> =>
      ipcRenderer.invoke("update:check"),
    download: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke("update:download"),
    install: (): Promise<void> => ipcRenderer.invoke("update:install"),
    onStatus: (callback: (status: Record<string, unknown>) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, status: Record<string, unknown>) =>
        callback(status);
      ipcRenderer.on("update-status", handler);
      return () => ipcRenderer.removeListener("update-status", handler);
    },
  },

  print: {
    printInvoice: (data: {
      localId: number;
      data: unknown;
      customerName: string;
      grandTotal: number;
      isReturn: boolean;
      printFormat: string;
      letterHead: string;
      companyName: string;
    }): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke("print:invoice", data),
    printReport: (html: string, options?: { landscape?: boolean; margins?: Record<string, number> }): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke("print:report", html, options),
  },

  node: {
    getRole: (): Promise<string> => ipcRenderer.invoke("node:get-role"),
    setRole: (config: {
      role: string;
      hubUrl?: string;
      tillId?: string;
      hubApiPort?: number;
      hubSecret?: string;
    }): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke("node:set-role", config),
    pingHub: (): Promise<boolean> => ipcRenderer.invoke("node:ping-hub"),
    getHubSecret: (): Promise<string | null> => ipcRenderer.invoke("node:get-hub-secret"),
    triggerTillSync: (): Promise<Record<string, unknown>> =>
      ipcRenderer.invoke("node:trigger-till-sync"),
  },
});
