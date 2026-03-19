# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt

"""
Stock Transfer / In-Transit Receiving API

Handles the ERPNext Material Transfer → In-Transit → Receive workflow:
1. Head office creates Stock Entry (Material Transfer + add_to_transit=1)
   Items go: Source Warehouse → In-Transit Warehouse
2. Target warehouse user receives the stock via a second Stock Entry
   Items go: In-Transit Warehouse → Target Warehouse
3. If quantities are short, the shortages can be returned to source
"""

import json

import frappe
from frappe import _
from frappe.utils import cint, flt, nowdate

from .utils import get_default_warehouse


@frappe.whitelist()
def get_in_transit_transfers(warehouse=None, limit=50):
    """
    Get Stock Entries that are in-transit and destined for the given warehouse.

    These are Stock Entries where:
    - purpose = 'Material Transfer'
    - add_to_transit = 1
    - docstatus = 1
    - per_transferred < 100 (not fully received yet)
    - The original items had t_warehouse (transit warehouse) set

    We match entries whose items originally came from a source and are going
    to the user's warehouse (the original items may specify the eventual
    target via the Material Request or we detect by company/warehouse).
    """
    limit = cint(limit) or 50

    filters = {
        "docstatus": 1,
        "purpose": "Material Transfer",
        "add_to_transit": 1,
        "per_transferred": ["<", 100],
    }

    # If warehouse is specified, filter entries where items are destined for this warehouse
    # In ERPNext in-transit flow, items go source_warehouse -> transit_warehouse
    # The eventual target is often determined by the Material Request or manual assignment
    # We'll look at entries that have items in transit warehouses

    entries = frappe.get_all(
        "Stock Entry",
        filters=filters,
        fields=[
            "name", "company", "posting_date", "from_warehouse",
            "to_warehouse", "total_amount", "per_transferred",
            "remarks", "docstatus",
        ],
        order_by="posting_date desc",
        limit_page_length=limit,
    )

    if not entries:
        return []

    entry_names = [e.name for e in entries]

    # Fetch items for these entries
    items = frappe.get_all(
        "Stock Entry Detail",
        filters={"parent": ["in", entry_names], "docstatus": 1},
        fields=[
            "name as ste_detail", "parent", "item_code", "item_name",
            "qty", "transfer_qty", "uom", "stock_uom", "conversion_factor",
            "basic_rate", "valuation_rate", "amount",
            "s_warehouse", "t_warehouse",
        ],
    )

    # Group items by parent
    items_by_entry = {}
    for item in items:
        items_by_entry.setdefault(item["parent"], []).append(item)

    # If warehouse filter, only keep entries that have transit warehouse items
    # where items could be received at the target warehouse
    result = []
    for entry in entries:
        entry_items = items_by_entry.get(entry["name"], [])
        if not entry_items:
            continue

        # Calculate how much has been transferred (received) for each item
        for item in entry_items:
            received = _get_received_qty(entry["name"], item["ste_detail"])
            item["received_qty"] = received
            item["pending_qty"] = flt(item["qty"]) - received

        # Filter out entries with no pending items
        pending_items = [i for i in entry_items if i["pending_qty"] > 0]
        if not pending_items:
            continue

        # If a warehouse filter is given, check if we should show this entry
        # We show entries where the target warehouse (eventual destination)
        # could be the user's warehouse. The transit warehouse's parent or
        # linked warehouse often determines this. For simplicity, we show
        # all in-transit entries for the company and let the user receive.
        if warehouse:
            # Check if any items are in a transit warehouse and could be directed
            # to the user's warehouse (we show all in-transit for now)
            company = entry.get("company")
            user_company = frappe.db.get_value("Warehouse", warehouse, "company")
            if company and user_company and company != user_company:
                continue

        entry["items"] = pending_items
        entry["total_pending_items"] = len(pending_items)
        entry["source_warehouse"] = entry.get("from_warehouse") or (
            pending_items[0].get("s_warehouse") if pending_items else ""
        )
        entry["transit_warehouse"] = entry.get("to_warehouse") or (
            pending_items[0].get("t_warehouse") if pending_items else ""
        )
        result.append(entry)

    return result


def _get_received_qty(outgoing_entry, ste_detail):
    """Get how much quantity has already been received against an outgoing entry item."""
    received = frappe.db.sql(
        """
        SELECT IFNULL(SUM(sed.qty), 0)
        FROM `tabStock Entry Detail` sed
        JOIN `tabStock Entry` se ON se.name = sed.parent
        WHERE se.docstatus = 1
          AND se.purpose = 'Material Transfer'
          AND se.outgoing_stock_entry = %s
          AND sed.ste_detail = %s
        """,
        (outgoing_entry, ste_detail),
    )
    return flt(received[0][0]) if received else 0


@frappe.whitelist()
def get_transfer_detail(stock_entry):
    """Get detailed info for a single in-transit stock entry."""
    if not stock_entry or not frappe.db.exists("Stock Entry", stock_entry):
        frappe.throw(_("Stock Entry {0} does not exist.").format(stock_entry))

    se = frappe.get_doc("Stock Entry", stock_entry)

    if se.purpose != "Material Transfer" or not se.add_to_transit:
        frappe.throw(_("Stock Entry {0} is not a Material Transfer with in-transit.").format(stock_entry))

    items = []
    for item in se.items:
        received = _get_received_qty(se.name, item.name)
        pending = flt(item.qty) - received
        if pending <= 0:
            continue

        items.append({
            "ste_detail": item.name,
            "item_code": item.item_code,
            "item_name": item.item_name,
            "qty": flt(item.qty),
            "received_qty": received,
            "pending_qty": pending,
            "uom": item.uom,
            "stock_uom": item.stock_uom,
            "conversion_factor": flt(item.conversion_factor) or 1,
            "basic_rate": flt(item.basic_rate),
            "valuation_rate": flt(item.valuation_rate),
            "s_warehouse": item.s_warehouse,
            "t_warehouse": item.t_warehouse,
        })

    return {
        "name": se.name,
        "company": se.company,
        "posting_date": str(se.posting_date),
        "from_warehouse": se.from_warehouse,
        "to_warehouse": se.to_warehouse,
        "total_amount": flt(se.total_amount),
        "per_transferred": flt(se.per_transferred),
        "remarks": se.remarks or "",
        "items": items,
    }


@frappe.whitelist()
def receive_transit_stock(data):
    """
    Receive in-transit stock at the target warehouse.

    Creates a new Stock Entry with:
    - purpose = 'Material Transfer'
    - outgoing_stock_entry = the original in-transit entry
    - Items: from transit warehouse → target warehouse

    data = {
        "outgoing_stock_entry": "STE-00001",
        "target_warehouse": "Stores - Company",
        "items": [
            {
                "ste_detail": "row-id",
                "item_code": "ITEM-001",
                "receive_qty": 10,
            }
        ],
        "remarks": "Received at warehouse"
    }

    If receive_qty < original qty, the difference is the shortage.
    """
    payload = json.loads(data) if isinstance(data, str) else data

    outgoing_entry_name = payload.get("outgoing_stock_entry")
    if not outgoing_entry_name:
        frappe.throw(_("Outgoing Stock Entry is required."))

    outgoing_se = frappe.get_doc("Stock Entry", outgoing_entry_name)

    if outgoing_se.docstatus != 1:
        frappe.throw(_("Stock Entry {0} is not submitted.").format(outgoing_entry_name))

    if outgoing_se.purpose != "Material Transfer" or not outgoing_se.add_to_transit:
        frappe.throw(_("Stock Entry {0} is not a valid in-transit transfer.").format(outgoing_entry_name))

    if flt(outgoing_se.per_transferred) >= 100:
        frappe.throw(_("Stock Entry {0} has already been fully received.").format(outgoing_entry_name))

    target_warehouse = payload.get("target_warehouse")
    if not target_warehouse:
        target_warehouse = get_default_warehouse()
    if not target_warehouse:
        frappe.throw(_("Target warehouse is required."))

    items_data = payload.get("items", [])
    remarks = payload.get("remarks", "")

    if not items_data:
        frappe.throw(_("No items to receive."))

    # Build outgoing items map
    outgoing_items_map = {item.name: item for item in outgoing_se.items}

    # Create the receiving Stock Entry
    receive_se = frappe.get_doc({
        "doctype": "Stock Entry",
        "purpose": "Material Transfer",
        "stock_entry_type": "Material Transfer",
        "outgoing_stock_entry": outgoing_entry_name,
        "company": outgoing_se.company,
        "posting_date": nowdate(),
        "remarks": remarks or _("Received at {0}").format(target_warehouse),
    })

    total_received = 0
    total_shortage = 0

    for row in items_data:
        ste_detail = row.get("ste_detail")
        outgoing_item = outgoing_items_map.get(ste_detail)
        if not outgoing_item:
            continue

        receive_qty = flt(row.get("receive_qty", 0))
        if receive_qty <= 0:
            continue

        # Check pending qty
        already_received = _get_received_qty(outgoing_entry_name, ste_detail)
        max_receivable = flt(outgoing_item.qty) - already_received
        if receive_qty > max_receivable:
            receive_qty = max_receivable

        if receive_qty <= 0:
            continue

        # Source = transit warehouse (where stock currently sits)
        # Target = the actual target warehouse
        receive_se.append("items", {
            "item_code": outgoing_item.item_code,
            "item_name": outgoing_item.item_name,
            "qty": receive_qty,
            "uom": outgoing_item.uom,
            "stock_uom": outgoing_item.stock_uom,
            "conversion_factor": outgoing_item.conversion_factor or 1,
            "s_warehouse": outgoing_item.t_warehouse,  # from transit warehouse
            "t_warehouse": target_warehouse,             # to target warehouse
            "basic_rate": outgoing_item.basic_rate,
            "valuation_rate": outgoing_item.valuation_rate,
            "against_stock_entry": outgoing_entry_name,
            "ste_detail": ste_detail,
        })

        total_received += receive_qty
        shortage = max_receivable - receive_qty
        if shortage > 0:
            total_shortage += shortage

    if not receive_se.items:
        frappe.throw(_("No valid items to receive."))

    receive_se.flags.ignore_permissions = True
    receive_se.insert()
    receive_se.submit()

    result = {
        "stock_entry": receive_se.name,
        "outgoing_stock_entry": outgoing_entry_name,
        "status": "completed",
        "items_received": len(receive_se.items),
        "total_received_qty": total_received,
        "total_shortage_qty": total_shortage,
        "has_shortage": total_shortage > 0,
    }

    return result


@frappe.whitelist()
def return_shortage_to_source(data):
    """
    Return shortage stock from transit warehouse back to source warehouse.

    When the receiving warehouse finds that some items are missing/damaged,
    they can return the remaining qty from transit back to source.

    data = {
        "outgoing_stock_entry": "STE-00001",
        "items": [
            {
                "ste_detail": "row-id",
                "item_code": "ITEM-001",
                "return_qty": 2,
                "reason": "Damaged in transit"
            }
        ],
        "remarks": "Items damaged during transport"
    }
    """
    payload = json.loads(data) if isinstance(data, str) else data

    outgoing_entry_name = payload.get("outgoing_stock_entry")
    if not outgoing_entry_name:
        frappe.throw(_("Outgoing Stock Entry is required."))

    outgoing_se = frappe.get_doc("Stock Entry", outgoing_entry_name)

    if outgoing_se.docstatus != 1:
        frappe.throw(_("Stock Entry {0} is not submitted.").format(outgoing_entry_name))

    items_data = payload.get("items", [])
    remarks = payload.get("remarks", "")

    if not items_data:
        frappe.throw(_("No items to return."))

    outgoing_items_map = {item.name: item for item in outgoing_se.items}

    # Create a return Stock Entry: transit warehouse → source warehouse
    return_se = frappe.get_doc({
        "doctype": "Stock Entry",
        "purpose": "Material Transfer",
        "stock_entry_type": "Material Transfer",
        "outgoing_stock_entry": outgoing_entry_name,
        "company": outgoing_se.company,
        "posting_date": nowdate(),
        "remarks": remarks or _("Shortage return from transit to source"),
    })

    total_returned = 0

    for row in items_data:
        ste_detail = row.get("ste_detail")
        outgoing_item = outgoing_items_map.get(ste_detail)
        if not outgoing_item:
            continue

        return_qty = flt(row.get("return_qty", 0))
        if return_qty <= 0:
            continue

        # Check how much is still in transit (not yet received)
        already_received = _get_received_qty(outgoing_entry_name, ste_detail)
        max_in_transit = flt(outgoing_item.qty) - already_received
        if return_qty > max_in_transit:
            return_qty = max_in_transit

        if return_qty <= 0:
            continue

        # Move from transit warehouse back to source warehouse
        return_se.append("items", {
            "item_code": outgoing_item.item_code,
            "item_name": outgoing_item.item_name,
            "qty": return_qty,
            "uom": outgoing_item.uom,
            "stock_uom": outgoing_item.stock_uom,
            "conversion_factor": outgoing_item.conversion_factor or 1,
            "s_warehouse": outgoing_item.t_warehouse,  # from transit warehouse
            "t_warehouse": outgoing_item.s_warehouse,   # back to source warehouse
            "basic_rate": outgoing_item.basic_rate,
            "valuation_rate": outgoing_item.valuation_rate,
            "against_stock_entry": outgoing_entry_name,
            "ste_detail": ste_detail,
        })

        total_returned += return_qty

    if not return_se.items:
        frappe.throw(_("No valid items to return."))

    return_se.flags.ignore_permissions = True
    return_se.insert()
    return_se.submit()

    return {
        "stock_entry": return_se.name,
        "outgoing_stock_entry": outgoing_entry_name,
        "status": "completed",
        "items_returned": len(return_se.items),
        "total_returned_qty": total_returned,
    }
