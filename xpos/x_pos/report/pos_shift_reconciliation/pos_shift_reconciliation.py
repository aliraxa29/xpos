# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt

"""Per-shift reconciliation (Z-report).

Returns the items sold during a POS shift (qty + amount) as the main table, and
the totals by payment mode (plus headline figures) as the report summary, so a
supervisor can reconcile the till at end of shift.
"""

import frappe
from frappe import _
from frappe.utils import flt

from xpos.api.utilities import get_invoice_type


def execute(filters=None):
	filters = frappe.parse_json(filters) if filters else {}
	doctype = get_invoice_type()
	invoices = _get_invoices(filters, doctype)
	return (
		get_columns(),
		_get_items_sold(invoices, doctype),
		None,
		None,
		_get_report_summary(invoices, doctype),
	)


def _get_invoices(filters, doctype):
	conditions = {"docstatus": 1, "is_pos": 1}
	if doctype == "POS Invoice":
		conditions["consolidated_invoice"] = ["in", ["", None]]

	if filters.get("pos_opening_shift"):
		conditions["pos_opening_shift"] = filters["pos_opening_shift"]
	else:
		if filters.get("company"):
			conditions["company"] = filters["company"]
		if filters.get("pos_profile"):
			conditions["pos_profile"] = filters["pos_profile"]
		if filters.get("from_date") and filters.get("to_date"):
			conditions["posting_date"] = ["between", [filters["from_date"], filters["to_date"]]]

	return frappe.get_all(
		doctype,
		filters=conditions,
		fields=["name", "grand_total", "net_total", "change_amount", "is_return"],
	)


def _get_items_sold(invoices, doctype):
	names = [inv["name"] for inv in invoices]
	if not names:
		return []

	from frappe.query_builder import DocType
	from frappe.query_builder.functions import Round, Sum

	item = DocType(f"{doctype} Item")
	return (
		frappe.qb.from_(item)
		.select(
			item.item_code,
			item.item_name,
			item.uom,
			Round(Sum(item.qty), 3).as_("qty"),
			Round(Sum(item.amount), 2).as_("amount"),
		)
		.where((item.parent.isin(names)) & (item.parenttype == doctype))
		.groupby(item.item_code)
		.orderby(item.item_name)
		.run(as_dict=True)
	)


def _get_report_summary(invoices, doctype):
	# Totals by payment mode, mirroring xpos.api.shifts.get_shift_summary so the
	# report and the closing dialog always agree (change is distributed across
	# the modes used on each invoice).
	payment_summary = {}
	for inv in invoices:
		payments = frappe.get_all(
			"Sales Invoice Payment",
			filters={"parent": inv["name"], "parenttype": doctype},
			fields=["mode_of_payment", "amount"],
		)
		inv_change = flt(inv.get("change_amount"))
		inv_paid = sum(flt(p["amount"]) for p in payments)
		for p in payments:
			pay_amount = flt(p["amount"])
			if inv_paid > 0 and inv_change > 0:
				pay_amount -= pay_amount / inv_paid * inv_change
			mode = p["mode_of_payment"]
			payment_summary[mode] = payment_summary.get(mode, 0) + pay_amount

	grand_total = sum(flt(inv.get("grand_total")) for inv in invoices)
	returns_count = sum(1 for inv in invoices if inv.get("is_return"))

	summary = [
		{"label": _("Total Invoices"), "value": len(invoices), "indicator": "Blue"},
		{"label": _("Returns"), "value": returns_count, "indicator": "Red" if returns_count else "Grey"},
		{
			"label": _("Grand Total"),
			"value": flt(grand_total, 2),
			"datatype": "Currency",
			"indicator": "Green",
		},
	]
	for mode, amount in sorted(payment_summary.items()):
		summary.append({"label": mode, "value": flt(amount, 2), "datatype": "Currency", "indicator": "Green"})
	return summary


def get_columns():
	return [
		{
			"label": _("Item Code"),
			"fieldname": "item_code",
			"fieldtype": "Link",
			"options": "Item",
			"width": 180,
		},
		{
			"label": _("Item Name"),
			"fieldname": "item_name",
			"fieldtype": "Data",
			"width": 260,
		},
		{
			"label": _("UOM"),
			"fieldname": "uom",
			"fieldtype": "Link",
			"options": "UOM",
			"width": 90,
		},
		{
			"label": _("Qty Sold"),
			"fieldname": "qty",
			"fieldtype": "Float",
			"width": 110,
		},
		{
			"label": _("Amount"),
			"fieldname": "amount",
			"fieldtype": "Currency",
			"width": 140,
		},
	]
