// Copyright (c) 2026, Kodlyft and contributors
// For license information, please see license.txt

frappe.listview_settings["POS Opening Shift"] = {
	get_indicator: function (doc) {
		var status_color = {
			Draft: "grey",
			Open: "orange",
			Closed: "green",
			Cancelled: "red",
		};
		return [__(doc.status), status_color[doc.status], "status,=," + doc.status];
	},
};
