import "./style.css";
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { router } from "./router";
import { showError } from "@/services/api";
import { captureError } from "@/services/errorLog";
import { isElectron, getApiBaseUrl, warmApiCredentials } from "@/services/electronBridge";
import { usePosStore } from "./stores/posStore";
import { initializeNamespaces } from "./utils";
import { dayjs } from "@/utils/datetime";
import translate from "./lib/translate";

if (!isElectron() && import.meta.env.PROD) {
	if ("serviceWorker" in navigator) {
		navigator.serviceWorker
			.register("/xpos/sw.js", { scope: "/xpos/" })
			.then((registration) => {
				console.log("[XPOS PWA] Service worker registered for", registration.scope);

				registration.addEventListener("updatefound", () => {
					const installing = registration.installing;
					if (!installing) return;
					installing.addEventListener("statechange", () => {
						if (installing.state === "installed" && navigator.serviceWorker.controller) {
							if (confirm("A new version of X POS is available. Reload to update?")) {
								installing.postMessage({ type: "SKIP_WAITING" });
								window.location.reload();
							}
						}
					});
				});

				setInterval(
					() => {
						registration.update();
					},
					60 * 60 * 1000,
				);
			})
			.catch((error) => {
				console.error("[XPOS PWA] Service worker registration failed:", error);
			});
	}
} else {
	getApiBaseUrl().then((url) => {
		console.log("[XPOS Electron] Server URL:", url);
	});
	warmApiCredentials().then(() => {
		console.log("[XPOS Electron] API credentials cache warmed");
	});
	window.electronAPI?.onMainError?.((err) => {
		captureError({
			source: "main",
			title: `Main process: ${err.message}`,
			message: err.message,
			traceback: err.stack,
		});
	});
}

async function initializeBrowserStorage(): Promise<void> {
	if (isElectron()) return;
	if (!usePosStore().useOfflineMode) return;

	try {
		const { ensureDatabaseReady } = await import("@/services/idbService");
		await ensureDatabaseReady();
	} catch (error) {
		console.warn("[XPOS] Browser storage initialization failed", error);
	}
}

(async () => {
	const app = createApp(App);
	const pinia = createPinia();
	window.__ = translate;
	app.use(pinia);
	app.use(router);
	initializeNamespaces();
	await initializeBrowserStorage();
	app.config.globalProperties.$dayjs = dayjs;
	app.config.errorHandler = (err: unknown, _instance: unknown, info: string) => {
		console.error("X POS Error:", err, info);
		const message = err instanceof Error ? err.message : String(err);
		captureError({
			source: "renderer",
			title: `Vue error: ${message}`,
			message,
			traceback: err instanceof Error ? err.stack : undefined,
			meta: { info },
		});
		showError(`Error: ${message}`);
	};

	window.addEventListener("error", (event) => {
		const err = event.error;
		captureError({
			source: "renderer",
			title: `Uncaught: ${event.message}`,
			message: err instanceof Error ? err.message : event.message,
			traceback: err instanceof Error ? err.stack : undefined,
			meta: { filename: event.filename, lineno: event.lineno, colno: event.colno },
		});
	});
	window.addEventListener("unhandledrejection", (event) => {
		const reason = event.reason;
		const message = reason instanceof Error ? reason.message : String(reason);
		captureError({
			source: "promise",
			title: `Unhandled rejection: ${message}`,
			message,
			traceback: reason instanceof Error ? reason.stack : undefined,
		});
	});

	app.mount("#app");
})();
