import {
	PACKAGED_ITEM,
	PLAIN_BARCODE,
	SCALE_BARCODE,
	SCALE_BARCODE_HEAVIER,
	SCALE_WEIGHT,
	SCALE_WEIGHT_HEAVIER,
	UNKNOWN_BARCODE,
	WEIGHED_ITEM,
	scaleBarcodeRoutes,
	scaleShift,
} from "../fixtures/scaleBarcode";
import { callsTo } from "../support/frappeStub";

const SEARCH_BARCODE = "xpos.api.items.search_barcode";

function bootScalePos(routes: Record<string, unknown> = scaleBarcodeRoutes()) {
	cy.bootPos({ routes, readyItem: WEIGHED_ITEM.item_name });
}

describe("scale barcodes - selling by weight", () => {
	beforeEach(() => {
		bootScalePos();
	});

	it("adds the weighed item at the weight the scale encoded, not one unit", () => {
		cy.scanBarcode(SCALE_BARCODE);

		cy.cartRows().should("have.length", 1);
		cy.cartRow(WEIGHED_ITEM.item_name)
			.find("input[data-testid='cart-qty']")
			.should("have.value", String(SCALE_WEIGHT));
	});

	it("charges rate x weight, not rate x 1", () => {
		cy.scanBarcode(SCALE_BARCODE);

		// 4,000 a kilo at 0.205 kg is 820.
		cy.cartRow(WEIGHED_ITEM.item_name).find("[data-testid='cart-amount']").should("contain", "820");
	});

	it("sends the raw barcode to the server and lets it do the decoding", () => {
		cy.scanBarcode(SCALE_BARCODE);
		cy.cartRows().should("have.length", 1);

		cy.then(() => {
			const calls = callsTo(SEARCH_BARCODE);
			expect(calls).to.have.length(1);
			expect(calls[0].args.barcode).to.equal(SCALE_BARCODE);
		});
	});

	it("keeps the item's own unit of measure", () => {
		cy.scanBarcode(SCALE_BARCODE);

		cy.cartRow(WEIGHED_ITEM.item_name).should("contain", WEIGHED_ITEM.stock_uom);
	});

	it("clears the scanner input so the next label can be scanned straight away", () => {
		cy.scanBarcode(SCALE_BARCODE);
		cy.cartRows().should("have.length", 1);

		cy.get("[data-testid='barcode-input']").should("have.value", "");
	});
});

describe("scale barcodes - two weighings", () => {
	beforeEach(() => {
		bootScalePos();
	});

	it("treats a second weighing of the same item as more weight, not a second unit", () => {
		cy.scanBarcode(SCALE_BARCODE);
		cy.cartRows().should("have.length", 1);
		cy.scanBarcode(SCALE_BARCODE_HEAVIER);

		// Both bags are the same item, so the line accumulates rather than splitting.
		cy.cartRows().should("have.length", 1);
		cy.cartRow(WEIGHED_ITEM.item_name)
			.find("input[data-testid='cart-qty']")
			.should("have.value", String(SCALE_WEIGHT + SCALE_WEIGHT_HEAVIER));
	});
});

describe("scale barcodes - the ordinary paths still work", () => {
	beforeEach(() => {
		bootScalePos();
	});

	it("adds a plain barcode as a single unit", () => {
		cy.scanBarcode(PLAIN_BARCODE);

		cy.cartRow(PACKAGED_ITEM.item_name).find("input[data-testid='cart-qty']").should("have.value", "1");
	});

	it("reports an unknown barcode and adds nothing", () => {
		cy.scanBarcode(UNKNOWN_BARCODE);

		cy.contains(UNKNOWN_BARCODE).should("be.visible");
		cy.cartRows().should("have.length", 0);
	});

	it("refuses to add anything before a customer is chosen", () => {
		cy.bootPos({
			routes: scaleBarcodeRoutes(),
			readyItem: WEIGHED_ITEM.item_name,
			skipCustomer: true,
		});
		cy.scanBarcode(SCALE_BARCODE);

		cy.contains(/select a customer/i).should("be.visible");
		cy.cartRows().should("have.length", 0);
	});
});

describe("scale barcodes - skipping the quantity prompt", () => {
	it("adds the weight directly even when the profile asks for quantity on every item", () => {
		// `input_qty` normally opens the detail dialog so the cashier can key a quantity. A scale
		// barcode already names one concrete weight, so there is nothing left to ask.
		bootScalePos({
			...scaleBarcodeRoutes(),
			"xpos.api.shifts.check_open_shift": scaleShift({ input_qty: 1 }),
		});
		cy.scanBarcode(SCALE_BARCODE);

		cy.cartRow(WEIGHED_ITEM.item_name)
			.find("input[data-testid='cart-qty']")
			.should("have.value", String(SCALE_WEIGHT));
	});
});
