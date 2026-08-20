// Copyright (c) 2026, Ali Raza and contributors
// For license information, please see license.txt

frappe.query_reports["POS Shift Reconciliation"] = {
	filters: [
		{
			fieldname: "pos_opening_shift",
			label: __("Opening Shift"),
			fieldtype: "Link",
			options: "POS Opening Shift",
		},
		{
			fieldname: "company",
			label: __("Company"),
			fieldtype: "Link",
			options: "Company",
			default: frappe.defaults.get_default("company"),
		},
		{
			fieldname: "pos_profile",
			label: __("POS Profile"),
			fieldtype: "Link",
			options: "POS Profile",
		},
		{
			fieldname: "from_date",
			label: __("From Date"),
			fieldtype: "Date",
			default: frappe.datetime.get_today(),
		},
		{
			fieldname: "to_date",
			label: __("To Date"),
			fieldtype: "Date",
			default: frappe.datetime.get_today(),
		},
	],
};
