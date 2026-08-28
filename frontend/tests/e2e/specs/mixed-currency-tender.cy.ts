import {
	BASE_CURRENCY,
	CASH_LBP,
	CASH_USD,
	CHANGE_DUE,
	CURRENCIES,
	INVOICE_TOTAL,
	NUT_ITEM,
	RATE,
	TENDER_CURRENCY,
	mixedCurrencyRoutes,
} from "../fixtures/mixedCurrency";
import { lastCallTo } from "../support/frappeStub";

const CREATE_INVOICE = "xpos.api.invoices.create_invoice";
const CLOSE_SHIFT = "xpos.api.shifts.close_shift";

interface SentPayment {
	mode_of_payment: string;
	amount: number;
	pos_tender_currency?: string;
	pos_tender_amount?: number;
	pos_exchange_rate?: number;
}

interface SentChangeLeg {
	mode_of_payment: string;
	currency: string;
	amount: number;
	base_amount: number;
}

/** The invoice payload the till actually posted. */
function sentInvoice(): {
	payments?: SentPayment[];
	pos_change_legs?: SentChangeLeg[];
	change_amount?: number;
} {
	const call = lastCallTo(CREATE_INVOICE);
	expect(call, "create_invoice was called").to.not.equal(undefined);
	return JSON.parse(String(call!.args.data));
}

function bootMixedCurrencyPos(routes: Record<string, unknown> = mixedCurrencyRoutes()) {
	cy.bootPos({
		routes,
		// The nut store's catalogue replaces the default one, and LBP has to arrive with its
		// zero-decimal number format or every amount would render at two.
		readyItem: NUT_ITEM.item_name,
		currencies: CURRENCIES,
	});
}

function openPaymentDialog() {
	cy.window().then((win) => {
		win.dispatchEvent(new CustomEvent("xpos:process-payment"));
	});
	cy.get("[role='dialog']").should("be.visible");
}

/** Type a native amount against a payment mode. */
function tender(mode: string, amount: number) {
	cy.get(`[data-testid='payment-method'][data-mode='${mode}']`).click();
	cy.get("[role='dialog'] input[type='text'],[role='dialog'] input[type='number']")
		.first()
		.clear()
		.type(String(amount));
}

describe("mixed-currency tender - taking foreign notes", () => {
	beforeEach(() => {
		bootMixedCurrencyPos();
		cy.addItemToCart(NUT_ITEM.item_name);
		openPaymentDialog();
	});

	it("shows what a USD note converts to at today's rate", () => {
		tender(CASH_USD, 100);

		// 100 x 90,000. LBP is zero-decimal, so no phantom cents anywhere on the line.
		cy.contains("[role='dialog']", "9,000,000").should("be.visible");
		cy.contains("[role='dialog']", "90,000").should("be.visible");
		cy.contains("[role='dialog']", "9,000,000.00").should("not.exist");
	});

	it("computes the change due in the invoice currency", () => {
		tender(CASH_USD, 100);

		cy.contains("[role='dialog']", "3,107,700").should("be.visible");
	});

	it("sends the native figure alongside the invoice-currency amount", () => {
		tender(CASH_USD, 100);
		cy.get("[data-testid='save-payment']").click();

		cy.then(() => {
			const invoice = sentInvoice();
			const usd = (invoice.payments || []).find((p) => p.mode_of_payment === CASH_USD);

			expect(usd, "the USD payment row").to.not.equal(undefined);
			// `amount` must be the invoice-currency value: ERPNext sums it into paid_amount.
			expect(usd!.amount).to.equal(9000000);
			expect(usd!.pos_tender_currency).to.equal(TENDER_CURRENCY);
			expect(usd!.pos_tender_amount).to.equal(100);
			expect(usd!.pos_exchange_rate).to.equal(RATE);
		});
	});
});

describe("mixed-currency tender - splitting the change", () => {
	beforeEach(() => {
		bootMixedCurrencyPos();
		cy.addItemToCart(NUT_ITEM.item_name);
		openPaymentDialog();
		tender(CASH_USD, 100);
	});

	it("seeds a single change leg in the invoice currency", () => {
		cy.get("[data-testid='change-leg']").should("have.length", 1);
		cy.get("[data-testid='change-leg']").first().should("have.attr", "data-currency", BASE_CURRENCY);
	});

	it("splits change across two currencies and keeps the total intact", () => {
		// Hand back $30, leaving 407,700 LBP.
		cy.get("[data-testid='change-leg']")
			.first()
			.find("input[data-testid='change-leg-input']")
			.clear()
			.type("407700")
			.blur();
		cy.get(`[data-testid='add-change-leg'][data-mode='${CASH_USD}']`).click();

		cy.get("[data-testid='change-leg']").should("have.length", 2);
		cy.get(`[data-testid='change-leg'][data-currency='${TENDER_CURRENCY}']`).should("exist");
		cy.get(`[data-testid='change-leg'][data-currency='${BASE_CURRENCY}']`).should("exist");
	});

	it("posts one change leg per currency, summing to the change due", () => {
		cy.get("[data-testid='change-leg']")
			.first()
			.find("input[data-testid='change-leg-input']")
			.clear()
			.type("407700")
			.blur();
		cy.get(`[data-testid='add-change-leg'][data-mode='${CASH_USD}']`).click();
		cy.get("[data-testid='save-payment']").click();

		cy.then(() => {
			const invoice = sentInvoice();
			const legs = invoice.pos_change_legs || [];

			expect(legs).to.have.length(2);

			const usdLeg = legs.find((l) => l.currency === TENDER_CURRENCY)!;
			const lbpLeg = legs.find((l) => l.currency === BASE_CURRENCY)!;

			expect(usdLeg.amount).to.equal(30);
			expect(usdLeg.base_amount).to.equal(2700000);
			expect(lbpLeg.amount).to.equal(407700);

			// The legs must account for exactly the change ERPNext computed, or the server throws.
			const allocated = legs.reduce((sum, leg) => sum + leg.base_amount, 0);
			expect(allocated).to.equal(CHANGE_DUE);
		});
	});
});

describe("mixed-currency tender - closing the shift", () => {
	beforeEach(() => {
		bootMixedCurrencyPos();
		cy.window().then((win) => {
			win.dispatchEvent(new CustomEvent("xpos:close-shift"));
		});
		cy.contains("[role='dialog']", "Close Shift").should("be.visible");
	});

	it("asks for each drawer in its own currency, never a blended figure", () => {
		cy.get("[data-testid='closing-row']").should("have.length", 2);

		cy.get(`[data-testid='closing-row'][data-mode='${CASH_USD}']`)
			.find("[data-testid='closing-currency']")
			.should("contain", TENDER_CURRENCY);
		cy.get(`[data-testid='closing-row'][data-mode='${CASH_LBP}']`)
			.find("[data-testid='closing-currency']")
			.should("contain", BASE_CURRENCY);
	});

	it("counts USD in dollars and LBP in whole pounds", () => {
		// 200 float + 100 in - 30 back.
		cy.get(`[data-testid='closing-row'][data-mode='${CASH_USD}']`)
			.find("[data-testid='closing-expected']")
			.should("contain", "270.00");

		// 1,000,000 float - 407,700 back. Zero-decimal, so no cents.
		cy.get(`[data-testid='closing-row'][data-mode='${CASH_LBP}']`)
			.find("[data-testid='closing-expected']")
			.should("contain", "592,300")
			.should("not.contain", "592,300.00");
	});

	it("reports a shortfall in the counted currency's own units", () => {
		cy.get(`[data-testid='closing-row'][data-mode='${CASH_USD}']`)
			.find("input[data-testid='closing-input']")
			.clear()
			.type("250")
			.blur();

		cy.get(`[data-testid='closing-row'][data-mode='${CASH_USD}']`)
			.find("[data-testid='closing-difference']")
			.should("contain", "-20.00");
	});

	it("sends each mode's counted amount with its currency", () => {
		cy.contains("[role='dialog'] button", "Close Shift").click();

		cy.then(() => {
			const details = JSON.parse(String(lastCallTo(CLOSE_SHIFT)?.args.closing_details));
			const usd = details.find((d: { mode_of_payment: string }) => d.mode_of_payment === CASH_USD);
			const lbp = details.find((d: { mode_of_payment: string }) => d.mode_of_payment === CASH_LBP);

			expect(usd.currency).to.equal(TENDER_CURRENCY);
			expect(usd.expected_amount).to.equal(270);
			expect(lbp.currency).to.equal(BASE_CURRENCY);
			expect(lbp.expected_amount).to.equal(592300);
		});
	});
});

describe("mixed-currency tender - the gate", () => {
	it("hides the change allocator when the profile has not opted in", () => {
		const routes = mixedCurrencyRoutes();
		const shift = routes["xpos.api.shifts.check_open_shift"] as Record<string, any>;
		bootMixedCurrencyPos({
			...routes,
			"xpos.api.shifts.check_open_shift": {
				...shift,
				pos_profile: { ...shift.pos_profile, pos_mixed_currency_tender: 0 },
			},
		});
		cy.addItemToCart(NUT_ITEM.item_name);
		openPaymentDialog();
		tender(CASH_LBP, INVOICE_TOTAL + 100000);

		cy.get("[data-testid='change-leg']").should("not.exist");
	});
});
