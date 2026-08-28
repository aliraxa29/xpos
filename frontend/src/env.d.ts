/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

export {};

declare module "virtual:pwa-register" {
	export interface RegisterSWOptions {
		immediate?: boolean;
		onNeedRefresh?: () => void;
		onOfflineReady?: () => void;
		onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
		onRegisteredSW?: (swScriptUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
		onRegisterError?: (error: unknown) => void;
	}

	export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}

declare module "*.vue" {
	import type { DefineComponent } from "vue";
	const component: DefineComponent<{}, {}, any>;
	export default component;
}

interface Locals {
	DocType: Record<string, DoctypeMeta>;
	[key: string]: any;
}

declare global {
	interface XPosGlobal {
		boot?: Record<string, any> & {
			currencies: Array<{
				name?: string;
				currency_name?: string;
				symbol?: string;
				number_format?: string;
				smallest_currency_fraction_value?: number;
				symbol_on_right?: number;
			}>;
			countries: Array<{ name?: string }>;
			accounts_settings?: Record<string, any>;
			buying_settings?: Record<string, any>;
			stock_settings?: Record<string, any>;
			selling_settings?: Record<string, any>;
			territories?: Array<{ name?: string; territory_name?: string }>;
			pos_settings?: Record<string, any>;
			xpos_item_search?: Record<string, any>;
			xpos_number_format?: Record<string, any>;
			sysdefaults?: Record<string, any>;
		};
		_messages?: Record<string, string>;
		csrf_token?: string;
	}

	var xpos: XPosGlobal;
	var locals: Locals;

	interface Window {
		__: (txt: string, args?: (string | number)[]) => string;
		__xposBundlePromise?: Promise<unknown>;
		xpos?: XPosGlobal;
		electronAPI?: import("@/services/electronBridge").ElectronAPI;
		locals?: Locals;
	}
}
