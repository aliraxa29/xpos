# Copyright (c) 2026, Kodlyft and contributors
# For license information, please see license.txt

import json

import frappe


@frappe.whitelist()
def get_bundle_components(bundles: str | list) -> dict:
	"""Return component items for Product Bundles.

	Args:
		bundles: JSON string or list of bundle item codes.

	Returns:
		dict: mapping of bundle_code -> list of component dicts with
		item_code, qty, uom, is_batch, is_serial.
	"""
	if isinstance(bundles, str):
		bundles = json.loads(bundles)

	result = {}
	for code in bundles or []:
		if not frappe.db.exists("Product Bundle", code):
			result[code] = []
			continue
		bundle = frappe.get_doc("Product Bundle", code)

		components = []
		for row in bundle.items:
			item = frappe.db.get_value(
				"Item",
				row.item_code,
				["has_batch_no", "has_serial_no", "stock_uom", "is_stock_item"],
				as_dict=True,
			)
			uom = row.uom or (item.stock_uom if item else None)
			components.append(
				{
					"item_code": row.item_code,
					"qty": row.qty,
					"uom": uom,
					"is_batch": item.has_batch_no if item else 0,
					"is_serial": item.has_serial_no if item else 0,
					"is_stock_item": item.is_stock_item if item else 0,
				}
			)
		result[code] = components

	return result
