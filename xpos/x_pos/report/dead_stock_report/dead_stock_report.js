// Copyright (c) 2025, Kodlyft and contributors
// For license information, please see license.txt

frappe.query_reports["Dead Stock Report"] = {
	filters: [
		{
			fieldname: "company",
			label: __("Company"),
			fieldtype: "Link",
			options: "Company",
			reqd: 1,
			default: frappe.defaults.get_user_default("Company"),
			on_change: function () {
				frappe.query_report.set_filter_value("warehouse", null);
			},
		},
		{
			fieldname: "warehouse",
			label: __("Warehouse"),
			fieldtype: "Link",
			options: "Warehouse",
			get_query: () => {
				return {
					filters: {
						company: frappe.query_report.get_filter_value("company"),
						is_group: 0,
					},
				};
			},
		},
		{
			fieldname: "days",
			label: __("Days"),
			fieldtype: "Int",
			reqd: 1,
			default: 30,
		},
		{
			fieldname: "min_value",
			label: __("Minimum Value"),
			fieldtype: "Float",
			reqd: 1,
			default: 1000,
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
