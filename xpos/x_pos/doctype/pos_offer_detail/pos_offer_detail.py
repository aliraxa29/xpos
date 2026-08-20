# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class POSOfferDetail(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		apply_on: DF.Data | None
		coupon: DF.Link | None
		coupon_based: DF.Check
		give_item: DF.Link | None
		give_item_row_id: DF.Data | None
		items: DF.SmallText | None
		offer: DF.Data | None
		offer_applied: DF.Check
		offer_name: DF.Link | None
		parent: DF.Data
		parentfield: DF.Data
		parenttype: DF.Data
		row_id: DF.Data | None
	# end: auto-generated types
	pass
