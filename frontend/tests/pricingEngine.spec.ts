/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";

import {
	applyPricingRulesToCart,
	type CartPricingLine,
	type PricingContext,
	type PricingRuleSnapshot,
} from "@/services/pricingEngine";

const CTX: PricingContext = {
	company: "Test Co",
	customer: "CUST-001",
	customer_group: "Retail",
	territory: "All Territories",
	price_list: "Standard Selling",
	currency: "USD",
	warehouse: "Stores - TC",
	posting_date: "2026-08-10",
};

function rule(overrides: Partial<PricingRuleSnapshot>): PricingRuleSnapshot {
	return {
		name: "PR-001",
		apply_on: "Item Code",
		price_or_product_discount: "Price",
		rate_or_discount: "Discount Percentage",
		priority: 1,
		company: "Test Co",
		currency: "USD",
		item_codes: ["ITEM-A"],
		item_groups: [],
		brands: [],
		customer_groups: [],
		territories: [],
		warehouses: [],
		offline_supported: 1,
		...overrides,
	};
}

function line(overrides: Partial<CartPricingLine> = {}): CartPricingLine {
	return {
		row_id: "row-1",
		item_code: "ITEM-A",
		item_group: "Products",
		qty: 2,
		uom: "Nos",
		conversion_factor: 1,
		rate: 100,
		price_list_rate: 100,
		...overrides,
	};
}

describe("offline pricing engine", () => {
	describe("item-level price discounts", () => {
		it("applies a percentage discount", () => {
			const result = applyPricingRulesToCart([line()], CTX, [rule({ discount_percentage: 10 })]);

			expect(result.updates).toHaveLength(1);
			expect(result.updates[0].discount_percentage).toBe(10);
			expect(result.updates[0].discount_amount).toBe(10);
			expect(result.updates[0].rate).toBe(90);
			expect(result.updates[0].pricing_rules).toEqual(["PR-001"]);
		});

		it("applies a flat discount amount", () => {
			const result = applyPricingRulesToCart([line()], CTX, [
				rule({ rate_or_discount: "Discount Amount", discount_amount: 15 }),
			]);

			expect(result.updates[0].discount_amount).toBe(15);
			expect(result.updates[0].rate).toBe(85);
		});

		it("replaces the base rate for a Rate rule", () => {
			const result = applyPricingRulesToCart([line()], CTX, [
				rule({ rate_or_discount: "Rate", rate: 70 }),
			]);

			expect(result.updates[0].price_list_rate).toBe(70);
			expect(result.updates[0].rate).toBe(70);
			expect(result.updates[0].discount_percentage).toBe(0);
		});

		it("ignores a Rate rule in another currency, as ERPNext does", () => {
			const result = applyPricingRulesToCart([line()], CTX, [
				rule({ rate_or_discount: "Rate", rate: 70, currency: "EUR" }),
			]);

			expect(result.updates[0].price_list_rate).toBe(100);
		});

		it("returns no rules when nothing matches the item", () => {
			const result = applyPricingRulesToCart([line({ item_code: "ITEM-Z" })], CTX, [
				rule({ discount_percentage: 10 }),
			]);

			expect(result.updates[0].pricing_rules).toEqual([]);
			expect(result.updates[0].discount_percentage).toBe(0);
		});
	});

	describe("scoping", () => {
		it("matches a rule scoped to the customer's group", () => {
			const result = applyPricingRulesToCart([line()], CTX, [
				rule({ discount_percentage: 10, customer_groups: ["Retail", "Retail-VIP"] }),
			]);

			expect(result.updates[0].discount_percentage).toBe(10);
		});

		it("skips a rule scoped to a different customer group", () => {
			const result = applyPricingRulesToCart([line()], CTX, [
				rule({ discount_percentage: 10, customer_groups: ["Wholesale"] }),
			]);

			expect(result.updates[0].pricing_rules).toEqual([]);
		});

		it("skips a rule scoped to a different customer", () => {
			const result = applyPricingRulesToCart([line()], CTX, [
				rule({ discount_percentage: 10, customer: "CUST-999" }),
			]);

			expect(result.updates[0].pricing_rules).toEqual([]);
		});

		it("matches an Item Group rule via the server-expanded descendants", () => {
			const result = applyPricingRulesToCart([line()], CTX, [
				rule({
					apply_on: "Item Group",
					item_codes: [],
					item_groups: ["Products", "Products/Sub"],
					discount_percentage: 20,
				}),
			]);

			expect(result.updates[0].discount_percentage).toBe(20);
		});

		it("matches a template rule against a variant", () => {
			const result = applyPricingRulesToCart(
				[line({ item_code: "ITEM-A-RED", variant_of: "ITEM-A" })],
				CTX,
				[rule({ discount_percentage: 10 })],
			);

			expect(result.updates[0].discount_percentage).toBe(10);
		});

		it("honours validity dates", () => {
			const expired = applyPricingRulesToCart([line()], CTX, [
				rule({ discount_percentage: 10, valid_upto: "2026-08-09" }),
			]);
			expect(expired.updates[0].pricing_rules).toEqual([]);

			const notYet = applyPricingRulesToCart([line()], CTX, [
				rule({ discount_percentage: 10, valid_from: "2026-08-11" }),
			]);
			expect(notYet.updates[0].pricing_rules).toEqual([]);
		});

		it("skips a coupon rule with no coupon entered", () => {
			const result = applyPricingRulesToCart([line()], CTX, [
				rule({ discount_percentage: 10, coupon_code_based: 1 }),
			]);
			expect(result.updates[0].pricing_rules).toEqual([]);

			const withCoupon = applyPricingRulesToCart([line()], { ...CTX, coupon_code: "SAVE10" }, [
				rule({ discount_percentage: 10, coupon_code_based: 1 }),
			]);
			expect(withCoupon.updates[0].discount_percentage).toBe(10);
		});

		it("skips rules the server flagged as unsupported offline", () => {
			const result = applyPricingRulesToCart([line()], CTX, [
				rule({ discount_percentage: 10, offline_supported: 0 }),
			]);

			expect(result.updates[0].pricing_rules).toEqual([]);
		});
	});

	describe("qty and amount thresholds", () => {
		it("drops out below min_qty", () => {
			const result = applyPricingRulesToCart([line({ qty: 2 })], CTX, [
				rule({ discount_percentage: 10, min_qty: 5 }),
			]);

			expect(result.updates[0].pricing_rules).toEqual([]);
		});

		it("applies once min_qty is met", () => {
			const result = applyPricingRulesToCart([line({ qty: 5 })], CTX, [
				rule({ discount_percentage: 10, min_qty: 5 }),
			]);

			expect(result.updates[0].discount_percentage).toBe(10);
		});

		it("uses stock qty, not entered qty, for the threshold", () => {
			// 2 boxes of 6 clears a min_qty of 10 in stock UOM.
			const result = applyPricingRulesToCart([line({ qty: 2, conversion_factor: 6 })], CTX, [
				rule({ discount_percentage: 10, min_qty: 10 }),
			]);

			expect(result.updates[0].discount_percentage).toBe(10);
		});

		it("respects max_amt", () => {
			const result = applyPricingRulesToCart([line({ qty: 2, rate: 100 })], CTX, [
				rule({ discount_percentage: 10, max_amt: 150 }),
			]);

			expect(result.updates[0].pricing_rules).toEqual([]);
		});
	});

	describe("rule selection", () => {
		it("prefers the higher priority rule", () => {
			const result = applyPricingRulesToCart([line()], CTX, [
				rule({ name: "PR-LOW", priority: 1, discount_percentage: 5 }),
				rule({ name: "PR-HIGH", priority: 9, discount_percentage: 25 }),
			]);

			expect(result.updates[0].pricing_rules).toEqual(["PR-HIGH"]);
			expect(result.updates[0].discount_percentage).toBe(25);
		});

		it("prefers Item Code over Item Group", () => {
			const result = applyPricingRulesToCart([line()], CTX, [
				rule({ name: "PR-CODE", discount_percentage: 5 }),
				rule({
					name: "PR-GROUP",
					apply_on: "Item Group",
					item_codes: [],
					item_groups: ["Products"],
					discount_percentage: 30,
				}),
			]);

			expect(result.updates[0].pricing_rules).toEqual(["PR-CODE"]);
		});

		it("stacks rules that all allow multiple pricing rules", () => {
			const result = applyPricingRulesToCart([line()], CTX, [
				rule({ name: "PR-A", apply_multiple_pricing_rules: 1, priority: 1, discount_percentage: 10 }),
				rule({
					name: "PR-B",
					apply_on: "Item Group",
					item_codes: [],
					item_groups: ["Products"],
					apply_multiple_pricing_rules: 1,
					priority: 2,
					discount_percentage: 5,
				}),
			]);

			// Discounts accumulate against price_list_rate: 10% + 5% of 100 = 15.
			expect(result.updates[0].pricing_rules).toEqual(["PR-A", "PR-B"]);
			expect(result.updates[0].discount_amount).toBe(15);
			expect(result.updates[0].rate).toBe(85);
		});
	});

	describe("multiple rows of the same item", () => {
		it("keys results by row, not by item code", () => {
			const rows = [
				line({ row_id: "row-1", qty: 2 }),
				line({ row_id: "row-2", qty: 10, batch_no: "B1" } as Partial<CartPricingLine>),
			];
			const result = applyPricingRulesToCart(rows, CTX, [
				rule({ discount_percentage: 10, min_qty: 5 }),
			]);

			expect(result.updates.map((u) => u.row_id)).toEqual(["row-1", "row-2"]);
			// Only the row that clears min_qty gets the discount.
			expect(result.updates[0].pricing_rules).toEqual([]);
			expect(result.updates[1].discount_percentage).toBe(10);
		});
	});

	describe("product (free item) rules", () => {
		it("emits a free line", () => {
			const result = applyPricingRulesToCart([line()], CTX, [
				rule({
					price_or_product_discount: "Product",
					free_item: "ITEM-GIFT",
					free_item_name: "Gift",
					free_item_stock_uom: "Nos",
					free_qty: 1,
					free_item_rate: 0,
				}),
			]);

			expect(result.free_lines).toHaveLength(1);
			expect(result.free_lines[0]).toMatchObject({
				item_code: "ITEM-GIFT",
				qty: 1,
				rate: 0,
				pricing_rules: "PR-001",
				is_free_item: 1,
			});
		});

		it("uses the triggering item when same_item is set", () => {
			const result = applyPricingRulesToCart([line()], CTX, [
				rule({ price_or_product_discount: "Product", same_item: 1, free_qty: 1 }),
			]);

			expect(result.free_lines[0].item_code).toBe("ITEM-A");
		});

		it("merges free lines from the same rule across rows", () => {
			const rows = [line({ row_id: "row-1" }), line({ row_id: "row-2" })];
			const result = applyPricingRulesToCart(rows, CTX, [
				rule({ price_or_product_discount: "Product", free_item: "ITEM-GIFT", free_qty: 1 }),
			]);

			expect(result.free_lines).toHaveLength(1);
			expect(result.free_lines[0].qty).toBe(2);
		});

		it("scales a recursive rule by the qty over the threshold", () => {
			const result = applyPricingRulesToCart([line({ qty: 10 })], CTX, [
				rule({
					price_or_product_discount: "Product",
					free_item: "ITEM-GIFT",
					free_qty: 1,
					is_recursive: 1,
					recurse_for: 3,
					apply_recursion_over: 1,
					round_free_qty: 1,
				}),
			]);

			// (10 - 1) / 3 = 3 free units.
			expect(result.free_lines[0].qty).toBe(3);
		});
	});

	describe("transaction-level rules", () => {
		it("returns an invoice discount percentage", () => {
			const result = applyPricingRulesToCart([line()], CTX, [
				rule({
					name: "PR-TXN",
					apply_on: "Transaction",
					item_codes: [],
					discount_percentage: 15,
					apply_discount_on: "Grand Total",
					min_amt: 1,
				}),
			]);

			expect(result.invoice_updates).toMatchObject({
				additional_discount_percentage: 15,
				discount_amount: 0,
				apply_discount_on: "Grand Total",
				from_pricing_rule: true,
			});
		});

		it("does not fire below min_amt", () => {
			const result = applyPricingRulesToCart([line({ qty: 1, rate: 10 })], CTX, [
				rule({
					apply_on: "Transaction",
					item_codes: [],
					discount_percentage: 15,
					min_amt: 500,
				}),
			]);

			expect(result.invoice_updates.from_pricing_rule).toBe(false);
			expect(result.invoice_updates.additional_discount_percentage).toBe(0);
		});

		it("reports no discount when there are no transaction rules", () => {
			const result = applyPricingRulesToCart([line()], CTX, [rule({ discount_percentage: 10 })]);

			expect(result.invoice_updates.from_pricing_rule).toBe(false);
		});
	});
});
