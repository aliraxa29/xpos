import { usePosStore } from "@/stores/posStore";
import { call, showError } from "@/services/api";
import { getCachedReceiptContext } from "@/services/dbBridge";
import { buildReceiptHtml } from "@/services/receiptTemplate";
import type { ReceiptSnapshot } from "@/types/pos.types";
import { __ } from "@/lib/translate";

export interface PrintInvoiceOptions {
	format?: string;
	doctype?: "Sales Invoice" | "POS Invoice";
}

/**
 * Shared invoice printing helpers used by the payment dialog (genuine receipt),
 * the terminal backup receipt, and the cashier settlement screen.
 */
export function usePrintInvoice() {
	const posStore = usePosStore();

	function resolveDoctype(): "Sales Invoice" | "POS Invoice" {
		return xpos.boot?.pos_settings?.invoice_type === "POS Invoice" ? "POS Invoice" : "Sales Invoice";
	}

	async function printInvoice(invoiceName: string, options: PrintInvoiceOptions = {}) {
		try {
			const printFormat = options.format || posStore?.defaultPrintFormat || "XPOS Thermal Receipt";
			const letterHead = posStore.printSettings?.letter_head || "";
			const doctype = options.doctype || resolveDoctype();

			const baseUrl = window.location.origin;
			const printUrl = `${baseUrl}/printview?doctype=${encodeURIComponent(doctype)}&name=${encodeURIComponent(
				invoiceName,
			)}&format=${encodeURIComponent(printFormat)}&no_letterhead=${letterHead ? "0" : "1"}`;
			const printWindow = window.open(printUrl, "_blank");

			if (printWindow) {
				printWindow.onload = () => {
					printWindow.onafterprint = () => {
						printWindow.close();
					};
					setTimeout(() => {
						printWindow.print();
					}, 500);
					call("xpos.api.print_formats.mark_invoice_printed", {
						doctype,
						name: invoiceName,
					}).catch(() => {
						/* non-fatal: reprint control is best-effort */
					});
				};
			} else {
				window.open(printUrl, "_blank");
			}
		} catch (error) {
			console.error("Print error:", error);
			showError(__("Failed to print invoice"));
		}
	}

	async function printInvoiceLocal(localId: number) {
		try {
			if (!window.electronAPI?.db || !window.electronAPI?.print) {
				showError(__("Print not available"));
				return;
			}

			const invoice = await window.electronAPI.db.getPendingInvoice(localId);
			if (!invoice) {
				showError(__("Invoice not found for printing"));
				return;
			}
			const snapshot = (invoice.data as Record<string, unknown>)?.receipt as
				| ReceiptSnapshot
				| undefined;
			const context = await getCachedReceiptContext(posStore.profileName);

			if (snapshot && context) {
				if (!snapshot.name) snapshot.name = `LOCAL-${localId}`;
				const html = buildReceiptHtml(snapshot, context);
				const result = await window.electronAPI.print.printReport(html);
				if (!result?.success) {
					showError(__("Failed to print invoice locally"));
				}
				return;
			}

			await window.electronAPI.print.printInvoice({
				localId,
				data: invoice.data,
				customerName: invoice.customer_name || "",
				grandTotal: invoice.grand_total,
				isReturn: invoice.is_return,
				printFormat: posStore.printSettings?.print_format || "POS Invoice",
				letterHead: posStore.printSettings?.letter_head || "",
				companyName: posStore.posProfile?.company || "",
			});
		} catch (error) {
			console.error("Local print error:", error);
			showError(__("Failed to print invoice locally"));
		}
	}

	return { printInvoice, printInvoiceLocal };
}
