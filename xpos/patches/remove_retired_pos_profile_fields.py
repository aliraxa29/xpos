# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt

import frappe

RETIRED_POS_PROFILE_FIELDS = (
	"create_pos_invoice_instead_of_sales_invoice",
	"auto_delete_draft_invoice",
	"allow_delete",
	"display_authorization_code",
	"fetch_items_directly_from_server",
)


def execute():
	"""Removing POS Profile custom fields that the app no longer reads."""
	for fieldname in RETIRED_POS_PROFILE_FIELDS:
		custom_field_name = f"POS Profile-{fieldname}"
		if frappe.db.exists("Custom Field", custom_field_name):
			frappe.delete_doc("Custom Field", custom_field_name, force=1)

		property_setters = frappe.get_all(
			"Property Setter",
			filters={"doc_type": "POS Profile", "field_name": fieldname},
			pluck="name",
		)
		for property_setter in property_setters:
			frappe.delete_doc("Property Setter", property_setter, force=1)

	frappe.clear_cache(doctype="POS Profile")
