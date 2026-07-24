import {
	getItemPrice,
	getPricingRules,
	getPricingRuleItems,
	getPricingRuleGroups,
	getPricingRuleBrands,
} from "@/services/dbBridge";
import { isElectron } from "@/services/electronBridge";

export interface PricingContext {
	item_code: string;
	item_group?: string;
	brand?: string;
	qty: number;
	rate: number;
	price_list_rate: number;
	price_list?: string;
	customer?: string;
	customer_group?: string;
	territory?: string;
	warehouse?: string;
	company?: string;
	coupon_code?: string;
	transaction_amount?: number;
}

export interface PricingResult {
	rate: number;
	discount_percentage: number;
	discount_amount: number;
	pricing_rule?: string;
	pricing_rule_title?: string;
	margin_type?: string;
	margin_rate_or_amount?: number;
	free_items: FreeItemResult[];
}

export interface FreeItemResult {
	item_code: string;
	qty: number;
	rate: number;
	uom?: string;
	pricing_rule: string;
}

interface PricingRule {
	name: string;
	title?: string;
	apply_on: string;
	price_or_product_discount: string;
	rate_or_discount?: string;
	selling: number;
	applicable_for?: string;
	company?: string;
	customer?: string;
	customer_group?: string;
	territory?: string;
	for_price_list?: string;
	warehouse?: string;
	min_qty: number;
	max_qty: number;
	min_amt: number;
	max_amt: number;
	valid_from?: string;
	valid_upto?: string;
	discount_percentage: number;
	discount_amount: number;
	rate: number;
	margin_type?: string;
	margin_rate_or_amount: number;
	priority: number;
	is_cumulative: number;
	coupon_code_based: number;
	same_item: number;
	free_item?: string;
	free_qty: number;
	free_item_rate: number;
	free_item_uom?: string;
	round_free_qty: number;
	is_recursive: number;
	recurse_for: number;
	apply_recursion_over: number;
	_matched_item_codes?: string[];
	_matched_item_groups?: string[];
	_matched_brands?: string[];
	_score?: number;
}

let rulesCache: PricingRule[] | null = null;
let ruleChildrenCache: Map<string, { itemCodes: string[]; itemGroups: string[]; brands: string[] }> =
	new Map();
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 1 minute

export function invalidatePricingCache(): void {
	rulesCache = null;
	ruleChildrenCache.clear();
	cacheTimestamp = 0;
}

async function loadRules(company?: string): Promise<PricingRule[]> {
	const now = Date.now();
	if (rulesCache && now - cacheTimestamp < CACHE_TTL) {
		return rulesCache;
	}

	const raw = (await getPricingRules({ company })) as PricingRule[];

	const childPromises = raw.map(async (rule) => {
		if (ruleChildrenCache.has(rule.name)) return;
		const [itemCodes, itemGroups, brands] = await Promise.all([
			rule.apply_on === "Item Code" ? getPricingRuleItems(rule.name) : Promise.resolve([]),
			rule.apply_on === "Item Group" ? getPricingRuleGroups(rule.name) : Promise.resolve([]),
			rule.apply_on === "Brand" ? getPricingRuleBrands(rule.name) : Promise.resolve([]),
		]);
		ruleChildrenCache.set(rule.name, {
			itemCodes: (itemCodes as { item_code: string }[]).map((c) => c.item_code),
			itemGroups: (itemGroups as { item_group: string }[]).map((g) => g.item_group),
			brands: (brands as { brand: string }[]).map((b) => b.brand),
		});
	});

	await Promise.all(childPromises);

	rulesCache = raw;
	cacheTimestamp = now;
	return raw;
}

export async function resolveItemPrice(
	itemCode: string,
	priceList: string,
): Promise<{ rate: number; is_price_inclusive_tax?: boolean } | null> {
	if (!isElectron()) return null;

	const price = (await getItemPrice(itemCode, priceList)) as {
		price_list_rate?: number;
		is_price_inclusive_tax?: boolean;
	} | null;

	if (!price || !price.price_list_rate) return null;

	return {
		rate: Number(price.price_list_rate),
		is_price_inclusive_tax: !!price.is_price_inclusive_tax,
	};
}

export async function applyPricingRules(ctx: PricingContext): Promise<PricingResult> {
	const result: PricingResult = {
		rate: ctx.rate,
		discount_percentage: 0,
		discount_amount: 0,
		free_items: [],
	};

	if (!isElectron()) return result;

	const allRules = await loadRules(ctx.company);
	const today = new Date().toISOString().slice(0, 10);

	const candidates = allRules.filter((rule) => {
		if (rule.valid_from && rule.valid_from > today) return false;
		if (rule.valid_upto && rule.valid_upto < today) return false;
		if (rule.coupon_code_based && !ctx.coupon_code) return false;
		if (rule.company && ctx.company && rule.company !== ctx.company) return false;
		const children = ruleChildrenCache.get(rule.name);
		if (!children) return false;

		if (rule.apply_on === "Item Code") {
			if (!children.itemCodes.includes(ctx.item_code)) return false;
		} else if (rule.apply_on === "Item Group") {
			if (!ctx.item_group || !children.itemGroups.includes(ctx.item_group)) return false;
		} else if (rule.apply_on === "Brand") {
			if (!ctx.brand || !children.brands.includes(ctx.brand)) return false;
		} else if (rule.apply_on === "Transaction") {
		} else {
			return false;
		}

		if (rule.min_qty && ctx.qty < rule.min_qty) return false;
		if (rule.max_qty && ctx.qty > rule.max_qty) return false;

		const amtBasis =
			rule.apply_on === "Transaction"
				? (ctx.transaction_amount ?? ctx.qty * ctx.price_list_rate)
				: ctx.qty * ctx.price_list_rate;
		if (rule.min_amt && amtBasis < rule.min_amt) return false;
		if (rule.max_amt && amtBasis > rule.max_amt) return false;

		if (rule.applicable_for) {
			switch (rule.applicable_for) {
				case "Customer":
					if (!ctx.customer || rule.customer !== ctx.customer) return false;
					break;
				case "Customer Group":
					if (!ctx.customer_group || rule.customer_group !== ctx.customer_group) return false;
					break;
				case "Territory":
					if (!ctx.territory || rule.territory !== ctx.territory) return false;
					break;
			}
		}

		if (rule.for_price_list && ctx.price_list && rule.for_price_list !== ctx.price_list) return false;

		if (rule.warehouse && ctx.warehouse && rule.warehouse !== ctx.warehouse) return false;

		return true;
	});

	if (candidates.length === 0) return result;

	const scored = candidates.map((rule) => {
		let score = (rule.priority || 0) * 1000;
		if (rule.apply_on === "Item Code") score += 100;
		else if (rule.apply_on === "Item Group") score += 50;
		else if (rule.apply_on === "Brand") score += 25;
		else score += 10; // Transaction

		if (rule.for_price_list) score += 150;
		if (rule.applicable_for === "Customer" && rule.customer) score += 300;
		else if (rule.applicable_for === "Customer Group" && rule.customer_group) score += 200;
		else if (rule.applicable_for === "Territory" && rule.territory) score += 100;

		return { ...rule, _score: score };
	});

	scored.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));

	for (const rule of scored) {
		if (rule.price_or_product_discount === "Product") {
			applyProductRule(rule, ctx, result);
		}
	}

	const priceRules = scored.filter((r) => r.price_or_product_discount === "Price");
	if (priceRules.length > 0) {
		const best = priceRules[0];
		const toApply = best.is_cumulative ? priceRules.filter((r) => r.is_cumulative) : [best];
		applyPriceRules(toApply, ctx, result);
	}

	return result;
}

function round2(n: number): number {
	return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Apply a set of Price pricing rules to a single line and write the resolved
 * rate/discount onto `result`.
 *
 * `rules` is either a single non-cumulative rule or the full set of cumulative
 * rules (highest-scored first). Discounts are accumulated against the original
 * price_list_rate so percentage rules stack additively (matching ERPNext) rather
 * than compounding, and the running total is rounded to cash precision so
 * stacked "Discount Amount" rules don't drift. Margin is applied once, from the
 * highest-scored rule that defines one.
 */
function applyPriceRules(rules: PricingRule[], ctx: PricingContext, result: PricingResult): void {
	if (rules.length === 0) return;

	const base = ctx.price_list_rate;
	let workingRate = base;
	let rateOverridden = false;
	let totalDiscount = 0;
	let marginRule: PricingRule | null = null;

	for (const rule of rules) {
		const discountType = rule.rate_or_discount || "Discount Percentage";

		if (discountType === "Rate") {
			if (!rateOverridden) {
				workingRate = Number(rule.rate) || 0;
				rateOverridden = true;
			}
		} else if (discountType === "Discount Percentage") {
			totalDiscount += (base * (Number(rule.discount_percentage) || 0)) / 100;
		} else if (discountType === "Discount Amount") {
			totalDiscount += Number(rule.discount_amount) || 0;
		}

		if (!marginRule && rule.margin_type && rule.margin_rate_or_amount) {
			marginRule = rule;
		}
	}

	const top = rules[0];
	result.pricing_rule = top.name;
	result.pricing_rule_title = top.title || top.name;

	totalDiscount = round2(totalDiscount);
	let rate = workingRate - totalDiscount;

	result.discount_amount = round2(base - rate);
	result.discount_percentage = base > 0 ? round2((result.discount_amount / base) * 100) : 0;

	if (marginRule) {
		const marginValue = Number(marginRule.margin_rate_or_amount);
		result.margin_type = marginRule.margin_type;
		result.margin_rate_or_amount = marginValue;
		if (marginRule.margin_type === "Percentage") {
			rate = rate * (1 + marginValue / 100);
		} else if (marginRule.margin_type === "Amount") {
			rate += marginValue;
		}
	}

	result.rate = rate < 0 ? 0 : rate;
}

function applyProductRule(rule: PricingRule, ctx: PricingContext, result: PricingResult): void {
	const freeItemCode = rule.same_item ? ctx.item_code : rule.free_item;
	if (!freeItemCode) return;

	let freeQty = Number(rule.free_qty) || 0;

	if (rule.is_recursive && rule.recurse_for > 0 && rule.apply_recursion_over > 0) {
		const eligibleQty = ctx.qty - rule.apply_recursion_over;
		if (eligibleQty <= 0) return;
		freeQty = Math.floor(eligibleQty / rule.recurse_for) * freeQty;
	}

	if (rule.round_free_qty) {
		freeQty = Math.round(freeQty);
	}

	if (freeQty <= 0) return;

	result.free_items.push({
		item_code: freeItemCode,
		qty: freeQty,
		rate: Number(rule.free_item_rate) || 0,
		uom: rule.free_item_uom || undefined,
		pricing_rule: rule.name,
	});
}

export interface CartPricingItem {
	item_code: string;
	item_group?: string;
	brand?: string;
	qty: number;
	rate: number;
	price_list_rate: number;
}

export async function applyPricingRulesToCart(
	cartItems: CartPricingItem[],
	opts: {
		price_list?: string;
		customer?: string;
		customer_group?: string;
		territory?: string;
		warehouse?: string;
		company?: string;
		coupon_code?: string;
	},
): Promise<Map<string, PricingResult>> {
	const results = new Map<string, PricingResult>();

	const transactionAmount = cartItems.reduce((sum, item) => sum + item.qty * item.price_list_rate, 0);

	for (const item of cartItems) {
		const ctx: PricingContext = {
			...item,
			...opts,
			transaction_amount: transactionAmount,
		};
		const pricingResult = await applyPricingRules(ctx);
		results.set(item.item_code, pricingResult);
	}

	return results;
}
