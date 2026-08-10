import {
	showSuccess as toastSuccess,
	showError as toastError,
	showInfo as toastInfo,
} from "@/composables/useToast";
import { isOnline, isNetworkError } from "@/utils";
import { isElectron, getApiBaseUrlSync, getApiCredentialsSync } from "@/services/electronBridge";
import { captureError } from "@/services/errorLog";
import { getMeta } from "./idbService";

export { isNetworkError } from "@/utils";

function getCsrfToken(): string {
	return (
		window.xpos?.csrf_token ||
		(document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content ||
		""
	);
}

const EXCEPTION_MESSAGES: Record<string, string> = {
	AuthenticationError: "Invalid login credentials.",
	SessionExpired: "Your session has expired. Please sign in again.",
	CSRFTokenError: "Your session has expired. Please reload and try again.",
	PermissionError: "You do not have permission to do this.",
	DoesNotExistError: "The requested record no longer exists.",
	DuplicateEntryError: "A record with these details already exists.",
	LinkExistsError: "This record is linked to other records and cannot be removed.",
	TimestampMismatchError: "This record was changed by someone else. Please reload and try again.",
	ValidationError: "The server rejected this request. Please check the details and try again.",
	RateLimitExceededError: "Too many attempts. Please wait a moment and try again.",
};

const STATUS_MESSAGES: Record<number, string> = {
	401: "Invalid login credentials.",
	403: "You do not have permission to do this.",
	404: "The requested record no longer exists.",
	409: "This record was changed by someone else. Please reload and try again.",
	413: "That upload is too large.",
	429: "Too many attempts. Please wait a moment and try again.",
	502: "The server is unreachable. Please try again shortly.",
	503: "The server is unreachable. Please try again shortly.",
	504: "The server took too long to respond. Please try again.",
};

function toTraceback(exc: unknown): string {
	if (Array.isArray(exc)) return exc.join("\n");
	if (typeof exc !== "string") return "";
	try {
		const parsed = JSON.parse(exc);
		return Array.isArray(parsed) ? parsed.join("\n") : String(parsed);
	} catch {
		return exc;
	}
}

function messageFromTraceback(traceback: string): string {
	const lastLine = traceback
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.pop();
	if (!lastLine) return "";
	const match = /^(?:[\w.]+\.)?(\w*(?:Error|Exception))(?::\s*(.+))?$/.exec(lastLine);
	if (!match) return lastLine.startsWith("File ") ? "" : lastLine;
	return match[2]?.trim() ?? "";
}

function extractErrorMessage(data: Record<string, unknown>, status: number, traceback: string): string {
	if (data._server_messages) {
		try {
			const serverMessages = JSON.parse(data._server_messages as string);
			const firstMessage = serverMessages[0];
			const parsed = typeof firstMessage === "string" ? JSON.parse(firstMessage) : firstMessage;
			const text = parsed.message || parsed.title;
			if (text) return stripHtml(String(text));
		} catch {}
	}

	if (typeof data.message === "string" && data.message.trim() && !data.message.includes("Traceback")) {
		return stripHtml(data.message);
	}

	const fromTraceback = messageFromTraceback(traceback);
	if (fromTraceback) return stripHtml(fromTraceback);

	const excType = typeof data.exc_type === "string" ? data.exc_type : "";
	if (excType) {
		return (
			EXCEPTION_MESSAGES[excType] || `${excType.replace(/([a-z])([A-Z])/g, "$1 $2")}. Please try again.`
		);
	}

	return STATUS_MESSAGES[status] || "Something went wrong. Please try again.";
}

function stripHtml(value: string): string {
	const doc = new DOMParser().parseFromString(value, "text/html");
	return (doc.body.textContent || "")
		.replace(/\s+/g, " ")
		.trim();
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

	if (isElectron()) {
		const { apiKey, apiSecret } = getApiCredentialsSync();
		if (apiKey && apiSecret) {
			(headers as Record<string, string>)["Authorization"] = `token ${apiKey}:${apiSecret}`;
		}
	}

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
		const traceback = toTraceback(data.exc);
		const errorMsg = extractErrorMessage(data, response.status, traceback);

		captureError({
			source: "api",
			title: `${response.status} ${method}`,
			message: errorMsg,
			method,
			status: response.status,
			args,
			traceback,
			exceptionType: data.exc_type,
		});

		const err = new Error(errorMsg) as Error & { excType?: string };
		if (data.exc_type) err.excType = data.exc_type;
		throw err;
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
		currencyDisplay: "narrowSymbol",
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
