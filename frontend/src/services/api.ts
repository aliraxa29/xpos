import {
	showSuccess as toastSuccess,
	showError as toastError,
	showInfo as toastInfo,
} from "@/composables/useToast";
import { isOnline, isNetworkError } from "@/utils";
import { isElectron, getApiBaseUrlSync, getApiCredentialsSync } from "@/services/electronBridge";
import { getMeta } from "./idbService";

export { isNetworkError } from "@/utils";

function getCsrfToken(): string {
	return (
		window.xpos?.csrf_token ||
		(document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ||
		""
	);
}

async function fetchCall<T = unknown>(method: string, args: Record<string, unknown> = {}): Promise<T> {
	if (!isOnline()) {
		throw new Error("__offline__");
	}

	const csrfToken = getCsrfToken();

	const headers: HeadersInit = {
		"Content-Type": "application/json",
		Accept: "application/json",
		"X-Frappe-CSRF-Token": csrfToken,
	};

	// In Electron, inject API key auth so Frappe sees an authenticated user
	// (cross-origin fetch can't use session cookies reliably)
	if (isElectron()) {
		const { apiKey, apiSecret } = getApiCredentialsSync();
		if (apiKey && apiSecret) {
			(headers as Record<string, string>)["Authorization"] = `token ${apiKey}:${apiSecret}`;
		}
	}

	// In Electron, API calls go to the remote server (absolute URL).
	// In browser/PWA, same-origin relative URLs.
	const baseUrl = getApiBaseUrlSync();
	const url = `${baseUrl}/api/method/${method}`;

	let response: Response;
	try {
		response = await fetch(url, {
			method: "POST",
			headers,
			body: JSON.stringify(args),
			credentials: isElectron() ? "include" : "same-origin",
		});
	} catch (fetchError) {
		throw new Error("__offline__");
	}

	const data = await response.json();

	if (!response.ok || data.exc) {
		let errorMsg: string;

		if (data._server_messages) {
			try {
				const serverMessages = JSON.parse(data._server_messages);
				const firstMessage = serverMessages[0];
				const parsed = typeof firstMessage === "string" ? JSON.parse(firstMessage) : firstMessage;
				errorMsg = parsed.message || parsed.title || String(parsed);
			} catch {
				errorMsg = data._server_messages;
			}
		} else if (data.exc) {
			errorMsg = Array.isArray(data.exc) ? data.exc[0] : data.exc;
		} else {
			errorMsg = data.message || `HTTP error! status: ${response.status}`;
		}

		throw new Error(errorMsg);
	}
	if (data && typeof data === "object" && "message" in data) {
		return data.message as T;
	}
	return data as T;
}

export function call<T = unknown>(
	method: string,
	args: Record<string, unknown> = {},
	callback?: (r: { message: T }) => void,
): Promise<T> {
	return fetchCall<T>(method, args).then((message) => {
		if (callback) callback({ message });
		return message;
	});
}

export function getList<T = unknown>(doctype: string, args: Record<string, unknown> = {}): Promise<T[]> {
	return fetchCall<T[]>("frappe.client.get_list", {
		doctype,
		...args,
	});
}

export function getValue<T = unknown>(
	doctype: string,
	name: string | Record<string, unknown>,
	fieldname: string | string[],
): Promise<T> {
	return fetchCall<T>("frappe.client.get_value", {
		doctype,
		filters: name,
		fieldname,
	});
}

export function getDoc<T = unknown>(doctype: string, name: string): Promise<T> {
	return fetchCall<T>("frappe.client.get", {
		doctype,
		name,
	});
}

export function saveDoc<T = unknown>(doc: Record<string, unknown>): Promise<T> {
	return fetchCall<T>("frappe.client.save", { doc });
}

export function insertDoc<T = unknown>(doc: Record<string, unknown>): Promise<T> {
	return fetchCall<T>("frappe.client.insert", { doc });
}

export function getCount(
	doctype: string,
	filters: unknown[] | Record<string, unknown> = {},
): Promise<number> {
	return fetchCall<number>("frappe.client.get_count", {
		doctype,
		filters,
	});
}

export function searchLink(
	doctype: string,
	txt: string,
	filters?: Record<string, unknown>,
	page_length?: number,
): Promise<{ value: string; description?: string }[]> {
	return fetchCall<{ value: string; description?: string }[]>("frappe.desk.search.search_link", {
		doctype,
		txt,
		...(filters ? { filters } : {}),
		page_length: page_length ?? 20,
	});
}

/**
 * Format currency using Intl.NumberFormat
 */
export function formatCurrency(value: number, currency?: string): string {
	const cur =
		currency ||
		(window.xpos?.boot as { sysdefaults?: { currency?: string } })?.sysdefaults?.currency ||
		"USD";
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: cur,
		minimumFractionDigits: 2,
	}).format(value || 0);
}

/**
 * Show a success message using vue-sonner
 */
export function showSuccess(message: string): void {
	toastSuccess(message);
}

/**
 * Show an error message using vue-sonner
 */
export function showError(message: string): void {
	toastError(message);
}

/**
 * Show an info message using vue-sonner
 */
export function showInfo(message: string): void {
	toastInfo(message);
}
