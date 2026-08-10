/**
 * Builders for `reconcile_line_prices` responses and offline rule snapshots.
 *
 * Shapes match xpos/api/pricing_rules.py exactly - the point of these specs is
 * that the cart reacts correctly to what the real endpoint returns.
 */

export interface LineUpdate {
	row_id: string;
	item_code: string;
	price_list_rate: number;
	rate: number;
	discount_percentage: number;
	discount_amount: number;
	margin_type: string | null;
	margin_rate_or_amount: number;
	pricing_rules: string[];
}

export interface CartLine {
	row_id: string;
	item_code: string;
	rate: number;
	qty: number;
	price_list_rate?: number;
	pricing_rules?: string;
}

export function parseCartPayload(args: Record<string, unknown>): {
	context: Record<string, unknown>;
	lines: CartLine[];
} {
	const payload = JSON.parse(String(args.cart_payload || "{}"));
	return { context: payload.context || {}, lines: payload.lines || [] };
}

export interface ReconcileOptions {
	/** Item codes the rule applies to. Omit for "every line". */
	items?: string[];
	discountPercentage?: number;
	discountAmount?: number;
	/** A `rate_or_discount = "Rate"` rule, which replaces the base price. */
	fixedRate?: number;
	ruleName?: string;
	/** Lines only qualify at or above this quantity. */
	minQty?: number;
	freeItems?: {
		item_code: string;
		item_name?: string;
		qty?: number;
		rate?: number;
		pricing_rules?: string;
	}[];
	transaction?: {
		additional_discount_percentage?: number;
		discount_amount?: number;
		apply_discount_on?: string;
	};
}

/**
 * Build a `reconcile_line_prices` handler that applies `options` to matching
 * lines and leaves the rest at list price - the same contract the server has.
 */
export function reconcileWith(options: ReconcileOptions = {}) {
	const ruleName = options.ruleName || "PR-TEST";

	return (args: Record<string, unknown>) => {
		const { lines } = parseCartPayload(args);

		const updates: LineUpdate[] = lines.map((line) => {
			const qualifies =
				(!options.items || options.items.includes(line.item_code)) &&
				(options.minQty === undefined || Number(line.qty) >= options.minQty) &&
				(options.discountPercentage !== undefined ||
					options.discountAmount !== undefined ||
					options.fixedRate !== undefined);

			const listRate = Number(line.price_list_rate ?? line.rate);

			if (!qualifies) {
				return {
					row_id: line.row_id,
					item_code: line.item_code,
					price_list_rate: listRate,
					rate: listRate,
					discount_percentage: 0,
					discount_amount: 0,
					margin_type: null,
					margin_rate_or_amount: 0,
					pricing_rules: [],
				};
			}

			if (options.fixedRate !== undefined) {
				return {
					row_id: line.row_id,
					item_code: line.item_code,
					price_list_rate: options.fixedRate,
					rate: options.fixedRate,
					discount_percentage: 0,
					discount_amount: 0,
					margin_type: null,
					margin_rate_or_amount: 0,
					pricing_rules: [ruleName],
				};
			}

			const pct = options.discountPercentage ?? 0;
			const amount = options.discountAmount ?? (listRate * pct) / 100;

			return {
				row_id: line.row_id,
				item_code: line.item_code,
				price_list_rate: listRate,
				rate: Number((listRate - amount).toFixed(2)),
				discount_percentage: pct,
				discount_amount: Number(amount.toFixed(2)),
				margin_type: null,
				margin_rate_or_amount: 0,
				pricing_rules: [ruleName],
			};
		});

		return {
			updates,
			free_lines: (options.freeItems || []).map((free) => ({
				item_code: free.item_code,
				item_name: free.item_name || free.item_code,
				qty: free.qty ?? 1,
				uom: "Nos",
				stock_uom: "Nos",
				conversion_factor: 1,
				rate: free.rate ?? 0,
				price_list_rate: free.rate ?? 0,
				pricing_rules: free.pricing_rules || ruleName,
				is_free_item: 1,
			})),
			invoice_updates: {
				additional_discount_percentage: options.transaction?.additional_discount_percentage ?? 0,
				discount_amount: options.transaction?.discount_amount ?? 0,
				apply_discount_on: options.transaction?.apply_discount_on ?? "Grand Total",
				from_pricing_rule: Boolean(
					options.transaction?.additional_discount_percentage ||
						options.transaction?.discount_amount,
				),
			},
		};
	};
}

/** An offline snapshot entry, as `get_active_pricing_rules` returns it. */
export function ruleSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		name: "PR-OFFLINE",
		title: "Offline Test Rule",
		apply_on: "Item Code",
		price_or_product_discount: "Price",
		rate_or_discount: "Discount Percentage",
		discount_percentage: 10,
		priority: 1,
		company: "Test Co",
		currency: "USD",
		item_codes: ["ITEM-A"],
		item_groups: [],
		brands: [],
		customer_groups: [],
		territories: [],
		warehouses: [],
		valid_from: null,
		valid_upto: null,
		offline_supported: 1,
		...overrides,
	};
}
