# Copyright (c) 2025, Kodlyft and contributors
# For license information, please see license.txt

import frappe
from frappe import _


def execute(filters=None):
	columns, data = get_columns(), get_data(filters)
	return columns, data


def get_data(filters):
	query = """
        SELECT
            se.name,
            se.posting_date,
            sed.t_warehouse,
            sed.s_warehouse
        FROM `tabStock Entry` se
        INNER JOIN `tabStock Entry Detail` sed ON se.name = sed.parent
        WHERE
            se.docstatus = 1
            AND se.company = %(company)s
            AND se.posting_date = %(date)s
            AND (
                sed.t_warehouse = %(warehouse)s
                OR (sed.s_warehouse = '' AND se.purpose = 'Material Transfer')
            )
        GROUP BY se.name, sed.t_warehouse
    """

	data = frappe.db.sql(
		query,
		{
			"date": filters.get("date"),
			"warehouse": filters.get("warehouse"),
			"company": filters.get("company"),
		},
		as_dict=True,
	)
	return data


def get_columns():
	return [
		{
			"label": _("Stock Entry ID"),
			"fieldname": "name",
			"fieldtype": "Link",
			"options": "Stock Entry",
			"width": 150,
		},
		{
			"label": _("Posting Date"),
			"fieldname": "posting_date",
			"fieldtype": "Date",
			"width": 120,
		},
		{
			"label": _("Target Warehouse"),
			"fieldname": "t_warehouse",
			"fieldtype": "Link",
			"options": "Warehouse",
			"width": 200,
		},
		{
			"label": _("Source Warehouse"),
			"fieldname": "s_warehouse",
			"fieldtype": "Link",
			"options": "Warehouse",
			"width": 200,
		},
	]
