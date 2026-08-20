# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class POSPaymentEntryReference(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		customer: DF.Link
		mode_of_payment: DF.Data
		paid_amount: DF.Currency
		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
		payment_entry: DF.Link
		posting_date: DF.Date
	# end: auto-generated types
	pass
