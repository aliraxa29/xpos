/**
 * Open tabs: recalling a draft raised on another shift, and settling a past
 * credit sale.
 *
 * The scenario these specs protect is a bar: a customer opens a tab, the
 * bartender's shift ends, and the next bartender has to be able to reach that tab
 * from their own session. Everything here is stubbed at the API boundary, so what
 * is under test is the screen - the scope toggle, what it asks the server for, and
 * what it does with the answer.
 */

import {
	FOREIGN_TAB,
	OWN_TAB,
	PERMISSIONS,
	POS_PROFILE_DOC,
	OPEN_SHIFT,
	UNPAID_FULL,
	UNPAID_PARTIAL,
} from "../fixtures/pos";
import { lastCallTo, callsTo, stubError } from "../support/frappeStub";

const DRAFTS = "xpos.api.invoices.get_draft_invoices";
const OUTSTANDING = "xpos.api.payments.get_outstanding_invoices";
const SETTLE = "xpos.api.payments.settle_outstanding_invoice";
const SAVE_DRAFT = "xpos.api.invoices.save_draft_invoice";

/** Boot with one of the two open-tab gates turned off. */
function bootWithout(overrides: {
	profileFlags?: Record<string, number>;
	permissions?: Record<string, boolean>;
}) {
	cy.bootPos({
		routes: {
			"xpos.api.shifts.check_open_shift": {
				...OPEN_SHIFT,
				pos_profile: { ...POS_PROFILE_DOC, ...(overrides.profileFlags || {}) },
			},
			"xpos.api.auth.get_my_pos_permissions": {
				...PERMISSIONS,
				...(overrides.permissions || {}),
			},
		},
	});
}

describe("open tabs - recalling a draft across shifts", () => {
	it("lists only the current shift's tabs by default", () => {
		cy.bootPos();
		cy.openRecallDialog();

		cy.get("[data-testid='open-tab-row']").should("have.length", 1);
		cy.contains(OWN_TAB.name).should("be.visible");
		cy.contains(FOREIGN_TAB.name).should("not.exist");

		cy.then(() => {
			expect(lastCallTo(DRAFTS)?.args.scope).to.equal("shift");
		});
	});

	it("widens to every shift on the profile when asked", () => {
		cy.bootPos();
		cy.openRecallDialog();

		cy.get("[data-testid='recall-scope-profile']").click();

		cy.get("[data-testid='open-tab-row']").should("have.length", 2);
		cy.contains(FOREIGN_TAB.name).should("be.visible");

		cy.then(() => {
			expect(lastCallTo(DRAFTS)?.args.scope).to.equal("profile");
		});
	});

	it("badges a tab that belongs to another shift", () => {
		cy.bootPos();
		cy.openRecallDialog();
		cy.get("[data-testid='recall-scope-profile']").click();

		cy.contains("[data-testid='open-tab-row']", FOREIGN_TAB.name)
			.find("[data-testid='foreign-tab-badge']")
			.should("contain", FOREIGN_TAB.owner);

		cy.contains("[data-testid='open-tab-row']", OWN_TAB.name)
			.find("[data-testid='foreign-tab-badge']")
			.should("not.exist");
	});

	it("hides the scope toggle when the POS Profile has not opted in", () => {
		bootWithout({ profileFlags: { allow_open_tab_recall: 0 } });
		cy.openRecallDialog();

		cy.get("[data-testid='recall-scope-profile']").should("not.exist");
		cy.get("[data-testid='open-tab-row']").should("have.length", 1);
	});

	it("hides the scope toggle when the role does not grant it", () => {
		bootWithout({ permissions: { recall_other_shift_tabs: false } });
		cy.openRecallDialog();

		cy.get("[data-testid='recall-scope-profile']").should("not.exist");
	});

	it("filters the list by invoice or customer", () => {
		cy.bootPos();
		cy.openRecallDialog();
		cy.get("[data-testid='recall-scope-profile']").click();
		cy.get("[data-testid='open-tab-row']").should("have.length", 2);

		cy.get("[data-testid='recall-search']").type(FOREIGN_TAB.customer_name);

		cy.get("[data-testid='open-tab-row']").should("have.length", 1);
		cy.contains(FOREIGN_TAB.name).should("be.visible");
	});

	it("loads another shift's tab into the cart", () => {
		cy.bootPos();
		cy.openRecallDialog();
		cy.get("[data-testid='recall-scope-profile']").click();

		cy.contains("[data-testid='open-tab-row']", FOREIGN_TAB.name).click();

		cy.get("[role='dialog']").should("not.exist");
		cy.cartRows().should("have.length", 2);
		cy.cartRow("Filter Papers").should("contain", "Filter Papers");
		cy.contains(FOREIGN_TAB.customer_name).should("be.visible");
	});

	it("sends the tab's name and concurrency token back when it is held again", () => {
		cy.bootPos();
		cy.openRecallDialog();
		cy.get("[data-testid='recall-scope-profile']").click();
		cy.contains("[data-testid='open-tab-row']", FOREIGN_TAB.name).click();
		cy.cartRows().should("have.length", 2);

		cy.get("[data-testid='hold-order']:visible").first().click();

		cy.then(() => {
			const payload = JSON.parse(String(lastCallTo(SAVE_DRAFT)?.args.data || "{}"));
			expect(payload.name).to.equal(FOREIGN_TAB.name);
			// Without this the server cannot tell a stale save from a fresh one.
			expect(payload.modified).to.equal(FOREIGN_TAB.modified);
		});
	});

	it("keeps the cart when another terminal changed the tab first", () => {
		cy.bootPos();
		cy.openRecallDialog();
		cy.get("[data-testid='recall-scope-profile']").click();
		cy.contains("[data-testid='open-tab-row']", FOREIGN_TAB.name).click();
		cy.cartRows().should("have.length", 2);

		cy.then(() => {
			stubError(
				SAVE_DRAFT,
				"This tab was changed on another terminal. Reload it and try again.",
				"TimestampMismatchError",
			);
		});

		cy.get("[data-testid='hold-order']:visible").first().click();

		// The conflict branch ran, not the generic failure branch: the recall dialog
		// is reopened so the cashier can pull a fresh copy of the tab.
		cy.contains("[role='dialog']", "Recall Order").should("be.visible");
		cy.contains("Failed to save draft").should("not.exist");
		cy.contains("changed on another terminal").should("exist");
		// The cashier's lines survive - losing them is the failure this guards.
		cy.cartRows().should("have.length", 2);
	});

	it("tells the server which shift is deleting a tab", () => {
		cy.bootPos();
		cy.openRecallDialog();

		cy.window().then((win) => cy.stub(win, "confirm").returns(true));
		cy.contains("[data-testid='open-tab-row']", OWN_TAB.name)
			.find("button")
			.first()
			.click({ force: true });

		cy.then(() => {
			const args = lastCallTo("xpos.api.invoices.delete_draft_invoice")?.args;
			expect(args?.name).to.equal(OWN_TAB.name);
			expect(args?.pos_opening_shift).to.equal(OWN_TAB.pos_opening_shift);
		});
	});
});

describe("open tabs - settling a past credit sale", () => {
	function openUnpaidTab() {
		cy.openRecallDialog();
		cy.get("[data-testid='recall-tab-unpaid']").click();
	}

	it("lists submitted invoices that still carry a balance", () => {
		cy.bootPos();
		openUnpaidTab();

		cy.get("[data-testid='unpaid-invoice-row']").should("have.length", 2);
		cy.contains(UNPAID_FULL.name).should("be.visible");
		cy.contains("[data-testid='unpaid-invoice-row']", UNPAID_PARTIAL.name).should(
			"contain",
			UNPAID_PARTIAL.outstanding_amount.toFixed(2),
		);
	});

	it("asks the server for every customer's unpaid invoices, not just the cart's", () => {
		cy.bootPos();
		openUnpaidTab();

		cy.then(() => {
			const args = lastCallTo(OUTSTANDING)?.args;
			expect(args?.customer).to.equal(undefined);
			expect(args?.pos_profile).to.equal(POS_PROFILE_DOC.name);
		});
	});

	it("pushes the search to the server", () => {
		cy.bootPos();
		openUnpaidTab();
		cy.get("[data-testid='unpaid-invoice-row']").should("have.length", 2);

		cy.get("[data-testid='recall-search']").type(UNPAID_PARTIAL.customer_name);

		cy.get("[data-testid='unpaid-invoice-row']").should("have.length", 1);
		cy.then(() => {
			expect(lastCallTo(OUTSTANDING)?.args.search_term).to.equal(UNPAID_PARTIAL.customer_name);
		});
	});

	it("settles an invoice against the current shift", () => {
		cy.bootPos();
		openUnpaidTab();

		cy.contains("[data-testid='unpaid-invoice-row']", UNPAID_PARTIAL.name).click();
		cy.contains("[role='dialog']", "Settle Invoice").should("be.visible");
		cy.get("[data-testid='settle-confirm']").click();

		cy.then(() => {
			const args = lastCallTo(SETTLE)?.args;
			expect(args?.invoice).to.equal(UNPAID_PARTIAL.name);
			// Pre-filled with the full balance, and never more than it.
			expect(args?.amount).to.equal(UNPAID_PARTIAL.outstanding_amount);
			// This is what puts the cash in the cashier's closing shift.
			expect(args?.pos_opening_shift).to.equal(OWN_TAB.pos_opening_shift);
			expect(args?.mode_of_payment).to.equal("Cash");
		});
	});

	it("refreshes the list once an invoice is settled", () => {
		cy.bootPos();
		openUnpaidTab();
		cy.get("[data-testid='unpaid-invoice-row']").should("have.length", 2);

		let before = 0;
		cy.then(() => {
			before = callsTo(OUTSTANDING).length;
		});

		cy.contains("[data-testid='unpaid-invoice-row']", UNPAID_FULL.name).click();
		cy.get("[data-testid='settle-confirm']").click();

		cy.contains("[role='dialog']", "Settle Invoice").should("not.exist");
		cy.then(() => {
			expect(callsTo(OUTSTANDING).length).to.be.greaterThan(before);
		});
	});

	it("refuses to take more than the outstanding balance", () => {
		cy.bootPos();
		openUnpaidTab();

		cy.contains("[data-testid='unpaid-invoice-row']", UNPAID_FULL.name).click();
		cy.get("[data-testid='settle-amount']").clear().type("999");

		cy.contains("cannot exceed the outstanding balance").should("be.visible");
		cy.get("[data-testid='settle-confirm']").should("be.disabled");
		cy.then(() => {
			expect(callsTo(SETTLE)).to.have.length(0);
		});
	});

	it("hides the unpaid tab when the POS Profile has not opted in", () => {
		bootWithout({ profileFlags: { allow_outstanding_settlement: 0 } });
		cy.openRecallDialog();

		cy.get("[data-testid='recall-tab-unpaid']").should("not.exist");
	});

	it("hides the unpaid tab when the role does not grant it", () => {
		bootWithout({ permissions: { settle_outstanding_invoice: false } });
		cy.openRecallDialog();

		cy.get("[data-testid='recall-tab-unpaid']").should("not.exist");
	});

	it("leaves an in-progress cart alone", () => {
		cy.bootPos();
		cy.addItemToCart("Espresso Beans");
		cy.cartRows().should("have.length", 1);

		openUnpaidTab();
		cy.contains("[data-testid='unpaid-invoice-row']", UNPAID_FULL.name).click();
		cy.get("[data-testid='settle-confirm']").click();
		cy.contains("[role='dialog']", "Settle Invoice").should("not.exist");

		// Settling a past sale is not a sale: the cashier's current order stands.
		cy.cartRows().should("have.length", 1);
		cy.cartRow("Espresso Beans").should("contain", "Espresso Beans");
	});
});
