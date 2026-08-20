import frappe

from xpos.api.utilities import get_invoice_type
from xpos.x_pos.doctype.pos_closing_shift.closing_processing.invoices import (
	submit_printed_invoices,
)


@frappe.whitelist()
def get_cashiers(
	doctype: str,
	txt: str,
	searchfield: str | None,
	start: int = 0,
	page_len: int = 20,
	filters: dict | None = None,
):
	cashiers_list = frappe.get_all("POS Profile User", filters=filters, fields=["user"])
	result = []
	for cashier in cashiers_list:
		user_email = frappe.get_value("User", cashier.user, "email")
		if user_email:
			result.append([cashier.user, f"{cashier.user} ({user_email})"])
	return result


@frappe.whitelist()
def get_pos_invoices(pos_opening_shift: str, doctype: str | None = None):
	if not pos_opening_shift:
		return []

	if not doctype:
		doctype = get_invoice_type()

	filters = {}
	submit_printed_invoices(pos_opening_shift, doctype)

	if doctype == "POS Invoice":
		filters["consolidated_invoice"] = ["in", ["", None]]

	names = frappe.get_all(doctype, filters=filters, pluck="name")

	return [frappe.get_doc(doctype, name).as_dict() for name in names]


@frappe.whitelist()
def get_payments_entries(pos_opening_shift: str):
	if not pos_opening_shift:
		return []

	return frappe.get_all(
		"Payment Entry",
		filters={
			"docstatus": 1,
			"reference_no": pos_opening_shift,
			"payment_type": ["in", ["Receive", "Pay"]],
		},
		fields=[
			"name",
			"mode_of_payment",
			"paid_amount",
			"base_paid_amount",
			"paid_from_account_currency",
			"paid_to_account_currency",
			"target_exchange_rate",
			"reference_no",
			"posting_date",
			"party",
			"payment_type",
		],
	)
