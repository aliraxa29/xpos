/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@/services/api", () => ({
	call: vi.fn(),
	default: { call: vi.fn() },
}));

vi.mock("@/services/dbBridge", () => ({
	getCachedItemByCode: vi.fn(async () => null),
	getCachedStockForItem: vi.fn(async () => null),
}));

vi.mock("@/stores/posStore", () => ({
	usePosStore: vi.fn(() => ({
		taxes: [],
		taxInclusiveMode: false,
		profileName: "POS-PROFILE-1",
		companyName: "Test Co",
		sellingPriceList: "Standard Selling",
		warehouse: "Stores - TC",
		currency: "USD",
		currencySymbol: "$",
		disableRoundedTotal: true,
		allowChangePostingDate: false,
		blockSaleBeyondAvailableQty: false,
		stockSettings: { allow_negative_stock: true },
	})),
}));

const resolveCartPricing = vi.fn();
const refreshPricingRuleSnapshot = vi.fn(async () => []);

vi.mock("@/services/pricingService", () => ({
	resolveCartPricing: (...args: unknown[]) => resolveCartPricing(...args),
	refreshPricingRuleSnapshot: (...args: unknown[]) => refreshPricingRuleSnapshot(...args),
}));

import { call } from "@/services/api";
import { useCartStore } from "@/stores/cartStore";
import type { POSItem } from "@/types/pos.types";

const mockedCall = vi.mocked(call);

function pricingResponse(overrides: Record<string, unknown> = {}) {
	return {
		updates: [],
		free_lines: [],
		invoice_updates: {
			additional_discount_percentage: 0,
			discount_amount: 0,
			apply_discount_on: "Grand Total",
			from_pricing_rule: false,
		},
		source: "server",
		...overrides,
	};
}

function posItem(overrides: Partial<POSItem> = {}): POSItem {
	return {
		item_code: "ITEM-A",
		item_name: "Item A",
		rate: 100,
		uom: "Nos",
		stock_uom: "Nos",
		item_group: "Products",
		is_stock_item: false,
		...overrides,
	} as POSItem;
}

describe("cart pricing rules", () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
		resolveCartPricing.mockResolvedValue(pricingResponse());
	});

	describe("row identity", () => {
		it("gives every row a stable uid", () => {
			const cart = useCartStore();
			cart.setCustomer({ name: "CUST-001" });
			cart.addItem(posItem());
			cart.addItemWithDetails(posItem(), 3, 100, "Nos", "", "BATCH-1");

			const uids = cart.items.map((i) => i.uid);
			expect(uids.every(Boolean)).toBe(true);
			expect(new Set(uids).size).toBe(2);
		});

		it("carries item_group and brand onto the row for rule matching", () => {
			const cart = useCartStore();
			cart.addItem(posItem({ item_group: "Beverages", brand: "Acme" }));

			expect(cart.items[0].item_group).toBe("Beverages");
			expect(cart.items[0].brand).toBe("Acme");
		});

		it("sends each line keyed as row_id, matching what the server echoes back", async () => {
			// The server reads `row_id` and falls back to item_code when it is
			// missing, so a differently named field makes every result silently
			// fail to match its row - and no discount is ever applied.
			const cart = useCartStore();
			cart.addItem(posItem());
			await cart.applyPricingRules();

			const { lines } = resolveCartPricing.mock.calls.at(-1)![0] as {
				lines: Record<string, unknown>[];
			};
			expect(lines[0]).toHaveProperty("row_id");
			expect(lines[0].row_id).toBe(cart.items[0].uid);
			// The gross rate is what create_invoice treats as price_list_rate.
			expect(lines[0].price_list_rate).toBe(100);
		});
	});

	describe("applying rule discounts", () => {
		it("applies a discount returned by the server", async () => {
			const cart = useCartStore();
			cart.addItem(posItem());
			const uid = cart.items[0].uid!;

			resolveCartPricing.mockResolvedValue(
				pricingResponse({
					updates: [
						{
							row_id: uid,
							item_code: "ITEM-A",
							price_list_rate: 100,
							rate: 90,
							discount_percentage: 10,
							discount_amount: 10,
							margin_type: null,
							margin_rate_or_amount: 0,
							pricing_rules: ["PR-001"],
						},
					],
				}),
			);

			await cart.applyPricingRules();

			// The cart keeps the gross rate and expresses the rule as a discount.
			expect(cart.items[0].rate).toBe(100);
			expect(cart.items[0].discount_percentage).toBe(10);
			expect(cart.items[0].pos_pricing_rules).toEqual(["PR-001"]);
			expect(cart.subtotal).toBe(90);
		});

		it("clears its own discount once the rule stops matching", async () => {
			const cart = useCartStore();
			cart.addItem(posItem());
			const uid = cart.items[0].uid!;

			resolveCartPricing.mockResolvedValue(
				pricingResponse({
					updates: [
						{
							row_id: uid,
							item_code: "ITEM-A",
							price_list_rate: 100,
							rate: 90,
							discount_percentage: 10,
							discount_amount: 10,
							margin_type: null,
							margin_rate_or_amount: 0,
							pricing_rules: ["PR-001"],
						},
					],
				}),
			);
			await cart.applyPricingRules();
			expect(cart.items[0].discount_percentage).toBe(10);

			resolveCartPricing.mockResolvedValue(
				pricingResponse({
					updates: [
						{
							row_id: uid,
							item_code: "ITEM-A",
							price_list_rate: 100,
							rate: 100,
							discount_percentage: 0,
							discount_amount: 0,
							margin_type: null,
							margin_rate_or_amount: 0,
							pricing_rules: [],
						},
					],
				}),
			);
			await cart.applyPricingRules();

			expect(cart.items[0].discount_percentage).toBe(0);
			expect(cart.items[0].pos_pricing_rules).toEqual([]);
		});

		it("leaves a manual discount alone when no rule applies", async () => {
			const cart = useCartStore();
			cart.addItem(posItem());
			cart.updateItemDiscount(0, "percentage", 25);

			await cart.applyPricingRules();

			expect(cart.items[0].discount_percentage).toBe(25);
		});

		it("does not overwrite a rate the cashier typed in", async () => {
			const cart = useCartStore();
			cart.addItem(posItem());
			cart.updateItemRate(0, 80);
			const uid = cart.items[0].uid!;

			resolveCartPricing.mockResolvedValue(
				pricingResponse({
					updates: [
						{
							row_id: uid,
							item_code: "ITEM-A",
							price_list_rate: 70,
							rate: 70,
							discount_percentage: 0,
							discount_amount: 0,
							margin_type: null,
							margin_rate_or_amount: 0,
							pricing_rules: ["PR-RATE"],
						},
					],
				}),
			);
			await cart.applyPricingRules();

			expect(cart.items[0].rate).toBe(80);
		});

		it("adopts a Rate rule's price when the cashier has not overridden it", async () => {
			const cart = useCartStore();
			cart.addItem(posItem());
			const uid = cart.items[0].uid!;

			resolveCartPricing.mockResolvedValue(
				pricingResponse({
					updates: [
						{
							row_id: uid,
							item_code: "ITEM-A",
							price_list_rate: 70,
							rate: 70,
							discount_percentage: 0,
							discount_amount: 0,
							margin_type: null,
							margin_rate_or_amount: 0,
							pricing_rules: ["PR-RATE"],
						},
					],
				}),
			);
			await cart.applyPricingRules();

			expect(cart.items[0].rate).toBe(70);
		});

		it("discards a response that a newer request has superseded", async () => {
			const cart = useCartStore();
			cart.addItem(posItem());
			const uid = cart.items[0].uid!;

			let releaseSlow: (v: unknown) => void = () => {};
			const slow = new Promise((resolve) => {
				releaseSlow = resolve;
			});

			resolveCartPricing.mockImplementationOnce(async () => {
				await slow;
				return pricingResponse({
					updates: [
						{
							row_id: uid,
							item_code: "ITEM-A",
							price_list_rate: 100,
							rate: 50,
							discount_percentage: 50,
							discount_amount: 50,
							margin_type: null,
							margin_rate_or_amount: 0,
							pricing_rules: ["PR-STALE"],
						},
					],
				});
			});
			resolveCartPricing.mockImplementationOnce(async () =>
				pricingResponse({
					updates: [
						{
							row_id: uid,
							item_code: "ITEM-A",
							price_list_rate: 100,
							rate: 95,
							discount_percentage: 5,
							discount_amount: 5,
							margin_type: null,
							margin_rate_or_amount: 0,
							pricing_rules: ["PR-FRESH"],
						},
					],
				}),
			);

			const stalePromise = cart.applyPricingRules();
			await cart.applyPricingRules();
			releaseSlow(null);
			await stalePromise;

			expect(cart.items[0].pos_pricing_rules).toEqual(["PR-FRESH"]);
			expect(cart.items[0].discount_percentage).toBe(5);
		});

		it("skips pricing entirely in return mode", async () => {
			const cart = useCartStore();
			cart.addItem(posItem());
			cart.enterReturnMode("SINV-001");

			await cart.applyPricingRules();

			expect(resolveCartPricing).not.toHaveBeenCalled();
		});
	});

	describe("free items", () => {
		it("adds a free line and marks it", async () => {
			const cart = useCartStore();
			cart.addItem(posItem());

			resolveCartPricing.mockResolvedValue(
				pricingResponse({
					free_lines: [
						{
							item_code: "ITEM-GIFT",
							item_name: "Gift",
							qty: 1,
							uom: "Nos",
							stock_uom: "Nos",
							conversion_factor: 1,
							rate: 0,
							price_list_rate: 0,
							pricing_rules: "PR-FREE",
							is_free_item: 1,
						},
					],
				}),
			);
			await cart.applyPricingRules();

			const free = cart.items.find((i) => i.pos_is_free_item);
			expect(free).toBeTruthy();
			expect(free!.item_code).toBe("ITEM-GIFT");
			expect(free!.rate).toBe(0);
			expect(free!.pos_free_item_rule).toBe("PR-FREE");
		});

		it("removes the free line when the rule stops applying", async () => {
			const cart = useCartStore();
			cart.addItem(posItem());

			resolveCartPricing.mockResolvedValue(
				pricingResponse({
					free_lines: [
						{
							item_code: "ITEM-GIFT",
							item_name: "Gift",
							qty: 1,
							uom: "Nos",
							stock_uom: "Nos",
							conversion_factor: 1,
							rate: 0,
							price_list_rate: 0,
							pricing_rules: "PR-FREE",
							is_free_item: 1,
						},
					],
				}),
			);
			await cart.applyPricingRules();
			expect(cart.items.filter((i) => i.pos_is_free_item)).toHaveLength(1);

			resolveCartPricing.mockResolvedValue(pricingResponse());
			await cart.applyPricingRules();

			expect(cart.items.filter((i) => i.pos_is_free_item)).toHaveLength(0);
		});

		it("sends free lines to the invoice with the fields ERPNext reconciles on", async () => {
			const cart = useCartStore();
			cart.setCustomer({ name: "CUST-001" });
			cart.addItem(posItem());

			resolveCartPricing.mockResolvedValue(
				pricingResponse({
					free_lines: [
						{
							item_code: "ITEM-GIFT",
							item_name: "Gift",
							qty: 1,
							uom: "Nos",
							stock_uom: "Nos",
							conversion_factor: 1,
							rate: 0,
							price_list_rate: 0,
							pricing_rules: "PR-FREE",
							is_free_item: 1,
						},
					],
				}),
			);
			await cart.applyPricingRules();

			const payload = cart.getInvoiceData("POS-PROFILE-1", "SHIFT-1");
			const freeRow = payload.items.find((i) => i.item_code === "ITEM-GIFT");
			expect(freeRow).toMatchObject({ is_free_item: 1, pricing_rules: "PR-FREE" });

			// Priced rows must not be flagged, or ERPNext will treat them as free.
			const pricedRow = payload.items.find((i) => i.item_code === "ITEM-A");
			expect(pricedRow!.is_free_item).toBeUndefined();
		});

		it("excludes free lines from the next pricing request", async () => {
			const cart = useCartStore();
			cart.addItem(posItem());

			resolveCartPricing.mockResolvedValue(
				pricingResponse({
					free_lines: [
						{
							item_code: "ITEM-GIFT",
							item_name: "Gift",
							qty: 1,
							uom: "Nos",
							stock_uom: "Nos",
							conversion_factor: 1,
							rate: 0,
							price_list_rate: 0,
							pricing_rules: "PR-FREE",
							is_free_item: 1,
						},
					],
				}),
			);
			await cart.applyPricingRules();
			await cart.applyPricingRules();

			const lastCall = resolveCartPricing.mock.calls.at(-1)![0] as { lines: { item_code: string }[] };
			expect(lastCall.lines.map((l) => l.item_code)).toEqual(["ITEM-A"]);
		});
	});

	describe("transaction-level discount", () => {
		it("applies an invoice discount from a rule", async () => {
			const cart = useCartStore();
			cart.addItem(posItem());

			resolveCartPricing.mockResolvedValue(
				pricingResponse({
					invoice_updates: {
						additional_discount_percentage: 15,
						discount_amount: 0,
						apply_discount_on: "Grand Total",
						from_pricing_rule: true,
					},
				}),
			);
			await cart.applyPricingRules();

			expect(cart.discountPercentage).toBe(15);
			expect(cart.applyDiscountOn).toBe("Grand Total");
		});

		it("clears its own invoice discount when the rule stops applying", async () => {
			const cart = useCartStore();
			cart.addItem(posItem());

			resolveCartPricing.mockResolvedValue(
				pricingResponse({
					invoice_updates: {
						additional_discount_percentage: 15,
						discount_amount: 0,
						apply_discount_on: "Grand Total",
						from_pricing_rule: true,
					},
				}),
			);
			await cart.applyPricingRules();

			resolveCartPricing.mockResolvedValue(pricingResponse());
			await cart.applyPricingRules();

			expect(cart.discountPercentage).toBe(0);
		});

		it("does not clear a discount the cashier entered", async () => {
			const cart = useCartStore();
			cart.addItem(posItem());
			cart.setDiscount("percentage", 20);

			await cart.applyPricingRules();

			expect(cart.discountPercentage).toBe(20);
		});

		it("applies a Net Total discount to the pre-tax base", async () => {
			const cart = useCartStore();
			cart.addItem(posItem()); // 1 x 100

			resolveCartPricing.mockResolvedValue(
				pricingResponse({
					invoice_updates: {
						additional_discount_percentage: 10,
						discount_amount: 0,
						apply_discount_on: "Net Total",
						from_pricing_rule: true,
					},
				}),
			);
			await cart.applyPricingRules();

			expect(cart.applyDiscountOn).toBe("Net Total");
			expect(cart.grandTotal).toBe(90);
		});
	});

	describe("reloading a saved draft", () => {
		// ERPNext stores a *net* rate plus the discount; the cart stores a gross
		// rate plus the discount. Reading `rate` back verbatim applied the discount
		// twice, so a reloaded draft under-charged.
		const draft = {
			name: "SINV-001",
			customer: "CUST-001",
			customer_name: "Test Customer",
			posting_date: "2026-08-10",
			items: [
				{
					item_code: "ITEM-A",
					item_name: "Item A",
					qty: 2,
					rate: 90, // net
					price_list_rate: 100, // gross
					amount: 180,
					uom: "Nos",
					discount_percentage: 10,
					discount_amount: 10,
					is_free_item: 0,
					pricing_rules: '["PR-001"]',
				},
			],
		};

		it("uses the gross rate so the discount is not applied twice", async () => {
			const cart = useCartStore();
			mockedCall.mockResolvedValue(draft as never);

			await cart.loadDraftInvoice("SINV-001");

			expect(cart.items[0].rate).toBe(100);
			expect(cart.items[0].discount_percentage).toBe(10);
			// 2 x 100 less 10% = 180, matching the invoice amount.
			expect(cart.subtotal).toBe(180);
		});

		it("restores the rule marker so a later reconcile can clear it", async () => {
			const cart = useCartStore();
			mockedCall.mockResolvedValue(draft as never);

			await cart.loadDraftInvoice("SINV-001");

			expect(cart.items[0].pos_pricing_rules).toEqual(["PR-001"]);
		});

		it("restores a free line as a free line", async () => {
			const cart = useCartStore();
			mockedCall.mockResolvedValue({
				...draft,
				items: [
					...draft.items,
					{
						item_code: "ITEM-GIFT",
						item_name: "Gift",
						qty: 1,
						rate: 0,
						price_list_rate: 0,
						amount: 0,
						uom: "Nos",
						discount_percentage: 0,
						discount_amount: 0,
						is_free_item: 1,
						pricing_rules: "PR-FREE",
					},
				],
			} as never);

			await cart.loadDraftInvoice("SINV-001");

			const free = cart.items.find((i) => i.item_code === "ITEM-GIFT");
			expect(free!.pos_is_free_item).toBe(true);
			expect(free!.pos_free_item_rule).toBe("PR-FREE");
		});

		it("still works against an older server that sends no price_list_rate", async () => {
			const cart = useCartStore();
			mockedCall.mockResolvedValue({
				...draft,
				items: [{ ...draft.items[0], price_list_rate: undefined }],
			} as never);

			await cart.loadDraftInvoice("SINV-001");

			expect(cart.items[0].rate).toBe(90);
		});
	});

	describe("pricing source", () => {
		it("records that prices came from the offline engine", async () => {
			const cart = useCartStore();
			cart.addItem(posItem());

			resolveCartPricing.mockResolvedValue(pricingResponse({ source: "offline" }));
			await cart.applyPricingRules();

			expect(cart.pricingSource).toBe("offline");
		});

		it("leaves prices untouched when pricing is unavailable", async () => {
			const cart = useCartStore();
			cart.addItem(posItem());
			cart.updateItemDiscount(0, "percentage", 25);

			resolveCartPricing.mockResolvedValue(pricingResponse({ source: "unavailable" }));
			await cart.applyPricingRules();

			expect(cart.items[0].discount_percentage).toBe(25);
		});
	});
});
