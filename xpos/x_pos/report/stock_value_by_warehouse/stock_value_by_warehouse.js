// Copyright (c) 2025, Kodlyft and contributors
// For license information, please see license.txt

frappe.query_reports["Stock Value by Warehouse"] = {
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
	],
};
