# Copyright (c) 2026, Kodlyft and contributors
# For license information, please see license.txt

import json

import frappe
from frappe.utils import flt, nowdate


@frappe.whitelist()
def get_active_pricing_rules(params: dict | str):
	"""Return active selling pricing rules for POS context.

	Args:
	        params: dict with company, price_list, currency, customer,
	                        customer_group, territory, date

	Returns:
	        list of normalized pricing rule dicts with discount details,
	        applicable items/groups/brands, margins, free items, etc.
	"""
	if isinstance(params, str):
		params = json.loads(params)

	company = params.get("company")
	price_list = params.get("price_list")
	customer = params.get("customer")
	customer_group = params.get("customer_group")
	territory = params.get("territory")
	date = params.get("date") or nowdate()

	if not company:
		return []

	rules = frappe.db.sql(
		"""
        SELECT
            pr.name, pr.title, pr.apply_on, pr.price_or_product_discount,
            pr.selling, pr.min_qty, pr.max_qty, pr.min_amt, pr.max_amt,
            pr.rate_or_discount, pr.rate, pr.discount_percentage,
            pr.discount_amount, pr.for_price_list, pr.company, pr.currency,
            pr.applicable_for, pr.customer, pr.customer_group, pr.territory,
            pr.free_item, pr.free_qty, pr.free_item_rate, pr.same_item,
            pr.apply_discount_on_rate, pr.priority, pr.apply_multiple_pricing_rules,
            pr.apply_recursion, pr.recurse_for, pr.is_recursive, pr.margin_type,
            pr.margin_rate_or_amount, pr.mixed_conditions
        FROM `tabPricing Rule` pr
        WHERE
            pr.disable = 0
            AND pr.selling = 1
            AND pr.company = %(company)s
            AND (pr.valid_from IS NULL OR pr.valid_from <= %(date)s)
            AND (pr.valid_upto IS NULL OR pr.valid_upto >= %(date)s)
        ORDER BY pr.priority DESC, pr.name ASC
        """,
		{"company": company, "date": date},
		as_dict=True,
	)

	result = []
	for rule in rules:
		if rule.applicable_for == "Customer" and rule.customer and customer:
			if rule.customer != customer:
				continue
		if rule.applicable_for == "Customer Group" and rule.customer_group and customer_group:
			if rule.customer_group != customer_group:
				continue
		if rule.applicable_for == "Territory" and rule.territory and territory:
			if rule.territory != territory:
				continue

		if rule.for_price_list and price_list and rule.for_price_list != price_list:
			continue

		rule["items"] = _get_pricing_rule_items(rule.name, rule.apply_on)

		result.append(rule)

	return result


@frappe.whitelist()
def reconcile_line_prices(cart_payload: dict | str):
	"""Recalculate line prices with ERPNext's pricing rule engine.

	Validates cross-item rules, returns updated rates and free items.

	Args:
	        cart_payload: dict with context, lines, and free_lines

	Returns:
	        dict with updates (per-line rates), free_lines, invoice_updates
	"""
	if isinstance(cart_payload, str):
		cart_payload = json.loads(cart_payload)

	context = cart_payload.get("context", {})
	lines = cart_payload.get("lines", [])

	if not lines:
		return {"updates": [], "free_lines": [], "invoice_updates": {}}

	company = context.get("company")
	customer = context.get("customer")
	price_list = context.get("price_list")
	currency = context.get("currency")
	_pos_profile = context.get("pos_profile")

	if not company or not customer:
		return {"updates": [], "free_lines": [], "invoice_updates": {}}

	try:
		from erpnext.accounts.doctype.pricing_rule.pricing_rule import (
			apply_pricing_rule,
		)

		args_list = []
		for line in lines:
			args = frappe._dict(
				{
					"item_code": line.get("item_code"),
					"qty": flt(line.get("qty", 1)),
					"rate": flt(line.get("rate", 0)),
					"price_list_rate": flt(line.get("price_list_rate") or line.get("rate", 0)),
					"stock_qty": flt(line.get("qty", 1)),
					"uom": line.get("uom"),
					"stock_uom": line.get("stock_uom") or line.get("uom"),
					"conversion_factor": 1,
					"warehouse": line.get("warehouse"),
					"item_group": line.get("item_group"),
					"brand": line.get("brand"),
					"company": company,
					"customer": customer,
					"currency": currency,
					"price_list": price_list,
					"posting_date": nowdate(),
					"transaction_date": nowdate(),
					"doctype": "Sales Invoice",
					"name": None,
					"child_docname": line.get("name"),
					"parenttype": "Sales Invoice",
				}
			)
			args_list.append(args)

		results = apply_pricing_rule(args_list, None)

		updates = []
		free_lines = []
		for i, result in enumerate(results or []):
			if isinstance(result, dict):
				update = {
					"idx": i,
					"item_code": lines[i].get("item_code"),
				}
				if "rate" in result:
					update["rate"] = flt(result["rate"])
				if "discount_percentage" in result:
					update["discount_percentage"] = flt(result["discount_percentage"])
				if "discount_amount" in result:
					update["discount_amount"] = flt(result["discount_amount"])
				if result.get("free_item"):
					free_lines.append(
						{
							"item_code": result["free_item"],
							"qty": flt(result.get("free_qty", 1)),
							"rate": flt(result.get("free_item_rate", 0)),
							"is_free_item": True,
						}
					)
				updates.append(update)

		return {
			"updates": updates,
			"free_lines": free_lines,
			"invoice_updates": {},
		}

	except (ImportError, Exception) as e:
		frappe.log_error(f"Pricing rule reconciliation failed: {e}", "X POS Pricing Rules")
		return {"updates": [], "free_lines": [], "invoice_updates": {}}


def _get_pricing_rule_items(rule_name: str, apply_on: str) -> list:
	"""Get the items/groups/brands a pricing rule applies to."""
	if apply_on == "Item Code":
		return frappe.get_all(
			"Pricing Rule Item Code",
			filters={"parent": rule_name},
			fields=["item_code", "uom"],
		)
	elif apply_on == "Item Group":
		return frappe.get_all(
			"Pricing Rule Item Group",
			filters={"parent": rule_name},
			fields=["item_group"],
		)
	elif apply_on == "Brand":
		return frappe.get_all(
			"Pricing Rule Brand",
			filters={"parent": rule_name},
			fields=["brand"],
		)
	return []
