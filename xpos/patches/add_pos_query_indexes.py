# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt

"""Create the indexes the POS hot paths depend on.

Supersedes `add_composite_indexes` and `add_item_fulltext_index`. Those two
wrapped every statement in a blanket `except: log_error`, so when their DDL
failed they still reported success and were recorded in the Patch Log -- which
means they never run again and their indexes stay missing forever. This patch
is idempotent and lets real failures surface, so it can safely be re-run.
"""

import frappe

from xpos.patches.common import drop_index

# Indexes the POS reads through constantly. Column order follows the actual
# WHERE clauses, so the leading columns are the ones queries always filter on.
INDEXES = (
	# Shift lookups. Every open-tabs poll and every shift close filters on
	# these, and without the index they scan the whole invoice table.
	("Sales Invoice", ["pos_opening_shift", "docstatus"], "pos_opening_shift_docstatus"),
	("POS Invoice", ["pos_opening_shift", "docstatus"], "pos_opening_shift_docstatus"),
	("POS Invoice", ["consolidated_invoice"], "consolidated_invoice"),
	("POS Cash Movement", ["pos_opening_shift", "docstatus"], "shift_docstatus"),
	("Payment Entry", ["reference_no", "docstatus"], "reference_no_docstatus"),
	# Item Price is read once per cart line and once per item on the grid. The
	# hot lookup is {item_code, price_list, selling}; a price_list-leading index
	# cannot serve it, so this ordering matters.
	("Item Price", ["item_code", "price_list", "selling", "uom"], "item_pricelist_selling_uom"),
	# Item grid: filters {disabled, is_sales_item}, narrows by item_group and
	# sorts by item_name.
	("Item", ["disabled", "is_sales_item", "item_group", "item_name"], "disabled_sales_group_name"),
	("Item Barcode", ["barcode"], "barcode"),
	# Stock availability.
	("Bin", ["item_code", "warehouse"], "item_code_warehouse"),
	("Serial No", ["item_code", "warehouse", "status"], "item_warehouse_status"),
	("Batch", ["item", "disabled", "expiry_date"], "item_disabled_expiry"),
	(
		"Stock Ledger Entry",
		["warehouse", "item_code", "batch_no", "is_cancelled", "posting_date", "posting_time", "creation"],
		"warehouse_item_batch_cancel_posting_creation",
	),
)

# Nothing in the app issues MATCH ... AGAINST -- item search is entirely
# `LIKE '%term%'` -- so this fulltext index was pure write-time overhead on
# every Item save. Dropped until a query actually uses it.
OBSOLETE_INDEXES = (("Item", "item_name_description_ft"),)


def execute():
	for doctype, columns, index_name in INDEXES:
		frappe.logger("xpos").info(frappe.db.has_index(f"tab{doctype}", index_name))

	for doctype, index_name in OBSOLETE_INDEXES:
		frappe.logger("xpos").info(drop_index(doctype, index_name))
