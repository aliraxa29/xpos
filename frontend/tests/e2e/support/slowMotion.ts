const SLOW_MO = Number(Cypress.env("slowMo") || 0);

/** Per-keystroke delay while typing. Scaled down: a full pause per character would crawl. */
const TYPE_DELAY = Math.min(120, Math.max(40, Math.round(SLOW_MO / 6)));

const ACTIONS = [
	"click",
	"dblclick",
	"rightclick",
	"type",
	"clear",
	"check",
	"uncheck",
	"select",
	"trigger",
	"selectFile",
] as const;

const HIGHLIGHT = "outline:3px solid #f59e0b;outline-offset:2px;transition:outline 120ms ease;";

function highlight(subject: unknown): () => void {
	const el = subject as JQuery<HTMLElement> | undefined;
	if (!el || typeof (el as JQuery).attr !== "function" || !el.length) return () => {};

	try {
		const previous = el.attr("style") || "";
		el.attr("style", previous + HIGHLIGHT);
		return () => {
			try {
				if (previous) el.attr("style", previous);
				else el.removeAttr("style");
			} catch {
				/* element went away; nothing to restore */
			}
		};
	} catch {
		return () => {};
	}
}

type AnyFn = (...args: any[]) => any;

if (SLOW_MO > 0) {
	for (const name of ACTIONS) {
		// `Cypress.Commands.overwrite` is typed per command name, so one wrapper written for a
		// list of commands cannot satisfy every signature at once. The cast is confined here.
		const overwrite = Cypress.Commands.overwrite as unknown as (n: string, fn: AnyFn) => void;

		// The subject is just args[0] for a child command, so spreading covers both shapes.
		overwrite(name, (originalFn: AnyFn, ...args: any[]) => {
			// `type` gets its own per-character delay so the text appears as if it were being
			// keyed in, rather than materialising all at once.
			if (name === "type") {
				const [subject, text, options] = args as [unknown, unknown, object | undefined];
				args = [subject, text, { delay: TYPE_DELAY, ...(options || {}) }];
			}

			const restore = highlight(args[0]);
			const result = originalFn(...args);

			// The pause has to come *after* the command, returned as a plain promise. Wrapping
			// the call in `cy.wait(...).then(() => originalFn(...))` instead deadlocks: the
			// callback hands a chainable back to `.then()`, whose own queue cannot drain until
			// the outer command finishes, so it waits on itself until the timeout.
			return new Promise((resolve) => {
				setTimeout(() => {
					restore();
					resolve(result);
				}, SLOW_MO);
			});
		});
	}

	// Announce the pace once per test, from inside a test context - `Cypress.log` at module scope
	// runs while the support file is still being evaluated, before there is a runnable to log to.
	beforeEach(() => {
		Cypress.log({
			name: "slow-mo",
			message: `${SLOW_MO}ms per action, ${TYPE_DELAY}ms per keystroke`,
		});
	});

	// A pause between tests, so the final state of one is readable before the next reload wipes it.
	afterEach(() => {
		cy.wait(SLOW_MO, { log: false });
	});
}

export {};
