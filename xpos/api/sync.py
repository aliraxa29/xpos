# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt

"""
Generic child-table data endpoint for the xpos sync engine.

Frappe v14+ blocks direct ``frappe.client.get_list`` access to child-table
doctypes (they raise ``PermissionError`` via ``check_parent_permission``).
This whitelisted endpoint provides access to a curated allowlist of child
tables that the POS needs for offline operation, using ``frappe.get_all``
with ``ignore_permissions=True``.

Only doctypes explicitly listed in ALLOWED_CHILD_DOCTYPES are accessible.
"""

import json
import frappe
from frappe import _
from frappe.utils import cint

# Exhaustive list of child-table doctypes the POS sync engine may request.
ALLOWED_CHILD_DOCTYPES = {
    "Mode of Payment Account",
    "POS Payment Method",
    "Item Barcode",
    "UOM Conversion Detail",
    "Item Tax",
    "Item Supplier",
    "Item Reorder",
    "Item Tax Template Detail",
    "Sales Taxes and Charges",
    "Pricing Rule Item Code",
    "Pricing Rule Item Group",
    "Pricing Rule Brand",
}


@frappe.whitelist()
def get_child_table_data(
    doctype,
    fields=None,
    filters=None,
    order_by="modified asc",
    limit_start=0,
    limit_page_length=500,
):
    """Return records from a whitelisted child-table doctype.

    Parameters mirror ``frappe.client.get_list`` so the sync engine can use
    this as a drop-in ``pullMethod`` replacement.

    Args:
        doctype: Child-table doctype name (must be in ALLOWED_CHILD_DOCTYPES).
        fields: JSON string or list of field names to return.
        filters: JSON string or dict of filters.
        order_by: ORDER BY clause (e.g. ``"modified asc"``).
        limit_start: Pagination offset.
        limit_page_length: Page size.

    Returns:
        list[dict]: Matching records.

    Raises:
        frappe.PermissionError: If *doctype* is not in the allowlist.
    """
    if doctype not in ALLOWED_CHILD_DOCTYPES:
        frappe.throw(
            _("Doctype {0} is not permitted via this endpoint").format(doctype),
            frappe.PermissionError,
        )

    if isinstance(fields, str):
        fields = json.loads(fields)
    if isinstance(filters, str):
        filters = json.loads(filters)
    if not isinstance(filters, dict):
        filters = {}

    limit_start = cint(limit_start)
    limit_page_length = cint(limit_page_length)

    return frappe.get_all(
        doctype,
        fields=fields or ["name"],
        filters=filters,
        order_by=order_by,
        start=limit_start,
        page_length=limit_page_length,
        ignore_permissions=True,
    )


@frappe.whitelist()
def get_item_prices(
    fields=None,
    filters=None,
    order_by="modified asc",
    limit_start=0,
    limit_page_length=500,
):
    """Return Item Price records for the sync engine.

    Uses ``ignore_permissions=True`` so the POS API key user does not
    need explicit read permission on the Item Price doctype.  Only
    selling-relevant fields are exposed.

    Args:
        fields: JSON string or list of field names to return.
        filters: JSON string or dict of additional filters.
        order_by: ORDER BY clause (default ``"modified asc"``).
        limit_start: Pagination offset.
        limit_page_length: Page size (default 500).

    Returns:
        list[dict]: Matching Item Price records.
    """
    if isinstance(fields, str):
        fields = json.loads(fields)
    if isinstance(filters, str):
        filters = json.loads(filters)
    if not isinstance(filters, dict):
        filters = {}

    limit_start = cint(limit_start)
    limit_page_length = cint(limit_page_length)

    # Default to the full set of fields the sync engine needs
    if not fields:
        fields = [
            "name", "item_code", "item_name", "price_list",
            "buying", "selling", "currency", "price_list_rate",
            "uom", "valid_from", "valid_upto", "modified",
        ]

    return frappe.get_all(
        "Item Price",
        fields=fields,
        filters=filters,
        order_by=order_by,
        start=limit_start,
        page_length=limit_page_length,
        ignore_permissions=True,
    )

