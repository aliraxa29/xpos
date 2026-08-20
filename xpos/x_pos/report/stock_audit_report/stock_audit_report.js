// Copyright (c) 2026, Ali Raza and contributors
// For license information, please see license.txt

frappe.query_reports["Stock Audit Report"] = {
	filters: [
		{
			fieldname: "company",
			label: __("Company"),
			fieldtype: "Link",
			options: "Company",
			default: frappe.defaults.get_user_default("Company"),
			reqd: 1,
		},
		{
			fieldname: "warehouse",
			label: __("Warehouses"),
			fieldtype: "MultiSelectList",
			options: "Warehouse",
			get_data: function (txt) {
				const company = frappe.query_report.get_filter_value("company");

				return frappe.db.get_link_options("Warehouse", txt, {
					company: company,
				});
			},
		},
		{
			fieldname: "item_group",
			label: __("Item Group"),
			fieldtype: "MultiSelectList",
			options: "Item Group",
			get_data: function (txt) {
				return frappe.db.get_link_options("Item Group", txt);
			},
		},
		{
			fieldname: "brand",
			label: __("Brand"),
			fieldtype: "MultiSelectList",
			options: "Brand",
			get_data: function (txt) {
				return frappe.db.get_link_options("Brand", txt);
			},
		},
		{
			fieldname: "supplier",
			label: __("Supplier"),
			fieldtype: "MultiSelectList",
			options: "Supplier",
			get_data: function (txt) {
				return frappe.db.get_link_options("Supplier", txt);
			},
		},
	],
};
