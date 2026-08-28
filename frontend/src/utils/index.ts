import { call } from "@/services/api";

export {
	addDays,
	addMonths,
	convertToSystemTz,
	convertToUserTz,
	dayjs,
	formatDate,
	formatDatetime,
	formatTime,
	getDayDiff,
	getDiff,
	getHourDiff,
	getMinuteDiff,
	getSystemTimeZone,
	getUserDateFormat,
	getUserDatetimeFormat,
	getUserTimeFormat,
	getUserTimeZone,
	monthEnd,
	monthStart,
	nowDate,
	nowDatetime,
	nowTime,
	quarterEnd,
	quarterStart,
	SYSTEM_DATE_FORMAT,
	SYSTEM_DATETIME_FORMAT,
	SYSTEM_TIME_FORMAT,
	toDate,
	toDateOrNow,
	toDatetime,
	toDatetimeOrNow,
	toTime,
	userToDate,
	userToDatetime,
	weekEnd,
	weekStart,
	yearEnd,
	yearStart,
} from "./datetime";

/**
 * Check if the browser has an active network connection.
 * Uses the Navigator.onLine API which provides a reliable way
 * to detect network connectivity status.
 */
export const isOnline = (): boolean => {
	return typeof navigator !== "undefined" ? navigator.onLine : true;
};

export const getBootProperty = (key: string): any => {
	const globalObj = window as unknown as XPosGlobal;
	return globalObj.boot ? globalObj.boot[key] : undefined;
};

export const provide = (ns: string) => {
	const nsl = ns.split(".");
	let parent: Record<string, any> = window as unknown as Record<string, any>;
	for (var i = 0; i < nsl.length; i++) {
		var n = nsl[i];
		if (!parent[n]) {
			parent[n] = {};
		}
		parent = parent[n];
	}
	return parent;
};

/**
 * Execute a function with offline fallback.
 * Attempts the online operation first, falls back to offline handler on failure.
 */
export async function withOfflineFallback<T>(
	onlineOperation: () => Promise<T>,
	offlineFallback: () => Promise<T> | T,
	options?: { logError?: boolean },
): Promise<T> {
	// If offline, go straight to fallback
	if (!isOnline()) {
		return await offlineFallback();
	}

	try {
		return await onlineOperation();
	} catch (error) {
		const isNetworkFailure = isNetworkError(error);
		if (isNetworkFailure) {
			return await offlineFallback();
		}
		throw error;
	}
}

/**
 * Determine whether an error was caused by a network failure (offline, DNS,
 * server unreachable, etc.) as opposed to a server-side error.
 */
export function isNetworkError(error: unknown): boolean {
	if (!error) return false;
	const msg = error instanceof Error ? error.message : String(error);
	return (
		msg === "__offline__" ||
		msg === "Failed to fetch" ||
		msg === "NetworkError when attempting to fetch resource." ||
		msg === "Network request failed" ||
		msg === "Load failed" ||
		msg.includes("ERR_INTERNET_DISCONNECTED") ||
		msg.includes("ERR_NAME_NOT_RESOLVED") ||
		msg.includes("ERR_CONNECTION_REFUSED")
	);
}

export function isTabConflictError(error: unknown): boolean {
	return (error as { excType?: string } | null)?.excType === "TimestampMismatchError";
}

/**
 * Debounce function to limit the rate at which a function can fire.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
	func: T,
	wait: number,
): (...args: Parameters<T>) => void {
	let timeout: ReturnType<typeof setTimeout> | null = null;
	return (...args: Parameters<T>) => {
		if (timeout) clearTimeout(timeout);
		timeout = setTimeout(() => func(...args), wait);
	};
}

export {
	formatFloat,
	formatInt,
	formatNumber,
	formatPercent,
	formatQty,
	getNumberFormatInfo,
	numberFormatSettings,
	parseNumber,
	roundTo,
	systemNumberFormat,
} from "./numberFormat";

/**
 * Generate a unique local ID for offline records
 */
export function generateLocalId(): string {
	return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function getCustomer(customerId: string) {
	const customer = await call("frappe.client.get", {
		doctype: "Customer",
		name: customerId,
	});
	return customer;
}

export function get_base_url(): string {
	var url = window.location.origin;
	if (url.substring(url.length - 1, 1) == "/") url = url.substring(0, url.length - 1);
	return url;
}

export function get_full_url(url: string): string {
	if (url.indexOf("http://") === 0 || url.indexOf("https://") === 0) {
		return url;
	}
	return url.substring(0, 1) === "/" ? get_base_url() + url : get_base_url() + "/" + url;
}

/**
 * Extract a human-readable error message from any error object.
 * Handles Frappe server messages, standard Error objects, and raw strings.
 */
export function extractErrorMessage(error: unknown): string {
	if (!error) return "Unknown error";
	if (typeof error === "string") return error;

	const err = error as Record<string, unknown>;

	if (err._server_messages) {
		try {
			const msgs = JSON.parse(err._server_messages as string);
			const parsed = typeof msgs === "string" ? [msgs] : msgs;
			const messages = parsed
				.map((m: string) => {
					try {
						return JSON.parse(m).message || m;
					} catch {
						return m;
					}
				})
				.filter(Boolean);
			if (messages.length > 0) return messages.join(", ");
		} catch {
			/* fallthrough */
		}
	}

	if (err.message && typeof err.message === "string") return err.message;
	if (err.exc_type && typeof err.exc_type === "string") return err.exc_type;

	try {
		return JSON.stringify(error);
	} catch {
		return String(error);
	}
}

export function initializeNamespaces() {
	const namespaces = ["xpos", "locals.DocType"];
	namespaces.forEach(provide);
}
