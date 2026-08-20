# Copyright (c) 2025, Kodlyft and contributors
# For license information, please see license.txt

import frappe
from frappe import _


def execute(filters=None):
	filters = frappe.parse_json(filters) if filters else {}
	return get_columns(), get_data(filters)


def get_data(filters):
	query = """
        SELECT
            tsi.item_code,
            tsi.item_name,
            tsi.warehouse,
            ROUND(tsi.price_list_rate / tsi.conversion_factor, 2) AS selling_price,
            ROUND(SUM(tsi.stock_qty), 2) AS sold_qty,
            ROUND(tsi.incoming_rate * tsi.conversion_factor, 2) AS rate,
            ROUND(tsi.conversion_factor, 2) AS conversion_factor,
            tsi.uom,
            ti.brand,
            ROUND(IFNULL(bin.actual_qty, 0), 2) AS current_stock,
            v.supplier
        FROM `tabSales Invoice Item` tsi
        INNER JOIN `tabSales Invoice` ts ON tsi.parent = ts.name
        INNER JOIN `tabItem` ti ON tsi.item_code = ti.item_code
        LEFT JOIN `tabBin` bin ON tsi.item_code = bin.item_code
        LEFT JOIN `tabItem Supplier` v ON tsi.item_code = v.parent
        WHERE
            ts.company = %(company)s
            AND tsi.docstatus = 1
            AND ts.posting_date BETWEEN %(from_date)s AND %(to_date)s
            AND ROUND(IFNULL(bin.actual_qty, 0), 2) <= %(min_qty)s
        GROUP BY tsi.item_code, tsi.warehouse
        ORDER BY tsi.item_name, tsi.warehouse ASC
    """

	return frappe.db.sql(query, filters, as_dict=True)


def get_columns():
	return [
		{
			"label": _("Item Code"),
			"fieldname": "item_code",
			"fieldtype": "Link",
			"options": "Item",
			"width": 150,
		},
		{
			"label": _("Item Name"),
			"fieldname": "item_name",
			"fieldtype": "Data",
			"width": 200,
		},
		{
			"label": _("Warehouse"),
			"fieldname": "warehouse",
			"fieldtype": "Link",
			"options": "Warehouse",
			"width": 200,
		},
		{
			"label": _("Brand"),
			"fieldname": "brand",
			"fieldtype": "Link",
			"options": "Brand",
			"width": 200,
		},
		{
			"label": _("Supplier"),
			"fieldname": "supplier",
			"fieldtype": "Link",
			"options": "Supplier",
			"width": 200,
		},
		{
			"label": _("Selling Price"),
			"fieldname": "selling_price",
			"fieldtype": "Currency",
			"width": 150,
		},
		{
			"label": _("Sold Qty"),
			"fieldname": "sold_qty",
			"fieldtype": "Int",
			"width": 100,
		},
		{
			"label": _("Current Stock"),
			"fieldname": "current_stock",
			"fieldtype": "Int",
			"width": 150,
		},
	]
