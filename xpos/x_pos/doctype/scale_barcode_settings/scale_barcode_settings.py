# Copyright (c) 2026, Kodlyft and contributors
# For license information, please see license.txt

from frappe.model.document import Document


class ScaleBarcodeSettings(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		item_code_starting_digit: DF.Int
		item_code_total_digits: DF.Int
		no_of_prefix_characters: DF.Int
		prefix: DF.Data | None
		prefix_included_or_not: DF.Check
		price_decimals: DF.Int
		price_included_in_barcode_or_not: DF.Check
		price_starting_digit: DF.Int
		price_total_digit: DF.Int
		weight_decimals: DF.Int
		weight_starting_digit: DF.Int
		weight_total_digits: DF.Int
	# end: auto-generated types
	pass
