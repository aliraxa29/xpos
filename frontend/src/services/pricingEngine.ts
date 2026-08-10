/**
 * Offline Pricing Rule engine.
 *
 * The cart normally asks the server to price it, because only ERPNext's own
 * engine is guaranteed to match what the invoice will store on save. When the
 * network is gone this module takes over, evaluating a snapshot of the active
 * rules that was cached while the terminal was still online.
 */

import { getCachedPricingRules } from "@/services/dbBridge";

export interface PricingRuleSnapshot {
	name: string;
	title?: string;
	apply_on: string;
	price_or_product_discount: string;
	rate_or_discount?: string;
	apply_discount_on?: string;
	priority?: number | string;
	apply_multiple_pricing_rules?: number;
	apply_discount_on_rate?: number;
	coupon_code_based?: number;
	company?: string;
	currency?: string;
	for_price_list?: string;
	applicable_for?: string;
	customer?: string;
	min_qty?: number;
	max_qty?: number;
	min_amt?: number;
	max_amt?: number;
	valid_from?: string | null;
	valid_upto?: string | null;
	rate?: number;
	discount_percentage?: number;
	discount_amount?: number;
	margin_type?: string;
	margin_rate_or_amount?: number;
	same_item?: number;
	free_item?: string;
	free_qty?: number;
	free_item_uom?: string;
	free_item_rate?: number;
	is_recursive?: number;
	recurse_for?: number;
	apply_recursion_over?: number;
	round_free_qty?: number;
	customer_groups?: string[];
	territories?: string[];
	warehouses?: string[];
	item_codes?: string[];
	item_groups?: string[];
	brands?: string[];
	free_item_name?: string | null;
	free_item_stock_uom?: string | null;
	offline_supported?: number;
}

export interface CartPricingLine {
	row_id: string;
	item_code: string;
	item_group?: string;
	brand?: string;
	variant_of?: string;
	qty: number;
	uom?: string;
	conversion_factor?: number;
	rate: number;
	price_list_rate?: number;
	warehouse?: string;
	pricing_rules?: string;
}

export interface PricingContext {
	company?: string;
	customer?: string;
	customer_group?: string;
	territory?: string;
	price_list?: string;
	currency?: string;
	warehouse?: string;
	coupon_code?: string;
	posting_date?: string;
}

export interface LinePricing {
	row_id: string;
	item_code: string;
	price_list_rate: number;
	rate: number;
	discount_percentage: number;
	discount_amount: number;
	margin_type?: string | null;
	margin_rate_or_amount: number;
	pricing_rules: string[];
}

export interface FreeItemLine {
	item_code: string;
	item_name?: string | null;
	qty: number;
	uom?: string | null;
	stock_uom?: string | null;
	conversion_factor: number;
	rate: number;
	price_list_rate: number;
	pricing_rules: string;
	is_free_item: 1;
}

export interface TransactionPricing {
	additional_discount_percentage: number;
	discount_amount: number;
	apply_discount_on: string;
	from_pricing_rule: boolean;
}

export interface CartPricingResult {
	updates: LinePricing[];
	free_lines: FreeItemLine[];
	invoice_updates: TransactionPricing;
}

const APPLY_ON_ORDER = ["Item Code", "Item Group", "Brand"] as const;

function flt(value: unknown): number {
	const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
	return Number.isFinite(n) ? n : 0;
}

function round(value: number, precision = 2): number {
	const factor = 10 ** precision;
	return Math.round((value + Number.EPSILON) * factor) / factor;
}

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

export async function loadPricingRuleSnapshot(posProfile: string): Promise<PricingRuleSnapshot[]> {
	if (!posProfile) return [];
	try {
		const cached = await getCachedPricingRules(posProfile);
		return (cached as PricingRuleSnapshot[] | null) ?? [];
	} catch {
		return [];
	}
}

function matchesScope(rule: PricingRuleSnapshot, ctx: PricingContext, date: string): boolean {
	if (rule.offline_supported === 0) return false;

	if (rule.valid_from && rule.valid_from > date) return false;
	if (rule.valid_upto && rule.valid_upto < date) return false;

	if (rule.company && ctx.company && rule.company !== ctx.company) return false;
	if (rule.for_price_list && rule.for_price_list !== (ctx.price_list || "")) return false;
	if (rule.customer && rule.customer !== (ctx.customer || "")) return false;

	if (rule.customer_groups?.length) {
		if (!ctx.customer_group || !rule.customer_groups.includes(ctx.customer_group)) return false;
	}
	if (rule.territories?.length) {
		if (!ctx.territory || !rule.territories.includes(ctx.territory)) return false;
	}

	if (rule.coupon_code_based && !ctx.coupon_code) return false;

	return true;
}

function matchesLine(rule: PricingRuleSnapshot, line: CartPricingLine, ctx: PricingContext): boolean {
	if (rule.warehouses?.length) {
		const warehouse = line.warehouse || ctx.warehouse;
		if (!warehouse || !rule.warehouses.includes(warehouse)) return false;
	}

	if (rule.apply_on === "Item Code") {
		const codes = rule.item_codes || [];
		return codes.includes(line.item_code) || (!!line.variant_of && codes.includes(line.variant_of));
	}
	if (rule.apply_on === "Item Group") {
		return !!line.item_group && (rule.item_groups || []).includes(line.item_group);
	}
	if (rule.apply_on === "Brand") {
		return !!line.brand && (rule.brands || []).includes(line.brand);
	}
	return false;
}

function withinQtyAndAmount(rule: PricingRuleSnapshot, stockQty: number, amount: number): boolean {
	if (rule.min_qty && stockQty < flt(rule.min_qty)) return false;
	if (rule.max_qty && stockQty > flt(rule.max_qty)) return false;
	if (rule.min_amt && amount < flt(rule.min_amt)) return false;
	if (rule.max_amt && amount > flt(rule.max_amt)) return false;
	return true;
}

function selectForLine(candidates: PricingRuleSnapshot[], ctx: PricingContext): PricingRuleSnapshot[] {
	if (!candidates.length) return [];

	let byLevel: PricingRuleSnapshot[] = [];
	for (const applyOn of APPLY_ON_ORDER) {
		const level = candidates.filter((r) => r.apply_on === applyOn);
		if (!level.length) continue;
		byLevel = byLevel.concat(level);
		if (!byLevel.every((r) => r.apply_multiple_pricing_rules)) break;
	}
	if (!byLevel.length) return [];

	if (byLevel.every((r) => r.apply_multiple_pricing_rules)) {
		return [...byLevel].sort((a, b) => Number(a.priority || 1) - Number(b.priority || 1));
	}

	let best = byLevel;
	const maxPriority = Math.max(...best.map((r) => Number(r.priority || 0)));
	if (maxPriority) {
		best = best.filter((r) => Number(r.priority || 0) === maxPriority);
	}
	if (best.length > 1 && ctx.currency) {
		const sameCurrency = best.filter((r) => r.currency === ctx.currency);
		if (sameCurrency.length) best = sameCurrency;
	}
	if (best.length > 1 && ctx.price_list) {
		const samePriceList = best.filter((r) => r.for_price_list === ctx.price_list);
		if (samePriceList.length) best = samePriceList;
	}
	return best.slice(0, 1);
}

function applyPriceRules(
	rules: PricingRuleSnapshot[],
	line: CartPricingLine,
	ctx: PricingContext,
	result: LinePricing,
): void {
	for (const rule of rules) {
		const type = rule.rate_or_discount || "";

		if (
			rule.margin_type === "Percentage" ||
			(rule.margin_type === "Amount" && rule.currency === ctx.currency)
		) {
			result.margin_type = rule.margin_type;
			result.margin_rate_or_amount = rule.apply_multiple_pricing_rules
				? result.margin_rate_or_amount + flt(rule.margin_rate_or_amount)
				: flt(rule.margin_rate_or_amount);
		}

		if (type === "Rate") {
			if (rule.currency === ctx.currency && flt(rule.rate)) {
				result.price_list_rate = flt(rule.rate);
			}
			result.discount_percentage = 0;
		} else if (type === "Discount Percentage") {
			if (rule.apply_discount_on_rate && result.discount_percentage) {
				result.discount_percentage +=
					(100 - result.discount_percentage) * (flt(rule.discount_percentage) / 100);
				result.discount_amount = result.price_list_rate * (result.discount_percentage / 100);
			} else if (result.price_list_rate) {
				result.discount_amount += result.price_list_rate * (flt(rule.discount_percentage) / 100);
				result.discount_percentage = (result.discount_amount / result.price_list_rate) * 100;
			}
		} else if (type === "Discount Amount") {
			if (rule.apply_discount_on_rate && result.discount_amount) {
				result.discount_amount +=
					(result.price_list_rate - result.discount_amount) * (flt(rule.discount_amount) / 100);
			} else {
				result.discount_amount += flt(rule.discount_amount);
			}
		}
	}

	if (result.price_list_rate) {
		result.rate = round(result.price_list_rate * (1 - result.discount_percentage / 100));
		if (result.discount_amount) {
			result.rate = round(result.price_list_rate - result.discount_amount);
		}
	}
	result.discount_amount = round(result.discount_amount);
	result.discount_percentage = round(result.discount_percentage);
	result.price_list_rate = round(result.price_list_rate);
}

function buildFreeItem(
	rule: PricingRuleSnapshot,
	line: CartPricingLine | null,
	triggerQty: number,
): FreeItemLine | null {
	const freeItemCode = rule.same_item && rule.apply_on !== "Transaction" ? line?.item_code : rule.free_item;
	if (!freeItemCode) return null;

	let qty = flt(rule.free_qty) || 1;

	if (rule.is_recursive) {
		const eligible = triggerQty - flt(rule.apply_recursion_over);
		if (eligible <= 0) return null;
		const recurseFor = flt(rule.recurse_for) || 1;
		qty = rule.round_free_qty
			? Math.floor(eligible / recurseFor) * (flt(rule.free_qty) || 1)
			: (eligible * qty) / recurseFor;
	}

	if (qty <= 0) return null;

	const sameItem = rule.same_item && rule.apply_on !== "Transaction";
	return {
		item_code: freeItemCode,
		item_name: sameItem ? null : rule.free_item_name,
		qty,
		uom: rule.free_item_uom || (sameItem ? line?.uom : rule.free_item_stock_uom) || null,
		stock_uom: sameItem ? null : rule.free_item_stock_uom,
		conversion_factor: 1,
		rate: flt(rule.free_item_rate),
		price_list_rate: flt(rule.free_item_rate),
		pricing_rules: rule.name,
		is_free_item: 1,
	};
}

function applyTransactionRules(
	rules: PricingRuleSnapshot[],
	ctx: PricingContext,
	totalQty: number,
	total: number,
	freeLines: FreeItemLine[],
): TransactionPricing {
	const result: TransactionPricing = {
		additional_discount_percentage: 0,
		discount_amount: 0,
		apply_discount_on: "Grand Total",
		from_pricing_rule: false,
	};

	const candidates = rules
		.filter((r) => r.apply_on === "Transaction" && withinQtyAndAmount(r, totalQty, total))
		.sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));

	for (const rule of candidates) {
		if (rule.price_or_product_discount === "Price") {
			if (rule.apply_discount_on) result.apply_discount_on = rule.apply_discount_on;
			if (flt(rule.discount_percentage)) {
				result.additional_discount_percentage = flt(rule.discount_percentage);
				result.from_pricing_rule = true;
			} else if (flt(rule.discount_amount)) {
				result.discount_amount = flt(rule.discount_amount);
				result.from_pricing_rule = true;
			}
		} else if (rule.price_or_product_discount === "Product") {
			const free = buildFreeItem(rule, null, totalQty);
			if (free) freeLines.push(free);
		}
	}

	if (result.additional_discount_percentage) result.discount_amount = 0;

	return result;
}

export function applyPricingRulesToCart(
	lines: CartPricingLine[],
	ctx: PricingContext,
	rules: PricingRuleSnapshot[],
): CartPricingResult {
	const date = ctx.posting_date || today();
	const inScope = rules.filter((rule) => matchesScope(rule, ctx, date));

	const updates: LinePricing[] = [];
	const freeLines: FreeItemLine[] = [];
	const freeByKey = new Map<string, FreeItemLine>();

	let totalQty = 0;
	let total = 0;

	for (const line of lines) {
		const qty = Math.abs(flt(line.qty));
		const conversionFactor = flt(line.conversion_factor) || 1;
		const stockQty = qty * conversionFactor;
		const priceListRate = flt(line.price_list_rate ?? line.rate);
		const amount = priceListRate * qty;

		const result: LinePricing = {
			row_id: line.row_id,
			item_code: line.item_code,
			price_list_rate: priceListRate,
			rate: flt(line.rate),
			discount_percentage: 0,
			discount_amount: 0,
			margin_type: null,
			margin_rate_or_amount: 0,
			pricing_rules: [],
		};

		const candidates = inScope.filter(
			(rule) => matchesLine(rule, line, ctx) && withinQtyAndAmount(rule, stockQty, amount),
		);
		const selected = selectForLine(candidates, ctx);

		const priceRules = selected.filter((r) => r.price_or_product_discount === "Price");
		if (priceRules.length) {
			applyPriceRules(priceRules, line, ctx, result);
		}

		for (const rule of selected) {
			if (rule.price_or_product_discount !== "Product") continue;
			const free = buildFreeItem(rule, line, qty);
			if (!free) continue;
			const key = `${free.item_code}::${free.pricing_rules}`;
			const existing = freeByKey.get(key);
			if (existing) {
				existing.qty += free.qty;
			} else {
				freeByKey.set(key, free);
				freeLines.push(free);
			}
		}

		result.pricing_rules = selected.map((r) => r.name);
		updates.push(result);

		totalQty += qty;
		total += (result.rate || priceListRate) * qty;
	}

	const invoiceUpdates = applyTransactionRules(inScope, ctx, totalQty, round(total), freeLines);

	return { updates, free_lines: freeLines, invoice_updates: invoiceUpdates };
}
