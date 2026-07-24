import { describe, it, expect } from "vitest";
import { buildReceiptHtml } from "@/services/receiptTemplate";
import type { ReceiptContext, ReceiptSnapshot } from "@/types/pos.types";

const context: ReceiptContext = {
	company_name: "Acme <Store>",
	company_phone: "123-456",
	company_email: "hi@acme.test",
	company_website: "acme.test",
	company_address: "1 Main St, Town",
	company_tax_id: "TAX-99",
	company_logo: "",
	receipt_header: "<b>Welcome</b>",
	receipt_footer: "<i>See you again</i>",
	currency: "USD",
	print_discount_amount: 0,
	print_format: "XPOS Thermal Receipt",
	css: ".receipt-container{width:100%}",
};

const snapshot: ReceiptSnapshot = {
	name: "LOCAL-42",
	posting_date: "2026-07-07",
	posting_time: "14:05:30",
	is_return: false,
	cashier: "Jane Cashier",
	customer_name: "Walk-in Customer",
	items: [
		{
			item_code: "SKU1",
			item_name: "Coffee & Cream",
			qty: 2,
			rate: 3.5,
			amount: 7,
			uom: "Nos",
			discount_percentage: 10,
			discount_amount: 0.7,
		},
	],
	taxes: [{ description: "VAT", rate: 15, amount: 0.95, included_in_print_rate: false }],
	payments: [{ mode_of_payment: "Cash", amount: 10 }],
	subtotal: 6.3,
	total_discount: 0.7,
	net_total: 6.3,
	grand_total: 7.25,
	total_qty: 2,
	change: 2.75,
	notes: "gift wrap",
};

describe("buildReceiptHtml", () => {
	it("renders the cached CSS and core receipt fields", () => {
		const html = buildReceiptHtml(snapshot, context);
		expect(html).toContain(context.css);
		expect(html).toContain("LOCAL-42");
		expect(html).toContain("07-07-2026");
		expect(html).toContain("02:05 PM");
		expect(html).toContain("Coffee &amp; Cream"); // HTML-escaped
		expect(html).toContain("Acme &lt;Store&gt;"); // company name escaped
		expect(html).toContain("<b>Welcome</b>"); // header HTML kept raw
		expect(html).toContain("Cash");
		expect(html).toContain("Change");
		expect(html).toContain("Tax ID: TAX-99");
	});

	it("shows RETURN banner and REFUND label for returns", () => {
		const html = buildReceiptHtml({ ...snapshot, is_return: true, change: 0 }, context);
		expect(html).toContain("RETURN / REFUND");
		expect(html).toContain("REFUND");
		expect(html).not.toContain("Change");
	});

	it("formats currency without an ISO code by prefixing the raw value", () => {
		const html = buildReceiptHtml(snapshot, { ...context, currency: "Rs" });
		expect(html).toContain("Rs ");
	});
});
