# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import cint, flt

from xpos.api.utilities import get_item_search_settings


@frappe.whitelist()
def get_erp_settings():
	"""Fetch all relevant ERPNext settings for local POS caching."""
	settings = {}

	selling = frappe.get_cached_doc("Selling Settings")
	settings["selling_settings"] = {
		"selling_price_list": selling.get("selling_price_list") or "",
		"default_selling_price_list": selling.get("selling_price_list") or "",
		"customer_group": selling.get("customer_group") or "",
		"territory": selling.get("territory") or "",
		"campaign": selling.get("campaign") or "",
		"allow_multiple_items": cint(selling.get("allow_multiple_items")),
		"allow_against_multiple_purchase_orders": cint(selling.get("allow_against_multiple_purchase_orders")),
		"validate_selling_price": cint(selling.get("validate_selling_price")),
		"editable_bundle_item_rates": cint(selling.get("editable_bundle_item_rates")),
		"hide_tax_id": cint(selling.get("hide_tax_id")),
		"so_required": selling.get("so_required") or "No",
		"dn_required": selling.get("dn_required") or "No",
		"allow_sales_order_creation_for_expired_quotation": cint(
			selling.get("allow_sales_order_creation_for_expired_quotation")
		),
		"default_valid_till": selling.get("default_valid_till") or "",
	}

	buying = frappe.get_cached_doc("Buying Settings")
	settings["buying_settings"] = {
		"buying_price_list": buying.get("buying_price_list") or "",
		"default_buying_price_list": buying.get("buying_price_list") or "",
		"supplier_group": buying.get("supplier_group") or "",
		"supp_master_name": buying.get("supp_master_name") or "Supplier Name",
		"maintain_same_rate": cint(buying.get("maintain_same_rate")),
		"allow_multiple_items": cint(buying.get("allow_multiple_items")),
		"po_required": buying.get("po_required") or "No",
		"pr_required": buying.get("pr_required") or "No",
	}

	stock = frappe.get_cached_doc("Stock Settings")
	settings["stock_settings"] = {
		"allow_negative_stock": cint(stock.get("allow_negative_stock")),
		"valuation_method": stock.get("valuation_method") or "FIFO",
		"show_barcode_field": cint(stock.get("show_barcode_field")),
		"auto_insert_price_list_rate_if_missing": cint(stock.get("auto_insert_price_list_rate_if_missing")),
		"automatically_set_serial_nos_based_on_fifo": cint(
			stock.get("automatically_set_serial_nos_based_on_fifo")
		),
		"default_warehouse": stock.get("default_warehouse") or "",
		"stock_uom": stock.get("stock_uom") or "Nos",
		"over_delivery_receipt_allowance": flt(stock.get("over_delivery_receipt_allowance")),
		"item_naming_by": stock.get("item_naming_by") or "Item Code",
	}

	accounts = frappe.get_cached_doc("Accounts Settings")
	settings["accounts_settings"] = {
		"allow_stale": cint(accounts.get("allow_stale")),
		"stale_days": cint(accounts.get("stale_days")),
		"make_payment_via_journal_entry": cint(accounts.get("make_payment_via_journal_entry")),
		"over_billing_allowance": flt(accounts.get("over_billing_allowance")),
		"credit_controller": accounts.get("credit_controller") or "",
		"add_taxes_from_item_tax_template": cint(accounts.get("add_taxes_from_item_tax_template")),
		"automatically_fetch_payment_terms": cint(accounts.get("automatically_fetch_payment_terms")),
		"enable_discount_accounting": cint(accounts.get("enable_discount_accounting")),
		"unlink_payment_on_cancellation_of_invoice": cint(
			accounts.get("unlink_payment_on_cancellation_of_invoice")
		),
		"book_asset_depreciation_entry_automatically": cint(
			accounts.get("book_asset_depreciation_entry_automatically")
		),
	}

	pos = frappe.get_cached_doc("POS Settings")
	settings["pos_settings"] = {
		"invoice_type": pos.get("invoice_type") or "Sales Invoice",
		"post_change_gl_entries": cint(pos.get("post_change_gl_entries")),
	}

	settings["item_search"] = get_item_search_settings()

	settings["global_defaults"] = {
		"default_currency": frappe.db.get_default("currency") or "",
		"default_company": frappe.db.get_default("company") or "",
		"country": frappe.db.get_default("country") or "",
		"language": frappe.db.get_default("lang") or getattr(frappe.local, "lang", "en") or "en",
		"disable_rounded_total": cint(frappe.db.get_single_value("Global Defaults", "disable_rounded_total")),
		"disable_in_words": cint(frappe.db.get_single_value("Global Defaults", "disable_in_words")),
	}

	settings["currency_precision"] = {
		"currency_precision": frappe.db.get_default("currency_precision") or "",
		"float_precision": frappe.db.get_default("float_precision") or "",
	}

	settings["number_format"] = get_number_format_settings()

	return settings


def get_number_format_settings():
	"""Number presentation defaults for the SPA formatter."""
	from frappe.locale import get_number_format

	system_settings = frappe.get_cached_doc("System Settings")

	try:
		number_format = str(get_number_format())
	except KeyError:
		# The stored mask is not one frappe knows; fall back to the raw System Settings value.
		number_format = system_settings.get("number_format") or "#,###.##"

	return {
		"number_format": number_format or "#,###.##",
		"float_precision": system_settings.get("float_precision") or "",
		"currency_precision": system_settings.get("currency_precision") or "",
		"use_number_format_from_currency": cint(system_settings.get("use_number_format_from_currency")),
		"hide_currency_symbol": frappe.db.get_default("hide_currency_symbol") or "",
	}


BRANDING_TOKENS = (
	"background",
	"foreground",
	"card",
	"card_foreground",
	"popover",
	"popover_foreground",
	"primary",
	"primary_foreground",
	"secondary",
	"secondary_foreground",
	"muted",
	"muted_foreground",
	"accent",
	"accent_foreground",
	"destructive",
	"destructive_foreground",
	"border",
	"input",
	"ring",
)


def get_branding_payload():
	"""
	Build the XPOS branding payload consumed by the SPA (boot + offline cache).

	Returns full light/dark color-token maps (hex), the corner radius, logo/favicon
	URLs, and splash options. Safe to call before the doctype exists (returns {} so
	the frontend falls back to its bundled defaults).
	"""
	try:
		doc = frappe.get_cached_doc("XPOS Branding Settings")
	except Exception:
		return {}

	light = {token: (doc.get(f"light_{token}") or "") for token in BRANDING_TOKENS}
	dark = {token: (doc.get(f"dark_{token}") or "") for token in BRANDING_TOKENS}

	return {
		"light": light,
		"dark": dark,
		"radius": flt(doc.get("radius")) or 0.625,
		"logo_light": doc.get("logo_light") or "",
		"logo_dark": doc.get("logo_dark") or "",
		"favicon": doc.get("favicon") or "",
		"splash_background": doc.get("splash_background_color") or "",
		"enable_splash": cint(doc.get("enable_splash")),
	}


@frappe.whitelist()
def get_xpos_branding():
	"""Return the branding payload for online refresh and offline re-caching."""

	return get_branding_payload()


@frappe.whitelist()
def get_currencies():
	"""Return enabled currency codes for dropdowns and cached settings."""

	return frappe.get_all(
		"Currency",
		filters={"enabled": 1},
		fields=["name", "currency_name", "symbol"],
		order_by="name asc",
		limit_page_length=0,
	)


@frappe.whitelist()
def get_languages():
	"""Return enabled language names for dropdowns and cached settings."""

	try:
		rows = frappe.get_all(
			"Language",
			filters={"enabled": 1},
			fields=["name", "language_name"],
			order_by="language_name asc",
			limit_page_length=0,
		)
	except Exception:
		rows = frappe.get_all(
			"Language",
			fields=["name"],
			order_by="name asc",
			limit_page_length=0,
		)

	return [row.get("name") for row in rows if row.get("name")]
