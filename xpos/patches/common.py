# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt

"""Shared helpers for xpos schema patches."""

import frappe


def missing_columns(table: str, columns: list[str]) -> list[str]:
	"""Return the subset of `columns` that `table` does not have."""
	present = {
		row[0]
		for row in frappe.db.sql(
			"""
			SELECT column_name FROM information_schema.COLUMNS
			WHERE table_schema = DATABASE() AND table_name = %s
			""",
			(table,),
		)
	}
	return [column for column in columns if column not in present]


def drop_index(doctype: str, index_name: str) -> str:
	"""Drop an index if it exists."""
	table = f"tab{doctype}"

	if not frappe.db.table_exists(doctype) or not frappe.db.has_index(table, index_name):
		return f"skipped {index_name}: not present on {table}"

	frappe.db.sql_ddl(f"DROP INDEX `{index_name}` ON `{table}`")
	return f"dropped {index_name} from {table}"
