/**
 * Cypress launcher.
 *
 * Two jobs the plain `cypress` binary can't do for us:
 *
 * 1. Strips ELECTRON_RUN_AS_NODE. Editors built on Electron (VS Code, Cursor)
 *    export it into their integrated terminal, which makes Cypress's own
 *    Electron start as bare Node and fail with a confusing
 *    "bad option: --no-sandbox".
 * 2. With `--with-server`, boots the Vite dev server, waits for it, runs the
 *    suite, and shuts it down again - so `yarn test:e2e` is self-contained.
 *
 * Usage:
 *   node scripts/run-cypress.mjs run --with-server
 *   node scripts/run-cypress.mjs open
 */
import { spawn } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const argv = process.argv.slice(2);
const withServer = argv.includes("--with-server");
const cypressArgs = argv.filter((arg) => arg !== "--with-server");
const mode = cypressArgs[0] === "open" ? "open" : "run";

const BASE_URL = process.env.CYPRESS_BASE_URL || "http://localhost:5174";
const READY_TIMEOUT_MS = 120_000;

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

/** Vite serves the app under `base`, so probe the real entry point. */
async function waitForServer(url) {
	const deadline = Date.now() + READY_TIMEOUT_MS;
	while (Date.now() < deadline) {
		try {
			const response = await fetch(`${url}/xpos/`);
			if (response.ok) return true;
		} catch {
			// not up yet
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	return false;
}

function run(command, args, options = {}) {
	return spawn(command, args, { cwd: root, env, stdio: "inherit", ...options });
}

let server = null;

async function isServing(url) {
	try {
		const response = await fetch(`${url}/xpos/`, { signal: AbortSignal.timeout(2000) });
		return response.ok;
	} catch {
		return false;
	}
}

async function main() {
	if (withServer) {
		if (await isServing(BASE_URL)) {
			console.log(`[e2e] reusing the dev server already at ${BASE_URL}`);
		} else {
			console.log("[e2e] starting vite dev server...");
			server = run("npx", ["vite", "--port", "5174", "--strictPort"], { stdio: "ignore" });
			server.on("exit", (code) => {
				if (code && code !== 0 && server) {
					console.error(`[e2e] vite exited unexpectedly (${code})`);
					shutdown(1);
				}
			});

			if (!(await waitForServer(BASE_URL))) {
				console.error(`[e2e] vite did not become ready at ${BASE_URL} in time`);
				shutdown(1);
				return;
			}
			console.log(`[e2e] vite ready at ${BASE_URL}`);
		}
	}

	const cypress = run("npx", ["cypress", ...(cypressArgs.length ? cypressArgs : [mode])]);
	cypress.on("exit", (code) => shutdown(code ?? 1));
}

function shutdown(code) {
	if (server && !server.killed) {
		const child = server;
		server = null;
		child.kill("SIGTERM");
	}
	process.exit(code);
}

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));

main().catch((error) => {
	console.error("[e2e]", error);
	shutdown(1);
});
