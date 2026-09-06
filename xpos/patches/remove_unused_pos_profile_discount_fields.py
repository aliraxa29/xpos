import frappe

UNUSED_POS_PROFILE_FIELDS = (
	"display_discount",
	"use_percentage_discount",
)


def execute():
	for fieldname in UNUSED_POS_PROFILE_FIELDS:
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
