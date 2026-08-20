# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt

import json

import frappe
from frappe import Any, _
from frappe.utils import cint, flt, now_datetime, nowdate

from xpos.api.utilities import can_close_shift, get_invoice_type, is_pos_cashier


def _row_value(row: dict | object, key: str, default: Any | None = None):
	if isinstance(row, dict):
		return row.get(key, default)
	return getattr(row, key, default)


def _get_open_shift_rows(user: str):
	return frappe.db.get_all(
		"POS Opening Shift",
		filters={
			"user": user,
			"docstatus": 1,
			"status": "Open",
		},
		or_filters=[
			{"pos_closing_shift": ["is", "not set"]},
			{"pos_closing_shift": ""},
		],
		fields=["name", "pos_profile", "company"],
		order_by="period_start_date desc",
		limit=1,
	)


@frappe.whitelist()
def get_opening_data():
	"""Get data needed for the shift opening dialog.

	Returns POS profiles, companies, and payment methods for the current user.
	"""
	data = {}

	pos_profiles = frappe.db.sql(
		"""
		SELECT DISTINCT p.name, p.company, p.currency, p.warehouse
		FROM `tabPOS Profile` p
		INNER JOIN `tabPOS Profile User` u ON u.parent = p.name
		WHERE p.disabled = 0 AND u.user = %(user)s
		ORDER BY p.name
		""",
		{"user": frappe.session.user},
		as_dict=True,
	)

	data["pos_profiles"] = pos_profiles

	companies = []
	seen = set()
	for profile in pos_profiles:
		company = _row_value(profile, "company")
		if company and company not in seen:
			companies.append({"name": company})
			seen.add(company)
	data["companies"] = companies

	profile_names = [_row_value(p, "name") for p in pos_profiles if _row_value(p, "name")]
	if profile_names:
		payment_methods = frappe.get_list(
			"POS Payment Method",
			filters={"parent": ["in", profile_names]},
			fields=["parent", "mode_of_payment", "default"],
			limit_page_length=0,
			order_by="parent",
			ignore_permissions=True,
		)
		data["payment_methods"] = payment_methods
	else:
		data["payment_methods"] = []

	return data


@frappe.whitelist()
def open_shift(pos_profile: str, company: str, balance_details: str | list[dict] | None = None):
	"""Create and submit a POS Opening Shift."""

	balance_details = json.loads(balance_details) if isinstance(balance_details, str) else balance_details

	new_shift = frappe.get_doc(
		{
			"doctype": "POS Opening Shift",
			"period_start_date": now_datetime(),
			"posting_date": nowdate(),
			"user": frappe.session.user,
			"pos_profile": pos_profile,
			"company": company,
			"docstatus": 1,
		}
	)

	if balance_details:
		new_shift.set("balance_details", balance_details)

	new_shift.insert(ignore_permissions=True)

	data = {
		"pos_opening_shift": new_shift.as_dict(),
	}
	_enrich_shift_data(data, pos_profile)

	return data


@frappe.whitelist()
def check_open_shift(user: str | None = None):
	"""Check if the current user has an open POS shift."""

	user = user or frappe.session.user

	open_shifts = _get_open_shift_rows(user)

	if not open_shifts:
		return None

	shift = open_shifts[0]
	shift_name = _row_value(shift, "name")
	pos_profile = _row_value(shift, "pos_profile")
	data = {
		"pos_opening_shift": frappe.get_doc("POS Opening Shift", shift_name).as_dict(),
	}
	_enrich_shift_data(data, pos_profile)

	return data


@frappe.whitelist()
def close_shift(opening_shift: str, closing_details: str | list[dict] | None):
	"""Create a POS Closing Shift and close the opening shift.

	- Aggregates invoices by POS opening shift reference
	- Tax summary per shift
	- Payment reconciliation with expected vs actual amounts
	"""
	if not can_close_shift():
		frappe.throw(_("Only a Supervisor can close a shift."), frappe.PermissionError)

	closing_details = json.loads(closing_details) if isinstance(closing_details, str) else closing_details

	opening = frappe.get_doc("POS Opening Shift", opening_shift)
	doctype = get_invoice_type()

	filters = {
		"pos_opening_shift": opening.name,
		"docstatus": 1,
		"is_pos": 1,
	}
	if doctype == "POS Invoice":
		filters["consolidated_invoice"] = ["in", ["", None]]

	invoices = frappe.get_all(
		doctype,
		filters=filters,
		fields=[
			"name",
			"posting_date",
			"grand_total",
			"net_total",
			"total_taxes_and_charges",
			"customer",
			"is_return",
		],
	)

	if not invoices:
		fallback_filters = {
			"pos_profile": opening.pos_profile,
			"posting_date": [">=", opening.posting_date],
			"docstatus": 1,
			"is_pos": 1,
			"owner": opening.user,
		}
		if doctype == "POS Invoice":
			fallback_filters["consolidated_invoice"] = ["in", ["", None]]

		invoices = frappe.get_all(
			doctype,
			filters=fallback_filters,
			fields=[
				"name",
				"posting_date",
				"grand_total",
				"net_total",
				"total_taxes_and_charges",
				"customer",
				"is_return",
			],
		)

	grand_total = sum(flt(_row_value(inv, "grand_total", 0)) for inv in invoices)
	net_total = sum(flt(_row_value(inv, "net_total", 0)) for inv in invoices)
	total_qty = len(invoices)

	returns_count = sum(1 for inv in invoices if inv.get("is_return"))

	closing_shift = frappe.get_doc(
		{
			"doctype": "POS Closing Shift",
			"period_start_date": opening.period_start_date,
			"period_end_date": now_datetime(),
			"posting_date": nowdate(),
			"posting_time": now_datetime().strftime("%H:%M:%S"),
			"pos_profile": opening.pos_profile,
			"user": frappe.session.user,
			"company": opening.company,
			"pos_opening_shift": opening.name,
			"grand_total": grand_total,
			"net_total": net_total,
			"total_quantity": total_qty,
		}
	)

	if closing_details:
		for detail in closing_details:
			closing_shift.append(
				"payment_reconciliation",
				{
					"mode_of_payment": detail.get("mode_of_payment"),
					"opening_amount": flt(detail.get("opening_amount", 0)),
					"expected_amount": flt(detail.get("expected_amount", 0)),
					"closing_amount": flt(detail.get("closing_amount", 0)),
					"difference": flt(detail.get("difference", 0)),
				},
			)

	tax_summary = _get_shift_tax_summary(invoices, doctype)
	for tax in tax_summary:
		try:
			closing_shift.append(
				"taxes",
				{
					"account_head": tax.get("account_head"),
					"rate": flt(tax.get("rate")),
					"amount": flt(tax.get("amount")),
				},
			)
		except Exception:
			pass

	invoice_link_field = "pos_invoice" if doctype == "POS Invoice" else "sales_invoice"
	for inv in invoices:
		row = {
			invoice_link_field: _row_value(inv, "name"),
			"posting_date": _row_value(inv, "posting_date"),
			"customer": _row_value(inv, "customer"),
			"grand_total": _row_value(inv, "grand_total", 0),
		}
		closing_shift.append("pos_transactions", row)

	closing_shift.insert(ignore_permissions=True)
	closing_shift.submit()

	return {
		"name": closing_shift.name,
		"pos_closing_shift": closing_shift.name,
		"grand_total": grand_total,
		"net_total": net_total,
		"total_invoices": total_qty,
		"returns_count": returns_count,
	}


@frappe.whitelist()
def get_shift_summary(opening_shift: str):
	"""Get summary of the current shift for closing.

	Enhanced version with tax breakdown and return info.
	"""
	opening = frappe.get_doc("POS Opening Shift", opening_shift)
	doctype = get_invoice_type()

	filters = {
		"pos_opening_shift": opening.name,
		"docstatus": 1,
		"is_pos": 1,
	}
	if doctype == "POS Invoice":
		filters["consolidated_invoice"] = ["in", ["", None]]

	invoices = frappe.get_all(
		doctype,
		filters=filters,
		fields=[
			"name",
			"grand_total",
			"net_total",
			"paid_amount",
			"change_amount",
			"is_return",
			"customer",
			"customer_name",
		],
	)

	if not invoices:
		fallback_filters = {
			"pos_profile": opening.pos_profile,
			"posting_date": [">=", opening.posting_date],
			"docstatus": 1,
			"is_pos": 1,
			"owner": opening.user,
		}
		if doctype == "POS Invoice":
			fallback_filters["consolidated_invoice"] = ["in", ["", None]]

		invoices = frappe.get_all(
			doctype,
			filters=fallback_filters,
			fields=[
				"name",
				"grand_total",
				"net_total",
				"paid_amount",
				"change_amount",
				"is_return",
				"customer",
				"customer_name",
			],
		)

	grand_total = sum(flt(_row_value(inv, "grand_total", 0)) for inv in invoices)
	net_total = sum(flt(_row_value(inv, "net_total", 0)) for inv in invoices)
	returns_count = sum(1 for inv in invoices if inv.get("is_return"))

	payment_summary = {}
	for inv in invoices:
		inv_name = _row_value(inv, "name")
		payments = frappe.get_all(
			"Sales Invoice Payment",
			filters={"parent": inv_name, "parenttype": doctype},
			fields=["mode_of_payment", "amount"],
		)
		inv_change = flt(_row_value(inv, "change_amount", 0))
		if not inv_change:
			inv_change = flt(frappe.db.get_value(doctype, inv_name, "change_amount") or 0)

		inv_paid = sum(flt(_row_value(p, "amount", 0)) for p in payments)

		for p in payments:
			mode = _row_value(p, "mode_of_payment")
			if mode not in payment_summary:
				payment_summary[mode] = 0
			pay_amount = flt(_row_value(p, "amount", 0))
			if inv_paid > 0 and inv_change > 0:
				pay_amount -= pay_amount / inv_paid * inv_change
			payment_summary[mode] += pay_amount

	opening_balances = {}
	for detail in opening.balance_details:
		mode = detail.mode_of_payment
		opening_balances[mode] = flt(detail.amount)

	tax_summary = _get_shift_tax_summary(invoices, doctype)

	return {
		"total_invoices": len(invoices),
		"grand_total": grand_total,
		"net_total": net_total,
		"returns_count": returns_count,
		"payment_summary": payment_summary,
		"opening_balances": opening_balances,
		"tax_summary": tax_summary,
		"pos_profile": opening.pos_profile,
		"company": opening.company,
		"invoices": [
			{
				"name": _row_value(inv, "name"),
				"customer": _row_value(inv, "customer"),
				"customer_name": _row_value(inv, "customer_name"),
				"grand_total": _row_value(inv, "grand_total", 0),
				"is_return": _row_value(inv, "is_return", 0),
			}
			for inv in invoices
		],
	}


def _enrich_shift_data(data: dict, pos_profile: str):
	"""Add profile, company, settings, and tax template data to shift response."""
	try:
		profile = frappe.get_cached_doc("POS Profile", pos_profile)
	except (AttributeError, Exception):
		frappe.clear_cache(doctype="POS Profile")
		profile = frappe.get_doc("POS Profile", pos_profile)
	data["pos_profile"] = profile.as_dict()
	data["company"] = frappe.get_cached_doc("Company", profile.company).as_dict()
	data["is_cashier"] = is_pos_cashier(frappe.session.user, pos_profile)

	allow_negative_stock = cint(frappe.db.get_single_value("Stock Settings", "allow_negative_stock") or 0)
	data["stock_settings"] = {"allow_negative_stock": bool(allow_negative_stock)}

	data["disable_rounded_total"] = cint(
		frappe.db.get_single_value("Global Defaults", "disable_rounded_total") or 0
	)

	if profile.taxes_and_charges:
		try:
			tax_template = frappe.get_cached_doc(
				"Sales Taxes and Charges Template", profile.taxes_and_charges
			)
			data["taxes"] = [
				{
					"description": tax.description
					or (str(tax.account_head).split(" - ")[0] if tax.account_head else "Tax"),
					"charge_type": tax.charge_type,
					"rate": flt(tax.rate),
					"account_head": tax.account_head,
					"included_in_print_rate": cint(tax.included_in_print_rate) or 0,
				}
				for tax in tax_template.taxes
			]
			data["tax_inclusive"] = cint(profile.get("tax_inclusive")) or 0
		except Exception:
			data["taxes"] = []
			data["tax_inclusive"] = 0
	else:
		data["taxes"] = []
		data["tax_inclusive"] = 0

	from xpos.api.auth import user_has_pos_permission

	data["print_settings"] = {
		"print_format": profile.get("print_format") or "POS Invoice",
		"print_format_for_online": profile.get("print_format_for_online"),
		"allow_print_before_pay": 1
		if user_has_pos_permission("print_draft_invoice", pos_profile=pos_profile)
		else 0,
		"auto_print_receipt": cint(profile.get("auto_print_receipt")) or 0,
		"letter_head": profile.get("letter_head") or "",
	}


def _get_shift_tax_summary(invoices: list, doctype: str = "Sales Invoice") -> list:
	"""Aggregate tax info across all shift invoices."""
	if not invoices:
		return []

	inv_names = [_row_value(inv, "name") for inv in invoices if _row_value(inv, "name")]
	if not inv_names:
		return []

	taxes = frappe.get_all(
		"Sales Taxes and Charges",
		filters={"parent": ["in", inv_names], "parenttype": doctype},
		fields=["account_head", "rate", {"SUM": "tax_amount", "as": "amount"}],
		group_by="account_head, rate",
		order_by="account_head",
	)

	return taxes


@frappe.whitelist()
def create_opening_shift(data: str | dict, local_id: str | None = None) -> dict:
	"""Create POS Opening Shift from desktop app sync.

	Used by the sync engine to push locally-created shifts to the server.

	Args:
	    data: JSON string containing shift data
	    local_id: Local ID from the desktop app for deduplication

	Returns:
	    dict with 'name' key containing the server docname
	"""
	data = json.loads(data) if isinstance(data, str) else data

	if local_id:
		existing = frappe.db.get_value("POS Opening Shift", {"xpos_local_id": local_id}, "name")
		if existing:
			return {"name": existing, "duplicate": True}

	new_shift = frappe.get_doc(
		{
			"doctype": "POS Opening Shift",
			"period_start_date": data.get("period_start_date") or now_datetime(),
			"posting_date": data.get("posting_date") or nowdate(),
			"user": data.get("user") or frappe.session.user,
			"pos_profile": data.get("pos_profile"),
			"company": data.get("company"),
			"xpos_local_id": local_id,
			"docstatus": 1,  # Submit immediately
		}
	)

	# Add balance details if provided
	balance_details = data.get("balance_details") or []
	for detail in balance_details:
		new_shift.append(
			"balance_details",
			{
				"mode_of_payment": detail.get("mode_of_payment"),
				"amount": flt(detail.get("opening_amount") or detail.get("amount", 0)),
			},
		)

	new_shift.insert(ignore_permissions=True)

	return {"name": new_shift.name}


@frappe.whitelist()
def create_closing_shift(data: str | dict, local_id: str | None = None) -> dict:
	"""Create POS Closing Shift from desktop app sync.

	Used by the sync engine to push locally-created closing shifts to the server.

	Args:
	    data: JSON string containing closing data
	    local_id: Local ID from the desktop app for deduplication

	Returns:
	    dict with 'name' key containing the server docname
	"""
	if not can_close_shift():
		frappe.throw(_("Only a Supervisor can close a shift."), frappe.PermissionError)

	data = json.loads(data) if isinstance(data, str) else data

	if local_id:
		existing = frappe.db.get_value("POS Closing Shift", {"xpos_local_id": local_id}, "name")
		if existing:
			return {"name": existing, "duplicate": True}

	opening_shift = data.get("pos_opening_shift")
	if not opening_shift:
		frappe.throw(_("Opening Shift is required"))

	try:
		opening = frappe.get_doc("POS Opening Shift", opening_shift)
	except frappe.DoesNotExistError:
		frappe.throw(_("POS Opening Shift {0} not found").format(opening_shift))

	closing_shift = frappe.get_doc(
		{
			"doctype": "POS Closing Shift",
			"period_start_date": opening.period_start_date,
			"period_end_date": data.get("period_end_date") or now_datetime(),
			"posting_date": data.get("posting_date") or nowdate(),
			"posting_time": data.get("posting_time") or now_datetime().strftime("%H:%M:%S"),
			"pos_profile": data.get("pos_profile") or opening.pos_profile,
			"user": data.get("user") or frappe.session.user,
			"company": data.get("company") or opening.company,
			"pos_opening_shift": opening.name,
			"grand_total": flt(data.get("grand_total", 0)),
			"net_total": flt(data.get("net_total", 0)),
			"total_quantity": cint(data.get("total_quantity", 0)),
			"xpos_local_id": local_id,
		}
	)

	payment_details = data.get("payment_reconciliation") or data.get("closing_details") or []
	for detail in payment_details:
		closing_shift.append(
			"payment_reconciliation",
			{
				"mode_of_payment": detail.get("mode_of_payment"),
				"opening_amount": flt(detail.get("opening_amount", 0)),
				"expected_amount": flt(detail.get("expected_amount", 0)),
				"closing_amount": flt(detail.get("closing_amount", 0)),
				"difference": flt(detail.get("difference", 0)),
			},
		)

	closing_shift.insert(ignore_permissions=True)
	closing_shift.submit()

	return {"name": closing_shift.name}
