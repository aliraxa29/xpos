# Copyright (c) 2026, Kodlyft and contributors
# For license information, please see license.txt

"""
Public item API facade.

Keep whitelisted paths in this module stable for clients and route heavy
implementation work to `xpos.x_pos.api.item_processing` modules.
"""

import frappe

from xpos.x_pos.api.item_processing.search import (
	normalize_brand,
)


@frappe.whitelist()
def get_item_brand(item_code: str) -> str:
	"""Return normalized brand for an item, falling back to its template's brand."""
	if not item_code:
		return ""
	data = frappe.db.get_value("Item", item_code, ["brand", "variant_of"], as_dict=True)
	if not data:
		return ""
	brand = data.get("brand")
	if not brand and data.get("variant_of"):
		brand = frappe.db.get_value("Item", data.get("variant_of"), "brand")
	return normalize_brand(brand) if brand else ""
