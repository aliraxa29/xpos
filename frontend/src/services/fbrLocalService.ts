/**
 * Client-side caller for the local (on-terminal) FBR fiscalization service.
 *
 * When the FBR cloud API is unreachable, the Frappe server hands the built invoice
 * payload back to the client (create_invoice → "fbr_local_required"). The local
 * fiscal service runs on the cashier's machine and can only be reached from here —
 * never from the server — so the client posts the payload to it, obtains the fiscal
 * invoice number, and finalizes the sale.
 *
 * Electron routes the request through the main process (no mixed-content/CORS limits).
 * The browser build calls the service directly with fetch; that requires the POS page
 * to be served over http (or the local service exposed over https with a permissive
 * CORS policy), otherwise the browser blocks the http://localhost request.
 */

import { isElectron } from "./electronBridge";

const LOCAL_SERVICE_PATH = "/api/IMSFiscal/GetInvoiceNumberByModel";
const REQUEST_TIMEOUT_MS = 12000;

/** Shape returned by the local IMSFiscal service. */
interface LocalFiscalResponse {
	InvoiceNumber?: string;
	Code?: string | number;
	Response?: string;
	Errors?: unknown;
}

export interface LocalFiscalResult {
	invoiceNumber: string;
}

function buildUrl(baseUrl: string): string {
	return `${(baseUrl || "http://localhost:8524").replace(/\/+$/, "")}${LOCAL_SERVICE_PATH}`;
}

function parseResult(raw: LocalFiscalResponse): LocalFiscalResult {
	const code = raw?.Code != null ? String(raw.Code).trim() : "";
	const invoiceNumber = (raw?.InvoiceNumber || "").trim();
	if (!invoiceNumber || (code && code !== "100")) {
		const message =
			raw?.Response ||
			(raw?.Errors ? String(raw.Errors) : "") ||
			"Local FBR service did not return an invoice number.";
		throw new Error(message);
	}
	return { invoiceNumber };
}

/**
 * Request a fiscal invoice number from the local service.
 * @param payload The FBR invoice model built by the server (create_invoice response).
 * @param baseUrl Base URL of the local service (POS Profile → FBR Local Service URL).
 */
export async function fiscalizeViaLocalService(
	payload: Record<string, unknown>,
	baseUrl: string,
): Promise<LocalFiscalResult> {
	if (isElectron() && window.electronAPI?.fbr?.fiscalizeLocal) {
		const res = await window.electronAPI.fbr.fiscalizeLocal(buildUrl(baseUrl), payload);
		if (!res.success) {
			throw new Error(res.error || "Local FBR service request failed.");
		}
		return parseResult((res.data || {}) as LocalFiscalResponse);
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const response = await fetch(buildUrl(baseUrl), {
			method: "POST",
			headers: { "Content-Type": "application/json", Accept: "application/json" },
			body: JSON.stringify(payload),
			signal: controller.signal,
		});
		if (!response.ok) {
			throw new Error(`Local FBR service responded with HTTP ${response.status}.`);
		}
		const data = (await response.json()) as LocalFiscalResponse;
		return parseResult(data);
	} finally {
		clearTimeout(timer);
	}
}
