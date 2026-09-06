# Copyright (c) 2026, Kodlyft and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class SalesInvoiceReference(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		customer: DF.Link
		grand_total: DF.Currency
		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
		posting_date: DF.Date
		sales_invoice: DF.Link
		transaction_amount: DF.Currency
		transaction_currency: DF.Link | None
	# end: auto-generated types
	pass
