// Copyright (c) 2025, Kodlyft and contributors
// For license information, please see license.txt

frappe.query_reports["Current Stock By Brand"] = {
	filters: [
		{
			fieldname: "brand",
			label: __("Brand"),
			fieldtype: "MultiSelectList",
			options: "Brand",
			reqd: 1,
			get_data: function (txt) {
				return frappe.db.get_link_options("Brand", txt);
			},
		},
	],
};
