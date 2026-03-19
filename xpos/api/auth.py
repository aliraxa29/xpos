# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt

"""
POS offline-authentication API.

``get_pos_users`` returns Frappe users that are assigned to POS profiles,
enriched with their display name, enabled status, and role-based permission
flags stored as custom fields on the Frappe User doctype.  The data is
synced to the local ``pos_users`` table for offline login.
"""

import json
import frappe
from frappe import _
from frappe.utils import cint

# Custom field names on tabUser that hold per-user POS permission flags.
# These should be created via xpos custom-field fixtures; absent fields
# default to 0 (false) so the app remains usable without them.
PERMISSION_FIELDS = [
    "xpos_role",
    "xpos_pos_profile",
    "xpos_warehouse",
    "xpos_company",
    "xpos_theme",
    "xpos_close_bill",
    "xpos_allow_reprint_invoice",
    "xpos_stock_adjustment",
    "xpos_quotation",
    "xpos_apply_additional_discount",
    "xpos_apply_standard_discount",
    "xpos_allow_change_price",
    "xpos_show_edit_discount_field",
    "xpos_show_edit_item_tax_template",
    "xpos_allow_return",
    "xpos_allow_cancel_invoice",
    "xpos_allow_expense",
    "xpos_allow_bank_drop",
    "xpos_discount_limit",
    "xpos_unsettled_invoices",
    "xpos_local_purchase",
    "xpos_purchase_order",
    "xpos_purchase_invoice",
    "xpos_stock_entry",
    "xpos_near_expiry_items",
    "xpos_list_of_invoices",
    "xpos_list_of_cancelled_invoices",
    "xpos_list_of_errors",
    "xpos_list_of_purchase_invoices",
    "xpos_list_of_quotations",
    "xpos_list_of_stock_entries",
    "xpos_list_of_local_purchases",
    "xpos_list_of_stock_adjustments",
    "xpos_list_of_expense",
    "xpos_list_of_bank_drops",
    "xpos_invoice_settlement_report",
    "xpos_sales_report_by_time",
    "xpos_sales_summary_by_hour",
    "xpos_current_stock_by_brand",
    "xpos_stock_register",
    "xpos_current_stock_report",
]


def _get_user_fields():
    """Return the subset of PERMISSION_FIELDS that actually exist on tabUser."""
    meta = frappe.get_meta("User")
    existing = {f.fieldname for f in meta.fields}
    return [f for f in PERMISSION_FIELDS if f in existing]


@frappe.whitelist()
def get_pos_users(
    doctype=None,
    fields=None,
    filters=None,
    order_by="modified asc",
    limit_start=0,
    limit_page_length=100,
):
    """Return POS-enabled Frappe users for offline authentication sync.

    The function signature mirrors ``frappe.client.get_list`` so the sync
    engine can use it as a drop-in ``pullMethod``.

    Returns:
        list[dict]: One record per user with at minimum:
            name, username, full_name, enabled, password_hash (empty),
            role, pos_profile, warehouse, company, theme,
            and all available xpos permission flag fields.
    """
    limit_start = cint(limit_start)
    limit_page_length = cint(limit_page_length)

    # Collect users assigned to any active POS profile.
    profile_users = frappe.db.sql(
        """
        SELECT DISTINCT pu.user
        FROM `tabPOS Profile User` pu
        INNER JOIN `tabPOS Profile` pp ON pp.name = pu.parent
        WHERE pp.disabled = 0
        ORDER BY pu.user
        LIMIT %s OFFSET %s
        """,
        (limit_page_length, limit_start),
        as_dict=True,
    )

    if not profile_users:
        return []

    user_names = [r.user for r in profile_users]

    # Build field list for tabUser query.
    base_fields = ["name", "username", "full_name", "enabled", "modified"]
    available_xpos_fields = _get_user_fields()
    all_fields = base_fields + available_xpos_fields

    users = frappe.get_all(
        "User",
        filters={"name": ["in", user_names]},
        fields=all_fields,
        ignore_permissions=True,
    )

    results = []
    for user in users:
        row = {
            "name": user.name,
            "username": user.username or user.name,
            "full_name": user.full_name or user.name,
            "enabled": cint(user.enabled),
            "modified": str(user.modified) if user.modified else None,
            # password_hash is intentionally empty – offline PIN auth is
            # set up separately via db:create-local-user.
            "password_hash": "",
            "role": user.get("xpos_role") or "Cashier",
            "pos_profile": user.get("xpos_pos_profile") or "",
            "warehouse": user.get("xpos_warehouse") or "",
            "company": user.get("xpos_company") or "",
            "theme": user.get("xpos_theme") or "Default",
            # Permission flags – fall back to 0 when custom fields absent.
            "close_bill": cint(user.get("xpos_close_bill", 1)),
            "allow_reprint_invoice": cint(user.get("xpos_allow_reprint_invoice", 0)),
            "stock_adjustment": cint(user.get("xpos_stock_adjustment", 0)),
            "quotation": cint(user.get("xpos_quotation", 0)),
            "apply_additional_discount": cint(user.get("xpos_apply_additional_discount", 0)),
            "apply_standard_discount": cint(user.get("xpos_apply_standard_discount", 0)),
            "allow_change_price": cint(user.get("xpos_allow_change_price", 0)),
            "show_edit_discount_field": cint(user.get("xpos_show_edit_discount_field", 0)),
            "show_edit_item_tax_template": cint(user.get("xpos_show_edit_item_tax_template", 0)),
            "allow_return": cint(user.get("xpos_allow_return", 0)),
            "allow_cancel_invoice": cint(user.get("xpos_allow_cancel_invoice", 0)),
            "allow_expense": cint(user.get("xpos_allow_expense", 0)),
            "allow_bank_drop": cint(user.get("xpos_allow_bank_drop", 0)),
            "discount_limit": user.get("xpos_discount_limit") or 100,
        }
        results.append(row)

    return results
