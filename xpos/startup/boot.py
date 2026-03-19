# Copyright (c) 2026, Ali Raxa and Contributors
# For license information, please see license.txt

import frappe


def extend_bootinfo(bootinfo):
    """extending boot session"""
    if frappe.session.user != "Guest":
        bootinfo.countries = frappe.get_all("Country", fields=["name"], order_by="name asc")
        bootinfo.currencies = frappe.get_all("Currency", filters={"enabled": 1}, fields=["name", "currency_name", "symbol"], order_by="name asc")
        bootinfo.territories = frappe.get_all("Territory", filters={"is_group": 0}, fields=["name", "territory_name"], order_by="territory_name asc")
        bootinfo.selling_settings = frappe.get_single("Selling Settings")
        bootinfo.accounts_setting = frappe.get_single("Accounts Settings")
        bootinfo.buying_settings = frappe.get_single("Buying Settings")
        bootinfo.stock_settings = frappe.get_single("Stock Settings")
