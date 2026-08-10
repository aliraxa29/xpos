"""Pricing rule API endpoints for XPOS.

These endpoints expose a lightweight snapshot of active pricing rules for the
frontend and provide a reconciliation endpoint to double check locally applied
rules with ERPNext's official pricing rule engine.
"""

from __future__ import annotations

from collections.abc import Iterable

import frappe
from frappe import _
from frappe.query_builder import DocType
from frappe.query_builder.functions import Coalesce
from frappe.utils import cint, flt, getdate, nowdate

# ---------------------------------------------------------------------------
# Helpers


def _parse_params(params, kwargs):
	if params and isinstance(params, str):
		data = frappe.parse_json(params)
	elif isinstance(params, dict):
		data = frappe._dict(params)
	else:
		data = frappe._dict(kwargs)

	return frappe._dict({k: data.get(k) for k in data})


def _coerce_date(value: str | None) -> str:
	if not value:
		return nowdate()
	try:
		return str(getdate(value))
	except Exception:
		return nowdate()


def _get_targets_map(parent_names: list[str]) -> dict[str, dict[str, list[str]]]:
	"""Fetch child table rows for item code / group / brand mappings."""

	target_map: dict[str, dict[str, list[str]]] = {
		"item_code": {},
		"item_group": {},
		"brand": {},
	}

	if not parent_names:
		return target_map

	child_configs: tuple[tuple[str, str], ...] = (
		("Pricing Rule Item Code", "item_code"),
		("Pricing Rule Item Group", "item_group"),
		("Pricing Rule Brand", "brand"),
	)

	for doctype, fieldname in child_configs:
		rows = frappe.get_all(doctype, filters={"parent": ("in", parent_names)}, fields=["parent", fieldname])
		for row in rows:
			if not row.get(fieldname):
				continue
			target_map[fieldname].setdefault(row.parent, []).append(row[fieldname])

	return target_map


def _serialize_rule(base, target_field: str | None, targets: Iterable[str] | None) -> list[dict]:
	"""Return serialised rules for each specific target."""

	base_rule = frappe._dict(base)
	if not target_field:
		return [base_rule]

	target_values = list(targets or [])
	if not target_values:
		return [base_rule]

	serialised = []
	for value in target_values:
		cloned = frappe._dict(base_rule.copy())
		cloned[target_field] = value
		serialised.append(cloned)

	return serialised


def _normalise_rule(doc: frappe._dict) -> frappe._dict:
	"""Map ERPNext fields to the lightweight payload expected by the frontend."""

	price_or_product_discount = doc.get("price_or_product_discount") or ""
	rate_or_discount = doc.get("rate_or_discount") or ""

	discount_type = ""
	if rate_or_discount in {"Discount Percentage", "Discount Rate"}:
		discount_type = "Rate"
	elif rate_or_discount in {"Discount Amount"}:
		discount_type = "Amount"
	elif rate_or_discount in {"Margin", "Margin Rate", "Margin Amount"}:
		discount_type = "Margin"
	elif rate_or_discount == "Rate":
		discount_type = "Rate"

	slabs = []
	if doc.get("min_qty"):
		slabs.append(
			{
				"min_qty": flt(doc.get("min_qty")),
				"rate_or_discount": flt(
					doc.get("rate") or doc.get("discount_percentage") or doc.get("discount_amount") or 0
				),
			}
		)

	output = frappe._dict(
		name=doc.get("name"),
		priority=cint(doc.get("priority") or 0),
		stop_further_rules=cint(doc.get("stop_further_rules") or 0),
		apply_multiple_pricing_rules=cint(doc.get("apply_multiple_pricing_rules") or 0),
		apply_on=doc.get("apply_on"),
		min_qty=flt(doc.get("min_qty") or 0),
		valid_from=str(doc.get("valid_from")) if doc.get("valid_from") else None,
		valid_upto=str(doc.get("valid_upto")) if doc.get("valid_upto") else None,
		price_or_discount=price_or_product_discount,
		discount_type=discount_type,
		rate_or_discount_type=rate_or_discount,
		rate_or_discount=flt(
			doc.get("rate") or doc.get("discount_percentage") or doc.get("discount_amount") or 0
		),
		free_item_rate=flt(doc.get("free_item_rate") or 0),
		currency=doc.get("currency"),
		price_list=doc.get("for_price_list"),
		company=doc.get("company"),
		customer=doc.get("customer"),
		customer_group=doc.get("customer_group"),
		territory=doc.get("territory"),
		for_price_list_rate=flt(doc.get("for_price_list_rate") or 0),
		uom=doc.get("uom"),
		slabs=slabs,
		margin_type=doc.get("margin_type"),
		margin_rate_or_amount=flt(doc.get("margin_rate_or_amount") or 0),
		apply_discount_on_rate=cint(doc.get("apply_discount_on_rate") or 0),
		is_free_item_rule=1 if price_or_product_discount == "Product" else 0,
		same_item=cint(doc.get("same_item") or 0),
		free_item=doc.get("free_item"),
		free_qty=(
			flt(doc.get("free_qty") or 0)
			if cint(doc.get("is_recursive") or doc.get("apply_per_threshold") or 0)
			else 1
		),
		free_qty_per_unit=flt(doc.get("free_qty_per_unit") or 0),
		apply_per_threshold=cint(doc.get("is_recursive") or doc.get("apply_per_threshold") or 0),
		max_free_qty=flt(doc.get("max_free_qty")) if doc.get("max_free_qty") is not None else None,
		recurse_for=flt(doc.get("recurse_for") or 0),
		apply_recursion_over=flt(doc.get("apply_recursion_over") or 0),
		round_free_qty=cint(doc.get("round_free_qty") or 0),
		dont_enforce_free_item_qty=cint(doc.get("dont_enforce_free_item_qty") or 0),
		apply_rule_on_other=doc.get("apply_rule_on_other"),
	)

	return output


# ---------------------------------------------------------------------------
# Public API


@frappe.whitelist()
def get_active_pricing_rules(params: dict | None = None, **kwargs):
	"""Return active selling pricing rules for the POS context."""

	ctx = _parse_params(params, kwargs)
	if not ctx.get("company"):
		frappe.throw(_("Company is required"))
	if not ctx.get("price_list"):
		frappe.throw(_("Price List is required"))

	ctx_date = _coerce_date(ctx.get("date"))

	PricingRule = DocType("Pricing Rule")
	meta = frappe.get_meta("Pricing Rule")

	select_columns = [
		PricingRule.name,
		PricingRule.priority,
		PricingRule.apply_multiple_pricing_rules,
		PricingRule.apply_on,
		PricingRule.min_qty,
		PricingRule.valid_from,
		PricingRule.valid_upto,
		PricingRule.price_or_product_discount,
		PricingRule.rate_or_discount,
		PricingRule.discount_percentage,
		PricingRule.discount_amount,
		PricingRule.rate,
		PricingRule.currency,
		PricingRule.for_price_list,
		PricingRule.company,
		PricingRule.customer,
		PricingRule.customer_group,
		PricingRule.territory,
	]

	optional_fields = [
		"margin_type",
		"margin_rate_or_amount",
		"apply_discount_on_rate",
		"same_item",
		"free_item",
		"free_qty",
		"free_qty_per_unit",
		"free_item_rate",
		"apply_per_threshold",
		"max_free_qty",
		"is_recursive",
		"recurse_for",
		"apply_recursion_over",
		"round_free_qty",
		"dont_enforce_free_item_qty",
		"stop_further_rules",
		"for_price_list_rate",
		"uom",
	]

	for fieldname in optional_fields:
		if meta.has_field(fieldname):
			select_columns.append(getattr(PricingRule, fieldname))

	# Add fields for 'Apply On Other' logic
	extra_fields = ["apply_rule_on_other", "other_item_code", "other_item_group", "other_brand"]
	for fieldname in extra_fields:
		if meta.has_field(fieldname):
			select_columns.append(getattr(PricingRule, fieldname))

	query = (
		frappe.qb.from_(PricingRule)
		.select(*select_columns)
		.where(PricingRule.selling == 1)
		.where(Coalesce(PricingRule.disable, 0) == 0)
		.where(PricingRule.company == ctx.company)
		.where((PricingRule.valid_from.isnull()) | (PricingRule.valid_from <= ctx_date))
		.where((PricingRule.valid_upto.isnull()) | (PricingRule.valid_upto >= ctx_date))
	)

	if ctx.get("price_list"):
		query = query.where(
			(PricingRule.for_price_list.isnull()) | (PricingRule.for_price_list == ctx.price_list)
		)

	if ctx.get("currency"):
		query = query.where((PricingRule.currency.isnull()) | (PricingRule.currency == ctx.currency))

	if ctx.get("customer"):
		query = query.where((PricingRule.customer.isnull()) | (PricingRule.customer == ctx.customer))
	if ctx.get("customer_group"):
		query = query.where(
			(PricingRule.customer_group.isnull()) | (PricingRule.customer_group == ctx.customer_group)
		)
	if ctx.get("territory"):
		query = query.where((PricingRule.territory.isnull()) | (PricingRule.territory == ctx.territory))

	rules = query.run(as_dict=True)
	parent_names = [r["name"] for r in rules]
	targets = _get_targets_map(parent_names)

	payload: list[dict] = []
	for row in rules:
		normalised = _normalise_rule(row)
		apply_on = (row.apply_on or "").strip()
		field_name = None
		mapping = {
			"Item Code": "item_code",
			"Item Group": "item_group",
			"Brand": "brand",
		}
		if apply_on in mapping:
			field_name = mapping[apply_on]

		target_values = targets.get(field_name, {}).get(row.name) if field_name else None
		serialised = _serialize_rule(normalised, field_name, target_values)
		payload.extend(serialised)

	return payload


@frappe.whitelist()
def reconcile_line_prices(cart_payload: dict | str | None = None):
	"""Deprecated alias for :func:`xpos.api.pricing_rules.reconcile_line_prices`.

	Kept so existing integrations against this path keep working; the engine
	itself now lives in the ``xpos.api`` namespace the POS frontend uses, so
	there is only ever one implementation to keep in step with ERPNext.
	"""

	from xpos.api.pricing_rules import reconcile_line_prices as _reconcile_line_prices

	return _reconcile_line_prices(cart_payload)
