# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

from xpos.api.auth import clear_role_permission_cache


class POSRole(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from xpos.x_pos.doctype.pos_role_permission.pos_role_permission import POSRolePermission

		permissions: DF.Table[POSRolePermission]
		role_name: DF.Data
	# end: auto-generated types

	def validate(self):
		self._sync_permissions_with_catalog()

	def on_update(self):
		clear_role_permission_cache(self.name)

	def on_trash(self):
		clear_role_permission_cache(self.name)

	def _sync_permissions_with_catalog(self):
		"""Keep the child table aligned with the POS Permission catalog.

		Adds a disabled row for every catalog permission missing from this role
		and drops rows whose permission no longer exists, preserving the enabled
		flag of existing rows.
		"""
		catalog = set(frappe.get_all("POS Permission", pluck="name"))

		kept = []
		seen = set()
		for row in self.permissions:
			if row.permission in catalog and row.permission not in seen:
				kept.append(row)
				seen.add(row.permission)
		self.set("permissions", kept)

		for permission in catalog - seen:
			self.append("permissions", {"permission": permission, "enabled": 0})
