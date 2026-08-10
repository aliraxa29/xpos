import { defaultRoutes } from "../fixtures/pos";
import { installFrappeStub, resetStub, stubMany, type StubRoute } from "./frappeStub";

/**
 * Lets a spec flip connectivity at runtime. `navigator.onLine` is read-only, so
 * the app's isOnline() check is backed by a getter we own for the page's lifetime.
 */
declare global {
	interface Window {
		__cyOnline?: boolean;
	}
}

export interface BootOptions {
	/** Route overrides layered on top of the default table. */
	routes?: Record<string, StubRoute>;
	/** Skip picking a customer (the app blocks adding items without one). */
	skipCustomer?: boolean;
	/** Customer to select once the POS is up. */
	customer?: string;
}

/**
 * Boot the POS to a usable cart.
 *
 * Injects `window.xpos` because index.html is a Jinja template - under the Vite
 * dev server the boot script is unrendered and never executes.
 */
Cypress.Commands.add("bootPos", (options: BootOptions = {}) => {
	resetStub();
	stubMany({ ...defaultRoutes(), ...(options.routes || {}) });
	installFrappeStub();

	cy.visit("/xpos/", {
		onBeforeLoad(win) {
			// The app caches items, customers and the pricing rule snapshot here.
			// Left over, that cache leaks between specs - and would silently
			// satisfy an offline test that should have failed.
			win.indexedDB.deleteDatabase("xpos_offline_v3");

			win.__cyOnline = true;
			Object.defineProperty(win.navigator, "onLine", {
				configurable: true,
				get: () => win.__cyOnline !== false,
			});

			(win as unknown as { xpos: unknown }).xpos = {
				csrf_token: "cypress-csrf-token",
				boot: {
					user_info: {
						"cashier@example.com": {
							user_email: "cashier@example.com",
							user_fullname: "Test Cashier",
							image: "",
						},
					},
					currencies: [{ name: "USD", symbol: "$" }],
					xpos_role: "Cashier",
					xpos_permissions: {},
					__messages: {},
				},
			};
		},
	});

	// The item grid rendering is the signal that the shift/profile boot landed.
	cy.contains("[data-item-index], .cursor-pointer, button", "Espresso Beans", { timeout: 20000 }).should(
		"exist",
	);

	if (!options.skipCustomer) {
		cy.selectCustomer(options.customer || "Ada Lovelace");
	}
});

/** Pick a customer through the real dialog, as a cashier would. */
Cypress.Commands.add("selectCustomer", (customerName: string) => {
	cy.contains("button", /Walk-in Customer|Ada Lovelace|Grace Hopper/).click();
	cy.contains(customerName, { timeout: 10000 }).click();
	cy.get("[role='dialog']").should("not.exist");
});

/** Add an item to the cart by clicking it in the grid. */
Cypress.Commands.add("addItemToCart", (itemName: string) => {
	cy.contains(itemName).click();
});

/**
 * PosView renders <Cart /> twice - a desktop panel and a mobile one - and both
 * stay in the DOM, hidden by CSS. Every cart assertion must scope to the panel
 * that is actually on screen or it sees each row twice.
 */
Cypress.Commands.add("cartRows", () => {
	return cy.get("[data-cart-index]:visible");
});

Cypress.Commands.add("goOffline", () => {
	cy.window().then((win) => {
		win.__cyOnline = false;
		win.dispatchEvent(new Event("offline"));
	});
});

Cypress.Commands.add("goOnline", () => {
	cy.window().then((win) => {
		win.__cyOnline = true;
		win.dispatchEvent(new Event("online"));
	});
});

Cypress.Commands.add("openRecallDialog", () => {
	cy.window().then((win) => {
		win.dispatchEvent(new CustomEvent("xpos:show-drafts"));
	});
	cy.contains("[role='dialog']", "Recall Order").should("be.visible");
});

/** The visible cart row for an item, so assertions can scope to it. */
Cypress.Commands.add("cartRow", (itemName: string) => {
	return cy.get("[data-cart-index]:visible").filter(`:contains(${itemName})`).first();
});

/** The visible cart summary panel (totals, discounts, offline banner). */
Cypress.Commands.add("cartSummary", () => {
	return cy.contains("[data-cart-index]:visible ~ *, div", "Subtotal").filter(":visible").last();
});

declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace Cypress {
		interface Chainable {
			bootPos(options?: BootOptions): Chainable<void>;
			selectCustomer(customerName: string): Chainable<void>;
			addItemToCart(itemName: string): Chainable<void>;
			goOffline(): Chainable<void>;
			goOnline(): Chainable<void>;
			openRecallDialog(): Chainable<void>;
			cartRow(itemName: string): Chainable<JQuery<HTMLElement>>;
			cartRows(): Chainable<JQuery<HTMLElement>>;
			cartSummary(): Chainable<JQuery<HTMLElement>>;
		}
	}
}

export {};
