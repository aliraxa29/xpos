# Copyright (c) 2025, Kodlyft and contributors
# For license information, please see license.txt

import frappe
from frappe import _


def execute(filters=None):
	columns, data = get_columns(), get_stock_balance(filters)
	return columns, data


def get_stock_balance(filters):
	query = """
        SELECT
            sle.warehouse,
            SUM(sle.actual_qty * sle.incoming_rate) AS balance
        FROM `tabStock Ledger Entry` AS sle
        WHERE sle.posting_date <= %(from_posting_date)s
        AND is_cancelled = 0
        AND company = %(company)s
        GROUP BY sle.warehouse
    """

	return frappe.db.sql(
		query,
		{"from_posting_date": filters.get("from_posting_date"), "company": filters.get("company")},
		as_dict=True,
	)


def get_columns():
	return [
		{
			"label": _("Warehouse"),
			"fieldname": "warehouse",
			"fieldtype": "Link",
			"options": "Warehouse",
			"width": 200,
		},
		{
			"label": _("Balance"),
			"fieldname": "balance",
			"fieldtype": "Currency",
			"width": 150,
		},
	]
