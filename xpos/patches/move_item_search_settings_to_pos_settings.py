# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import cint

RETIRED_POS_PROFILE_FIELDS = (
	"item_search_limit",
	"search_serial_no",
	"search_batch_no",
	"use_limit_search",
	"force_reload_items",
	"display_items_in_stock",
)

CARRIED_CHECK_FIELDS = ("search_serial_no", "search_batch_no")

SEED_SEARCH_FIELDNAMES = ("local_item_name",)


def execute():
	"""Move item-search configuration from POS Profile to the site-wide POS Settings."""
	carry_over_profile_flags()
	seed_pos_search_fields()
	delete_retired_pos_profile_fields()

	frappe.clear_cache(doctype="POS Profile")
	frappe.clear_document_cache("POS Settings", "POS Settings")


def carry_over_profile_flags():
	"""Reconcile per-profile values into one site-wide setting."""
	if not frappe.db.has_column("POS Profile", "item_search_limit"):
		return

	profiles = frappe.get_all(
		"POS Profile",
		filters={"disabled": 0},
		fields=["name", "item_search_limit", *CARRIED_CHECK_FIELDS],
	)
	if not profiles:
		return

	for fieldname in CARRIED_CHECK_FIELDS:
		if any(cint(profile.get(fieldname)) for profile in profiles):
			frappe.db.set_single_value("POS Settings", fieldname, 1)

	limits = [
		cint(profile.get("item_search_limit"))
		for profile in profiles
		if cint(profile.get("item_search_limit")) > 0
	]
	if limits:
		frappe.db.set_single_value("POS Settings", "item_search_limit", max(limits))

	print(f"Carried item-search settings from {len(profiles)} POS Profile(s) to POS Settings")


def seed_pos_search_fields():
	"""Add the Item columns X POS used to search unconditionally."""
	row_filters = {"parent": "POS Settings", "parentfield": "pos_search_fields"}
	existing = set(frappe.get_all("POS Search Fields", filters=row_filters, pluck="fieldname"))
	idx = frappe.db.count("POS Search Fields", row_filters)
	meta = frappe.get_meta("Item")

	for fieldname in SEED_SEARCH_FIELDNAMES:
		if fieldname in existing or not meta.has_field(fieldname):
			continue

		docfield = meta.get_field(fieldname)
		idx += 1
		frappe.get_doc(
			{
				"doctype": "POS Search Fields",
				"parent": "POS Settings",
				"parenttype": "POS Settings",
				"parentfield": "pos_search_fields",
				"idx": idx,
				"field": docfield.label or fieldname,
				"fieldname": fieldname,
			}
		).insert(ignore_permissions=True)
		print(f"Seeded POS Settings.pos_search_fields row for {fieldname}")


def delete_retired_pos_profile_fields():
	"""sync_customizations never deletes unlisted Custom Fields, so remove them here."""
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
