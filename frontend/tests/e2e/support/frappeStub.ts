/**
 * A stubbed Frappe backend for E2E runs.
 *
 * Every call the app makes goes through `POST /api/method/<dotted.path>` and
 * reads `data.message` (see src/services/api.ts). One intercept therefore covers
 * the whole API surface: this module owns a mutable route table keyed by method
 * name, and specs override individual entries.
 *
 * Stubbing the backend rather than seeding a site keeps these tests fast and
 * deterministic, and is the only practical way to exercise the offline path -
 * you can't ask a real server to disappear mid-test.
 */

export type StubHandler = (args: Record<string, unknown>) => unknown;
export type StubRoute = StubHandler | unknown;

export interface RecordedCall {
	method: string;
	args: Record<string, unknown>;
}

interface StubState {
	routes: Map<string, StubRoute>;
	delays: Map<string, number>;
	calls: RecordedCall[];
	unstubbed: Set<string>;
}

const STATE_KEY = "__xposFrappeStub";

/**
 * Cypress bundles the support file and each spec file separately, so importing
 * this module from both gives you two module instances - and a route table the
 * spec writes to that the intercept never reads. Both bundles do share the spec
 * frame's `window`, so the state lives there instead.
 */
function state(): StubState {
	const scope = window as unknown as Record<string, StubState | undefined>;
	if (!scope[STATE_KEY]) {
		scope[STATE_KEY] = {
			routes: new Map(),
			delays: new Map(),
			calls: [],
			unstubbed: new Set(),
		};
	}
	return scope[STATE_KEY]!;
}

export function resetStub(): void {
	const s = state();
	s.routes.clear();
	s.delays.clear();
	s.calls.length = 0;
	s.unstubbed.clear();
}

export function stub(method: string, route: StubRoute): void {
	state().routes.set(method, route);
}

const ERROR_MARKER = "__xposStubError";

interface StubbedError {
	[ERROR_MARKER]: true;
	message: string;
	excType: string;
}

function isStubbedError(value: unknown): value is StubbedError {
	return !!value && typeof value === "object" && ERROR_MARKER in (value as Record<string, unknown>);
}

export function stubError(method: string, message: string, excType = "ValidationError"): void {
	stub(method, { [ERROR_MARKER]: true, message, excType } as StubRoute);
}

export function stubMany(table: Record<string, StubRoute>): void {
	for (const [method, route] of Object.entries(table)) stub(method, route);
}

/**
 * Hold a method's response back by `ms`.
 *
 * Needed to test races the app has to survive - a slow reply landing after a
 * newer one must not overwrite it.
 */
export function delayMethod(method: string, ms: number): void {
	state().delays.set(method, ms);
}

export function clearDelay(method: string): void {
	state().delays.delete(method);
}

export function allCalls(): RecordedCall[] {
	return [...state().calls];
}

export function callsTo(method: string): RecordedCall[] {
	return state().calls.filter((entry) => entry.method === method);
}

export function lastCallTo(method: string): RecordedCall | undefined {
	return callsTo(method).at(-1);
}

export function unstubbedMethods(): string[] {
	return [...state().unstubbed];
}

function resolve(method: string, args: Record<string, unknown>): unknown {
	const s = state();
	if (!s.routes.has(method)) {
		s.unstubbed.add(method);
		// `null` is what a Frappe method returns when it has nothing to say, and
		// the app is written to tolerate it. Better than failing the whole boot
		// over an endpoint the spec doesn't care about.
		return null;
	}
	const route = s.routes.get(method);
	return typeof route === "function" ? (route as StubHandler)(args) : route;
}

/**
 * Install the single intercept that backs every stubbed method.
 * Registered once per test, before the app is visited.
 */
export function installFrappeStub(): void {
	cy.intercept("POST", "**/api/method/**", (req) => {
		const method = decodeURIComponent(new URL(req.url).pathname.split("/api/method/")[1] || "");
		let args: Record<string, unknown> = {};
		try {
			args = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
		} catch {
			args = {};
		}

		state().calls.push({ method, args });
		const delay = state().delays.get(method);
		const resolved = resolve(method, args);

		if (isStubbedError(resolved)) {
			req.reply({
				statusCode: 417,
				body: {
					exc_type: resolved.excType,
					exception: `frappe.exceptions.${resolved.excType}: ${resolved.message}`,
					_server_messages: JSON.stringify([JSON.stringify({ message: resolved.message })]),
				},
				...(delay ? { delay } : {}),
			});
			return;
		}

		req.reply({
			statusCode: 200,
			body: { message: resolved },
			...(delay ? { delay } : {}),
		});
	}).as("frappe");
}
