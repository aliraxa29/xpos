// Copyright (c) 2026 Kodlyft and contributors
// For license information, please see license.txt

frappe.ui.form.on("POS Profile", {
	setup: function (frm) {
		frm.set_query("cash_mode_of_payment", function (doc) {
			return {
				filters: { type: "Cash" },
			};
		});

		frm.set_query("default_pos_expense_account", function (doc) {
			return {
				filters: {
					company: doc.company,
					is_group: 0,
					root_type: "Expense",
				},
			};
		});

		frm.set_query("back_office_cash_account", function (doc) {
			return {
				filters: {
					company: doc.company,
					is_group: 0,
					account_type: "Cash",
				},
			};
		});

		frm.set_query("default_source_account", function (doc) {
			return {
				filters: {
					company: doc.company,
					is_group: 0,
					account_type: "Cash",
				},
			};
		});

		frm.set_query("account", "allowed_expense_accounts", function (doc) {
			return {
				filters: {
					company: doc.company,
					is_group: 0,
					root_type: "Expense",
				},
			};
		});

		frm.set_query("erp_tax_account", "purchase_taxes", function (doc) {
			return {
				filters: {
					company: doc.company,
					is_group: 0,
					account_type: "Tax",
				},
			};
		});

		frm.set_query("account", "allowed_source_accounts", function (doc) {
			return {
				filters: {
					company: doc.company,
					is_group: 0,
					account_type: "Cash",
				},
			};
		});
	},
});
