# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class POSPurchaseTaxes(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		erp_tax_account: DF.Link
		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
		tax_type: DF.Data
	# end: auto-generated types
	pass
