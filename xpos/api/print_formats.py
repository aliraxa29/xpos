# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt

"""
Print Formats API.

Returns available print format names.
"""

import frappe
from frappe import _
from frappe.utils import cint

REPRINT_DOCTYPES = ("Sales Invoice", "POS Invoice")


@frappe.whitelist()
def get_print_formats(doctype: str = "Sales Invoice"):
	"""Returns available print format names for a doctype."""
	print_formats = frappe.get_all(
		"Print Format",
		filters={"doc_type": doctype, "disabled": 0},
		fields=["name"],
	)
	return [p.name for p in print_formats]


def _can_reprint(user: str | None = None) -> bool:
	"""Whether ``user`` may reprint a posted POS invoice (the ``allow_reprint_invoice`` right).

	Resolved from the user's POS Role permission map so it stays in sync with
	the Role Permissions admin screen. Administrators / System Managers always
	qualify.
	"""
	from xpos.api.auth import user_has_pos_permission

	return user_has_pos_permission("allow_reprint_invoice", user)


def invoice_has_permission(doc, ptype: str, user: str) -> bool:
	"""``has_permission`` hook restricting reprinting of POS invoices.

	The first receipt (``print_count`` == 0) is always allowed so cashiers
	can print at the point of sale; every subsequent print is a reprint and
	requires the ``allow_reprint_invoice`` right. Non-print actions and
	non-POS invoices defer to Frappe's normal role permissions.
	"""
	if ptype != "print":
		return True
	if not getattr(doc, "is_pos", 0):
		return True
	if cint(getattr(doc, "print_count", 0)) < 1:
		return True
	return _can_reprint(user)


@frappe.whitelist()
def get_receipt_context(pos_profile: str, print_format: str | None = None) -> dict:
	"""Resolve everything the desktop app needs to render a receipt offline.

	The thermal print format is server-side Jinja (``frappe.get_doc`` /
	``frappe.utils`` / ``xpos_barcode`` …) so it cannot run in the Electron
	renderer. Instead the desktop app caches this bundle while online and
	renders a faithful offline template against it, reusing the format's CSS
	verbatim. Company/profile data is pre-resolved here so no server call is
	needed at print time.
	"""
	profile = frappe.get_cached_doc("POS Profile", pos_profile)
	company = frappe.get_cached_doc("Company", profile.company)

	address = ""
	if company.get("company_address"):
		addr = frappe.get_cached_doc("Address", company.company_address)
		address = ", ".join(
			p
			for p in [
				addr.address_line1,
				addr.address_line2,
				addr.city,
				addr.state,
				addr.pincode,
			]
			if p
		)

	fmt = print_format or profile.get("default_print_format") or "XPOS Thermal Receipt"
	css = frappe.db.get_value("Print Format", fmt, "css") or ""

	return {
		"company_name": company.company_name or company.name,
		"company_phone": company.get("phone_no") or "",
		"company_email": company.get("email") or "",
		"company_website": company.get("website") or "",
		"company_address": address,
		"company_tax_id": company.get("tax_id") or "",
		"company_logo": company.get("company_logo") or "",
		"receipt_header": company.get("receipt_header") or "",
		"receipt_footer": company.get("receipt_footer") or "",
		"currency": company.get("default_currency") or "",
		"print_discount_amount": cint(profile.get("print_discount_amount")),
		"print_format": fmt,
		"css": css,
	}


@frappe.whitelist()
def mark_invoice_printed(doctype: str, name: str) -> dict:
	"""Record that a POS receipt has printed, so later prints count as reprints.

	Called by the POS frontend right after the point-of-sale receipt prints.
	Uses a direct db write because the counter is an internal marker, not
	user-editable content; ``update_modified=False`` avoids needless re-sync.
	"""
	if doctype not in REPRINT_DOCTYPES:
		frappe.throw(_("Unsupported doctype for print tracking: {0}").format(doctype))
	current = cint(frappe.db.get_value(doctype, name, "print_count"))
	frappe.db.set_value(doctype, name, "print_count", current + 1, update_modified=False)
	return {"name": name, "print_count": current + 1}
