// Copyright (c) 2025, Kodlyft and contributors
// For license information, please see license.txt

frappe.query_reports["Stock Value Summary by Date"] = {
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
			fieldname: "from_posting_date",
			label: __("From Posting Date"),
			fieldtype: "Date",
			default: frappe.datetime.get_today(),
			reqd: 1,
		},
	],
};
