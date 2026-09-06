# Copyright (c) 2026, Kodlyft and contributors
# For license information, please see license.txt


import json

import frappe
from frappe import _
from frappe.utils import cstr, flt, getdate, nowdate


@frappe.whitelist()
def get_item_tax_template(item_code: str, company: str, tax_category: str | None = None):
	"""Resolve the applicable Item Tax Template for an item.

	Follows ERPNext's resolution order:
	  1. Item-level taxes (tabItem Tax child table)
	  2. Item Group-level taxes (walking up the group hierarchy)

	Returns:
	    dict: {
	        "item_tax_template": str or None,
	        "item_tax_map": dict  - mapping of account_head -> tax_rate
	    }
	"""
	if not item_code:
		frappe.throw(_("Item Code is required"))
	if not company:
		frappe.throw(_("Company is required"))

	item = frappe.get_cached_doc("Item", item_code)
	today = nowdate()
	tax_category = cstr(tax_category or "")

	item_tax_template = _resolve_tax_template(item.taxes, company, tax_category, today)

	if not item_tax_template:
		item_group = item.item_group
		while item_group and not item_tax_template:
			item_group_doc = frappe.get_cached_doc("Item Group", item_group)
			item_tax_template = _resolve_tax_template(item_group_doc.taxes, company, tax_category, today)
			item_group = item_group_doc.parent_item_group

	item_tax_map = {}
	if item_tax_template:
		template = frappe.get_cached_doc("Item Tax Template", item_tax_template)
		for d in template.taxes:
			if frappe.get_cached_value("Account", d.tax_type, "company") == company:
				item_tax_map[d.tax_type] = flt(d.tax_rate)

	return {
		"item_tax_template": item_tax_template,
		"item_tax_map": item_tax_map,
	}


def _resolve_tax_template(taxes: list, company: str, tax_category: str, today: str):
	"""Find the best matching Item Tax Template from a list of tax rows.

	Args:
	    taxes: Child table rows (from Item or Item Group)
	    company: Company name to filter by
	    tax_category: Tax category to match
	    today: Date string for validity checks

	Returns:
	    str or None: Name of the matched Item Tax Template
	"""
	if not taxes:
		return None

	taxes_with_validity = []
	taxes_with_no_validity = []

	for tax in taxes:
		try:
			disabled, tax_company = frappe.get_cached_value(
				"Item Tax Template", tax.item_tax_template, ["disabled", "company"]
			)
		except Exception:
			continue

		if disabled or tax_company != company:
			continue

		if tax.valid_from or getattr(tax, "maximum_net_rate", None):
			valid_from = getattr(tax, "valid_from", None)
			if valid_from and getdate(valid_from) <= getdate(today):
				taxes_with_validity.append(tax)
			elif not valid_from:
				taxes_with_validity.append(tax)
		else:
			taxes_with_no_validity.append(tax)

	if taxes_with_validity:
		candidate_taxes = sorted(
			taxes_with_validity,
			key=lambda t: getattr(t, "valid_from", None) or "",
			reverse=True,
		)
	else:
		candidate_taxes = taxes_with_no_validity

	if not candidate_taxes:
		return None

	for tax in candidate_taxes:
		if cstr(getattr(tax, "tax_category", "")) == cstr(tax_category):
			return tax.item_tax_template

	if not tax_category and candidate_taxes:
		return candidate_taxes[0].item_tax_template

	return None


@frappe.whitelist()
def get_item_tax_templates_bulk(items_json: str, company: str, tax_category: str | None = None) -> dict:
	"""Resolve Item Tax Templates for multiple items in a single call.

	Args:
	    items_json: JSON string of list of item_code strings
	    company: Company name
	    tax_category: Optional tax category

	Returns:
	    dict: Mapping of item_code -> {item_tax_template, item_tax_map}
	"""
	items = json.loads(items_json) if isinstance(items_json, str) else items_json
	if not items or not company:
		return {}

	result = {}
	for item_code in items:
		try:
			data = get_item_tax_template(item_code, company, tax_category)
			if data.get("item_tax_template"):
				result[item_code] = data
		except Exception:
			continue

	return result
