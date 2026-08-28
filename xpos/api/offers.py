# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt

from typing import Any

import frappe
from frappe import _
from frappe.utils import cstr, flt, getdate, nowdate

from xpos.utils import row_value


@frappe.whitelist()
def get_offers(pos_profile: str):
	"""Return all active POS Offers + promotional scheme offers for a profile."""
	pos = frappe.get_cached_doc("POS Profile", pos_profile)
	company = pos.company
	warehouse = pos.warehouse
	date = nowdate()

	values = {
		"company": company,
		"pos_profile": pos_profile,
		"warehouse": warehouse,
		"valid_from": date,
		"valid_upto": date,
	}

	data = (
		frappe.db.sql(
			"""
		SELECT *
		FROM `tabPOS Offer`
		WHERE
			disabled = 0
			AND company = %(company)s
			AND (pos_profile IS NULL OR pos_profile = '' OR pos_profile = %(pos_profile)s)
			AND (warehouse IS NULL OR warehouse = '' OR warehouse = %(warehouse)s)
			AND (valid_from IS NULL OR valid_from = '' OR valid_from <= %(valid_from)s)
			AND (valid_upto IS NULL OR valid_upto = '' OR valid_upto >= %(valid_upto)s)
		""",
			values=values,
			as_dict=True,
		)
		or []
	)

	for offer in data:
		offer["row_id"] = cstr(offer.get("row_id") or offer.get("name"))
		offer["offer_applied"] = flt(offer.get("offer_applied") or 0)
		offer["auto"] = flt(offer.get("auto") or 0)
		offer["min_qty"] = flt(offer.get("min_qty") or 0)
		offer["max_qty"] = flt(offer.get("max_qty") or 0)
		offer["min_amt"] = flt(offer.get("min_amt") or 0)
		offer["max_amt"] = flt(offer.get("max_amt") or 0)
		_normalize_discount_fields(offer)

	promo_offers = _get_promotional_scheme_offers(pos) or []
	data.extend(promo_offers)

	return data


@frappe.whitelist()
def get_pos_coupon(coupon: str, customer: str, company: str):
	"""Validate and return a POS coupon with its linked POS Offer."""
	coupon_doc = frappe.db.get_value(
		"POS Coupon",
		{"coupon_code": coupon, "company": company},
		[
			"name",
			"coupon_code",
			"coupon_type",
			"valid_from",
			"valid_upto",
			"customer",
			"pos_offer",
			"maximum_use",
			"used",
		],
		as_dict=True,
	)

	if not coupon_doc:
		frappe.throw(_("Invalid or already used coupon code"))

	if coupon_doc.get("maximum_use") and coupon_doc.get("used", 0) >= coupon_doc.get("maximum_use"):
		frappe.throw(_("Coupon has already been used the maximum number of times"))

	today = getdate(nowdate())
	valid_from = row_value(coupon_doc, "valid_from")
	valid_upto = row_value(coupon_doc, "valid_upto")
	coupon_customer = row_value(coupon_doc, "customer")

	if valid_from and getdate(valid_from) > today:
		frappe.throw(_("Coupon is not yet valid"))
	if valid_upto and getdate(valid_upto) < today:
		frappe.throw(_("Coupon has expired"))
	if coupon_customer and coupon_customer != customer:
		frappe.throw(_("Coupon is not valid for this customer"))

	offer_data = None
	pos_offer_name = row_value(coupon_doc, "pos_offer")
	if pos_offer_name:
		try:
			offer_doc = frappe.get_doc("POS Offer", pos_offer_name)
			offer_data = offer_doc.as_dict()
			offer_data["row_id"] = cstr(offer_data.get("row_id") or offer_data.get("name"))
			offer_data["auto"] = flt(offer_data.get("auto") or 0)
			offer_data["min_qty"] = flt(offer_data.get("min_qty") or 0)
			offer_data["max_qty"] = flt(offer_data.get("max_qty") or 0)
			offer_data["min_amt"] = flt(offer_data.get("min_amt") or 0)
			offer_data["max_amt"] = flt(offer_data.get("max_amt") or 0)
			_normalize_discount_fields(offer_data)
		except frappe.DoesNotExistError:
			offer_data = None

	return {"coupon": coupon_doc, "offer": offer_data, "msg": "Apply"}


@frappe.whitelist()
def get_active_gift_coupons(customer: str, company: str):
	"""Returns all active gift card coupons for a customer."""

	today = getdate(nowdate())
	coupons_data = frappe.get_all(
		"POS Coupon",
		filters={
			"company": company,
			"coupon_type": "Gift Card",
			"customer": customer,
			"used": 0,
		},
		fields=["coupon_code", "valid_from", "valid_upto"],
	)

	return [row_value(c, "coupon_code") for c in coupons_data if _is_coupon_active(c, today)]


@frappe.whitelist()
def get_applicable_delivery_charges(
	company: str,
	pos_profile: str,
	customer: str | None = None,
	shipping_address_name: str | None = None,
):
	"""Returns applicable delivery charges"""
	from xpos.x_pos.doctype.delivery_charges.delivery_charges import (
		get_applicable_delivery_charges as resolve_delivery_charges,
	)

	return resolve_delivery_charges(company, pos_profile, customer, shipping_address_name)


def _is_coupon_active(coupon_data: dict | object, today: Any):
	"""Return True if the coupon is valid for the provided date."""
	valid_from = row_value(coupon_data, "valid_from")
	valid_upto = row_value(coupon_data, "valid_upto")
	if valid_from and getdate(valid_from) > today:
		return False
	if valid_upto and getdate(valid_upto) < today:
		return False
	return True


def _normalize_discount_fields(offer: dict):
	"""Ensure discount fields are numeric."""
	for field in ("discount_percentage", "discount_amount", "rate"):
		if field in offer:
			offer[field] = flt(offer[field])


def _get_promotional_scheme_offers(pos_profile_doc: Any) -> list[dict]:
	"""Convert Promotional Scheme records into POS Offer-compatible dicts."""
	company = pos_profile_doc.company
	today = nowdate()

	try:
		schemes = frappe.get_all(
			"Promotional Scheme",
			filters={
				"company": company,
				"disabled": 0,
				"selling": 1,
			},
			fields=["name", "valid_from", "valid_upto"],
		)
	except Exception:
		return []

	offers = []
	for scheme in schemes:
		if scheme.valid_from and getdate(scheme.valid_from) > getdate(today):
			continue
		if scheme.valid_upto and getdate(scheme.valid_upto) < getdate(today):
			continue

		try:
			doc = frappe.get_doc("Promotional Scheme", scheme.name)
			for rule in doc.get("product_discount_rules") or []:
				offer = {
					"name": f"{scheme.name}-{rule.name}",
					"row_id": f"{scheme.name}-{rule.name}",
					"offer_type": "Product Discount",
					"apply_on": rule.get("apply_on", ""),
					"item_code": rule.get("item_code", ""),
					"item_group": rule.get("item_group", ""),
					"min_qty": flt(rule.get("min_qty", 0)),
					"max_qty": flt(rule.get("max_qty", 0)),
					"min_amt": flt(rule.get("min_amount", 0)),
					"max_amt": flt(rule.get("max_amount", 0)),
					"free_item": rule.get("free_item", ""),
					"free_qty": flt(rule.get("free_qty", 0)),
					"auto": 1,
					"promotional_scheme": scheme.name,
				}
				offers.append(offer)

			for rule in doc.get("price_discount_rules") or []:
				offer = {
					"name": f"{scheme.name}-{rule.name}",
					"row_id": f"{scheme.name}-{rule.name}",
					"offer_type": "Price Discount",
					"apply_on": rule.get("apply_on", ""),
					"item_code": rule.get("item_code", ""),
					"item_group": rule.get("item_group", ""),
					"min_qty": flt(rule.get("min_qty", 0)),
					"max_qty": flt(rule.get("max_qty", 0)),
					"min_amt": flt(rule.get("min_amount", 0)),
					"max_amt": flt(rule.get("max_amount", 0)),
					"discount_percentage": flt(rule.get("discount_percentage", 0)),
					"discount_amount": flt(rule.get("discount_amount", 0)),
					"rate": flt(rule.get("rate", 0)),
					"auto": 1,
					"promotional_scheme": scheme.name,
				}
				offers.append(offer)
		except Exception:
			continue

	return offers
