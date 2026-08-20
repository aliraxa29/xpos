// Copyright (c) 2026 Kodlyft and contributors
// For license information, please see license.txt

frappe.ui.form.on("Sales Invoice", {
	setup: function (frm) {
		frm.set_query("pos_delivery_charges", function (doc) {
			return {
				filters: { company: doc.company, disabled: 0 },
			};
		});
	},
});
