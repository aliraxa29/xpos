# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class POSOffer(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		apply_item_code: DF.Link | None
		apply_item_group: DF.Link | None
		apply_on: DF.Literal["", "Item Code", "Item Group", "Brand", "Transaction"]
		apply_type: DF.Literal["", "Item Code", "Item Group"]
		auto: DF.Check
		brand: DF.Link | None
		company: DF.Link
		coupon_based: DF.Check
		description: DF.SmallText
		disabled: DF.Check
		discount_amount: DF.Float
		discount_percentage: DF.Float
		discount_type: DF.Literal["", "Rate", "Discount Percentage", "Discount Amount"]
		given_qty: DF.Float
		item: DF.Link | None
		item_group: DF.Link | None
		less_then: DF.Float
		loyalty_points: DF.Int
		loyalty_program: DF.Link | None
		max_amt: DF.Float
		max_qty: DF.Float
		min_amt: DF.Float
		min_qty: DF.Float
		offer: DF.Literal["Item Price", "Give Product", "Grand Total", "Loyalty Point"]
		pos_profile: DF.Link | None
		rate: DF.Float
		replace_cheapest_item: DF.Check
		replace_item: DF.Check
		title: DF.Data
		valid_from: DF.Date
		valid_upto: DF.Date | None
		warehouse: DF.Link | None
	# end: auto-generated types
	pass
