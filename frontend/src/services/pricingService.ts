/**
 * Resolves Pricing Rule outcomes for the cart.
 *
 * Online, the server does the work: `reconcile_line_prices` drives ERPNext's own
 * engine over the same in-memory invoice the save path builds, so the cart total
 * and the saved invoice cannot disagree. Offline, the local engine takes over
 * using a snapshot cached while the terminal was still connected.
 *
 * Both paths return the identical shape, so callers never branch on which ran -
 * only on `source`, which the cart surfaces to the cashier.
 */

import { call, isNetworkError } from "@/services/api";
import { cachePricingRules, getCustomer } from "@/services/dbBridge";
import {
	applyPricingRulesToCart,
	loadPricingRuleSnapshot,
	type CartPricingLine,
	type CartPricingResult,
	type PricingContext,
	type PricingRuleSnapshot,
} from "@/services/pricingEngine";
import { isOnline } from "@/utils";

export type PricingSource = "server" | "offline" | "unavailable";

export interface ResolvedCartPricing extends CartPricingResult {
	source: PricingSource;
}

export interface CartPricingRequest {
	lines: CartPricingLine[];
	context: PricingContext & { pos_profile?: string; conversion_rate?: number };
}

const EMPTY_TRANSACTION = {
	additional_discount_percentage: 0,
	discount_amount: 0,
	apply_discount_on: "Grand Total",
	from_pricing_rule: false,
};

function emptyResult(source: PricingSource): ResolvedCartPricing {
	return { updates: [], free_lines: [], invoice_updates: { ...EMPTY_TRANSACTION }, source };
}

async function withCustomerScope(
	context: CartPricingRequest["context"],
): Promise<CartPricingRequest["context"]> {
	if (!context.customer || (context.customer_group && context.territory)) return context;

	try {
		const cached = (await getCustomer(context.customer)) as
			| { customer_group?: string; territory?: string }
			| null
			| undefined;
		if (cached) {
			return {
				...context,
				customer_group: context.customer_group || cached.customer_group,
				territory: context.territory || cached.territory,
			};
		}
	} catch {}
	return context;
}

async function resolveOffline(request: CartPricingRequest): Promise<ResolvedCartPricing> {
	const posProfile = request.context.pos_profile || "";
	const rules = await loadPricingRuleSnapshot(posProfile);
	if (!rules.length) return emptyResult("unavailable");

	const context = await withCustomerScope(request.context);
	return { ...applyPricingRulesToCart(request.lines, context, rules), source: "offline" };
}

/**
 * Price a cart. Never throws: pricing is an enhancement to the cart, and a
 * failure here must not stop the cashier from ringing up a sale.
 */
export async function resolveCartPricing(request: CartPricingRequest): Promise<ResolvedCartPricing> {
	if (!request.lines.length) return emptyResult("server");

	if (isOnline()) {
		try {
			const result = await call<CartPricingResult>("xpos.api.pricing_rules.reconcile_line_prices", {
				cart_payload: JSON.stringify({ context: request.context, lines: request.lines }),
			});
			return {
				updates: result?.updates || [],
				free_lines: result?.free_lines || [],
				invoice_updates: result?.invoice_updates || { ...EMPTY_TRANSACTION },
				source: "server",
			};
		} catch (error) {
			if (!isNetworkError(error)) {
				console.error("Pricing rule reconciliation failed:", error);
				return emptyResult("unavailable");
			}
			// Dropped mid-request - fall through to the offline engine.
		}
	}

	return resolveOffline(request);
}

/**
 * Pull the rule snapshot the offline engine needs and cache it.
 *
 * Called while the terminal is still online (POS boot, and after each successful
 * server reconcile) so the cache is already warm when the network goes away.
 */
export async function refreshPricingRuleSnapshot(context: {
	pos_profile?: string;
	company?: string;
	price_list?: string;
	currency?: string;
}): Promise<PricingRuleSnapshot[]> {
	const posProfile = context.pos_profile;
	if (!posProfile || !context.company || !isOnline()) return [];

	try {
		const rules = await call<PricingRuleSnapshot[]>("xpos.api.pricing_rules.get_active_pricing_rules", {
			params: JSON.stringify({
				pos_profile: posProfile,
				company: context.company,
				price_list: context.price_list,
				currency: context.currency,
			}),
		});
		await cachePricingRules(posProfile, rules || []);
		return rules || [];
	} catch (error) {
		if (!isNetworkError(error)) {
			console.warn("Could not refresh pricing rule snapshot:", error);
		}
		return [];
	}
}
