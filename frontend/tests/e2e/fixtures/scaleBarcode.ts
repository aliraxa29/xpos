import { CUSTOMER_IN_GROUP, ITEM_GROUPS, POS_PROFILE_DOC, defaultRoutes } from "./pos";

export const SCALE_BARCODE = "2001001002053";
export const SCALE_WEIGHT = 0.205;

/** A second weighing of the same item, at a different weight. */
export const SCALE_BARCODE_HEAVIER = "2001001008502";
export const SCALE_WEIGHT_HEAVIER = 0.85;

export const PLAIN_BARCODE = "5901234123457";
export const UNKNOWN_BARCODE = "9999999999999";

export const WEIGHED_ITEM = {
	item_code: "001001",
	item_name: "Cashews Loose",
	item_group: "Beverages",
	brand: "Acme",
	stock_uom: "Kg",
	uom: "Kg",
	rate: 4000,
	actual_qty: 120,
	is_stock_item: 1,
	has_batch_no: 0,
	has_serial_no: 0,
	has_variants: 0,
	max_discount: 0,
	image: "",
};

export const PACKAGED_ITEM = {
	...WEIGHED_ITEM,
	item_code: "PKG-1",
	item_name: "Roasted Almonds 200g",
	stock_uom: "Nos",
	uom: "Nos",
	rate: 950,
};

export const ITEMS = [WEIGHED_ITEM, PACKAGED_ITEM];

/** What `search_barcode` returns for a scale barcode: the item, plus the weight it encoded. */
function scaleHit(qty: number) {
	return {
		...WEIGHED_ITEM,
		barcode: SCALE_BARCODE,
		qty,
		is_scale_barcode: true,
		scale_price: null,
	};
}

/** An ordinary barcode carries no quantity, so the cart adds one unit. */
function plainHit() {
	return {
		...PACKAGED_ITEM,
		barcode: PLAIN_BARCODE,
		is_scale_barcode: false,
	};
}

export const BARCODE_RESULTS: Record<string, unknown> = {
	[SCALE_BARCODE]: scaleHit(SCALE_WEIGHT),
	[SCALE_BARCODE_HEAVIER]: { ...scaleHit(SCALE_WEIGHT_HEAVIER), barcode: SCALE_BARCODE_HEAVIER },
	[PLAIN_BARCODE]: plainHit(),
};

export function scaleBarcodeRoutes(): Record<string, unknown> {
	return {
		...defaultRoutes(),
		"xpos.api.shifts.check_open_shift": scaleShift(),
		"xpos.api.items.get_pos_items": ITEMS,
		"xpos.api.items.get_items_count": ITEMS.length,
		"xpos.api.items.get_item_groups": ITEM_GROUPS,
		"xpos.api.items.get_stock_availability": ITEMS.map((item) => ({
			item_code: item.item_code,
			actual_qty: item.actual_qty,
		})),
		"xpos.api.items.get_item_detail": (args: Record<string, unknown>) => {
			const item = ITEMS.find((i) => i.item_code === args.item_code) || WEIGHED_ITEM;
			return {
				...item,
				uoms: [{ uom: item.stock_uom, conversion_factor: 1 }],
				batches: [],
				serial_numbers: [],
			};
		},
		// An unrecognised barcode returns null, which is what the "not found" path keys on.
		"xpos.api.items.search_barcode": (args: Record<string, unknown>) =>
			BARCODE_RESULTS[String(args.barcode)] ?? null,
	};
}

/** The shift payload, with the weighed catalogue and any profile overrides applied. */
export function scaleShift(profileOverrides: Record<string, unknown> = {}) {
	return {
		pos_opening_shift: {
			name: "POS-OS-0012",
			pos_profile: POS_PROFILE_DOC.name,
			company: POS_PROFILE_DOC.company,
			status: "Open",
			user: "cashier@example.com",
			period_start_date: "2026-08-17 09:00:00",
			posting_date: "2026-08-17",
			balance_details: [{ mode_of_payment: "Cash", opening_amount: 0 }],
		},
		pos_profile: { ...POS_PROFILE_DOC, customer: CUSTOMER_IN_GROUP.name, ...profileOverrides },
		company: {
			name: POS_PROFILE_DOC.company,
			default_currency: POS_PROFILE_DOC.currency,
			company_name: POS_PROFILE_DOC.company,
		},
		is_cashier: true,
		stock_settings: { allow_negative_stock: true },
		disable_rounded_total: 1,
		taxes: [],
		tax_inclusive: 0,
		print_settings: { print_format: "POS Invoice" },
	};
}
