import "./commands";
import { resetStub } from "./frappeStub";

beforeEach(() => {
	resetStub();
	cy.clearLocalStorage();
	// The IndexedDB cache is cleared in cy.bootPos()'s onBeforeLoad, where the
	// app's own window is available - deleting it from the spec runner's global
	// would target the wrong origin's storage entirely.
});

/**
 * Only genuine app crashes should fail a test.
 *
 * Two classes of noise are expected here:
 *
 * - `Unexpected token '{'` - index.html is a Jinja template served by Frappe
 *   (`window.xpos.boot = {{ boot | json }}`). Under the raw Vite dev server the
 *   placeholders are unrendered, so that inline script is a parse error. It is a
 *   pre-existing `yarn dev` quirk, not a regression, and harmless here because
 *   cy.bootPos() injects `window.xpos` itself in onBeforeLoad.
 * - offline/network errors, which some specs cause deliberately.
 */
Cypress.on("uncaught:exception", (err) => {
	if (/Unexpected token '\{'/.test(err.message)) return false;
	if (/__offline__|Failed to fetch|NetworkError|Load failed/.test(err.message)) return false;
	return true;
});
