import { unstubbedMethods } from "../support/frappeStub";

describe("e2e harness", () => {
	it("boots the POS with a customer and an item grid", () => {
		cy.bootPos();

		cy.contains("Espresso Beans").should("be.visible");
		cy.contains("Ada Lovelace").should("be.visible");
	});

	it("adds an item to the cart", () => {
		cy.bootPos();
		cy.addItemToCart("Espresso Beans");

		cy.cartRows().should("have.length", 1);
		cy.cartRow("Espresso Beans").should("contain", "Espresso Beans");
	});

	it("reports any endpoint the fixtures forgot to stub", () => {
		cy.bootPos();
		cy.addItemToCart("Espresso Beans");
		cy.wait(500);

		cy.then(() => {
			// Not an assertion failure - just visible in the log so gaps are easy
			// to spot when the app grows a new boot-time call.
			cy.log(`unstubbed methods: ${unstubbedMethods().join(", ") || "(none)"}`);
		});
	});
});
