# Copyright (c) 2026, Ali Raxa and Contributors
# For license information, please see license.txt

import frappe

from xpos.api.auth import can_manage_role_permissions, get_current_user_permissions
from xpos.api.settings import get_branding_payload, get_number_format_settings
from xpos.api.utilities import get_item_search_settings


def extend_bootinfo(bootinfo):
	"""extending boot session"""
	if frappe.session.user != "Guest":
		bootinfo.countries = frappe.get_all("Country", fields=["name"], order_by="name asc")
		bootinfo.currencies = frappe.get_all(
			"Currency",
			filters={"enabled": 1},
			fields=[
				"name",
				"currency_name",
				"symbol",
				"number_format",
				"smallest_currency_fraction_value",
				"symbol_on_right",
			],
			order_by="name asc",
		)
		bootinfo.territories = frappe.get_all(
			"Territory",
			filters={"is_group": 0},
			fields=["name", "territory_name"],
			order_by="territory_name asc",
		)
		bootinfo.selling_settings = frappe.get_single("Selling Settings")
		bootinfo.accounts_setting = frappe.get_single("Accounts Settings")
		bootinfo.buying_settings = frappe.get_single("Buying Settings")
		bootinfo.stock_settings = frappe.get_single("Stock Settings")
		bootinfo.pos_settings = frappe.get_single("POS Settings")
		bootinfo.xpos_item_search = get_item_search_settings()
		bootinfo.xpos_number_format = get_number_format_settings()

		user_rights = get_current_user_permissions()
		bootinfo.xpos_role = user_rights.get("role")
		bootinfo.xpos_permissions = user_rights.get("permissions")
		bootinfo.xpos_is_system_manager = (
			frappe.session.user == "Administrator"
			or "System Manager" in frappe.get_roles(frappe.session.user)
		)
		bootinfo.xpos_can_manage_permissions = can_manage_role_permissions()
		bootinfo.xpos_branding = get_branding_payload()
