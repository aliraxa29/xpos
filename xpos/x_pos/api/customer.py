# Copyright (c) 2026, Kodlyft and contributors
# For license information, please see license.txt

"""Customer hooks and compatibility wrappers.

Hook handlers live here; customer CRUD/list APIs are implemented in
`xpos.x_pos.api.customers` and exposed via wrappers as needed.
"""

import frappe
from frappe import Any, _

from xpos.x_pos.doctype.referral_code.referral_code import (
	create_referral_code,
)

from . import customers


def after_insert(doc: Any, method: str):
	create_customer_referral_code(doc)
	create_gift_coupon(doc)


def validate(doc: Any, method: str):
	validate_referral_code(doc)


def create_customer_referral_code(doc: Any):
	if doc.referral_company:
		company = frappe.get_cached_doc("Company", doc.referral_company)
		if not company.auto_referral:
			return
		create_referral_code(
			doc.referral_company,
			doc.name,
			company.final_customer_offer,
			company.primary_customer_offer,
			company.referral_campaign,
		)


def create_gift_coupon(doc: Any):
	if doc.referral_code:
		coupon = frappe.new_doc("POS Coupon")
		coupon.customer = doc.name
		coupon.referral_code = doc.referral_code
		coupon.create_coupon_from_referral()


def validate_referral_code(doc: Any):
	referral_code = doc.referral_code
	exist = None
	if referral_code:
		exist = frappe.db.exists("Referral Code", referral_code)
		if not exist:
			exist = frappe.db.exists("Referral Code", {"referral_code": referral_code})
		if not exist:
			frappe.throw(_("This Referral Code {0} not exists").format(referral_code))


@frappe.whitelist()
def get_customer_balance(customer: str):
	return customers.get_customer_balance(customer)


@frappe.whitelist()
def create_customer(*args, **kwargs):
	"""Backward compatible wrapper for ``api.customers.create_customer``."""
	return customers.create_customer(*args, **kwargs)
