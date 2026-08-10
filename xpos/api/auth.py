# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt


import frappe
from frappe import _
from frappe.utils import cint, flt

ALL_PERMISSION_KEYS = (
	"close_shift",
	"allow_reprint_invoice",
	"print_draft_invoice",
	"shift_report",
	"apply_additional_discount",
	"show_edit_discount_field",
	"allow_change_price",
	"sale_return",
	"recall_other_shift_tabs",
	"settle_outstanding_invoice",
	"expense",
	"bank_drop",
	"current_stock_by_brand",
	"current_stock_report",
	"manage_role_permissions",
)

DEFAULT_ROLE = "Cashier"
DEFAULT_DISCOUNT_LIMIT = 100
_ROLE_CACHE_KEY = "xpos_role_permissions"


def _resolve_role_permissions(role_name: str) -> dict:
	"""Build the full permission map for a role from its POS Role Permission rows.

	Every key in :data:`ALL_PERMISSION_KEYS` is present in the result; flags
	without an enabled child row default to ``False``.
	"""
	perms = {key: False for key in ALL_PERMISSION_KEYS}

	if not role_name or not frappe.db.exists("POS Role", role_name):
		return perms

	rows = frappe.get_all(
		"POS Role Permission",
		filters={"parent": role_name, "parenttype": "POS Role"},
		fields=["permission", "enabled"],
		ignore_permissions=True,
	)
	for row in rows:
		if row.permission in perms:
			perms[row.permission] = bool(row.enabled)

	return perms


def _get_user_pos_role(user: str, pos_profile: str | None = None) -> str:
	"""Resolve a user's POS Role from the POS Profile User child rows.

	When ``pos_profile`` is given the matching profile's row is preferred;
	otherwise the first profile row that carries a ``pos_role`` wins. Falls
	back to :data:`DEFAULT_ROLE` when no assignment exists.
	"""
	filters = {"user": user, "parenttype": "POS Profile"}
	if pos_profile:
		filters["parent"] = pos_profile

	rows = frappe.get_all(
		"POS Profile User",
		filters=filters,
		fields=["pos_role"],
		order_by="parent asc, idx asc",
		ignore_permissions=True,
	)
	for row in rows:
		if row.pos_role:
			return row.pos_role

	return DEFAULT_ROLE


def _get_role_permissions(role_name: str) -> dict:
	"""Cached accessor for :func:`_resolve_role_permissions`.

	Cached per-role in ``frappe.cache`` and invalidated by the POS Role /
	POS Permission doc_events (see :func:`clear_role_permission_cache`).
	"""
	role_name = role_name or DEFAULT_ROLE
	return frappe.cache().hget(
		_ROLE_CACHE_KEY,
		role_name,
		generator=lambda: _resolve_role_permissions(role_name),
	)


def clear_role_permission_cache(role_name: str | None = None) -> None:
	"""Invalidate the cached permission map for a role (or all roles)."""
	if role_name:
		frappe.cache().hdel(_ROLE_CACHE_KEY, role_name)
	else:
		frappe.cache().delete_key(_ROLE_CACHE_KEY)


def _all_enabled() -> dict:
	"""Permission map with every flag granted (System Manager / Administrator)."""
	return {key: True for key in ALL_PERMISSION_KEYS}


def _is_superuser(user: str) -> bool:
	return user == "Administrator" or "System Manager" in frappe.get_roles(user)


def user_has_pos_permission(key: str, user: str | None = None, pos_profile: str | None = None) -> bool:
	"""Whether ``user``'s POS Role grants the permission ``key``.

	Single source of truth for server-side POS permission checks. Resolves the
	role from the user's POS Profile User row (preferring ``pos_profile`` when
	supplied). Administrators and System Managers always qualify; Guest never.
	"""
	user = user or frappe.session.user
	if user == "Guest":
		return False
	if _is_superuser(user):
		return True
	role_name = _get_user_pos_role(user, pos_profile)
	return bool(_get_role_permissions(role_name).get(key))


def can_manage_role_permissions(user: str | None = None) -> bool:
	"""Whether ``user`` may view and edit the POS role permission matrix.

	Administrators and System Managers always qualify. Any other user must
	have the ``manage_role_permissions`` flag enabled on their POS Role.
	"""
	return user_has_pos_permission("manage_role_permissions", user)


def _require_manage_permissions() -> None:
	if not can_manage_role_permissions():
		frappe.throw(
			_("You are not permitted to manage POS role permissions."),
			frappe.PermissionError,
		)


def _get_user_discount_limit(user_name: str, pos_profile: str | None) -> float:
	"""Per-user discount cap, read from the POS Profile User child row."""
	if not pos_profile:
		return DEFAULT_DISCOUNT_LIMIT

	value = frappe.db.get_value(
		"POS Profile User",
		{"parent": pos_profile, "parenttype": "POS Profile", "user": user_name},
		"discount_limit",
	)
	return flt(value) if value not in (None, "") else DEFAULT_DISCOUNT_LIMIT


@frappe.whitelist()
def get_my_pos_permissions(pos_profile: str | None = None) -> dict:
	"""Return POS permission flags for the current logged-in user (browser mode).

	Resolves the user's POS Role from their POS Profile User row (preferring
	``pos_profile`` when supplied). System Manager / Administrator receive every
	flag enabled.
	"""
	user = frappe.session.user
	if user == "Guest":
		return {key: False for key in ALL_PERMISSION_KEYS}

	if _is_superuser(user):
		return _all_enabled()

	role_name = _get_user_pos_role(user, pos_profile)
	return _get_role_permissions(role_name)


def get_current_user_permissions() -> dict:
	"""Return the current session user's xPOS role and permission flags.

	Used by ``extend_bootinfo`` so the web app has an authoritative source of
	truth for permissions. System Manager / Administrator resolve to all
	permissions enabled.
	"""
	user = frappe.session.user
	if user == "Guest":
		return {}

	role_name = _get_user_pos_role(user)

	if _is_superuser(user):
		permissions = _all_enabled()
	else:
		permissions = _get_role_permissions(role_name)

	return {
		"role": role_name,
		"permissions": permissions,
	}


@frappe.whitelist()
def get_pos_users(
	limit_start: int = 0,
	limit_page_length: int = 100,
):
	"""Return POS-enabled Frappe users for offline authentication sync.

	The function signature mirrors ``frappe.client.get_list`` so the sync
	engine can use it as a drop-in ``pullMethod``.

	Returns:
	    list[dict]: One record per user with at minimum:
	        name, username, full_name, enabled, password_hash (empty),
	        role, pos_profile, warehouse, company, theme, discount_limit,
	        and every permission flag in :data:`ALL_PERMISSION_KEYS`, resolved
	        from the POS Role assigned on the user's POS Profile User row.
	"""
	limit_start = cint(limit_start)
	limit_page_length = cint(limit_page_length)

	profile_users = frappe.db.sql(
		"""
        SELECT user, pos_profile, pos_role, discount_limit, warehouse, company
        FROM (
            SELECT pu.user, pu.parent AS pos_profile, pu.pos_role, pu.discount_limit,
                   pp.warehouse, pp.company,
                   ROW_NUMBER() OVER (
                       PARTITION BY pu.user ORDER BY pu.parent ASC, pu.idx ASC
                   ) AS rn
            FROM `tabPOS Profile User` pu
            INNER JOIN `tabPOS Profile` pp ON pp.name = pu.parent
            WHERE pp.disabled = 0
        ) ranked
        WHERE rn = 1
        ORDER BY user
        LIMIT %(limit)s OFFSET %(offset)s
        """,
		{"limit": limit_page_length, "offset": limit_start},
		as_dict=True,
	)

	if not profile_users:
		return []

	user_meta = {
		u.name: u
		for u in frappe.get_all(
			"User",
			filters={"name": ["in", [r.user for r in profile_users]]},
			fields=["name", "username", "full_name", "enabled", "modified"],
			ignore_permissions=True,
		)
	}

	results = []
	for pu in profile_users:
		user = user_meta.get(pu.user)
		if not user:
			continue
		role_name = pu.pos_role or DEFAULT_ROLE
		perms = _get_role_permissions(role_name)
		discount_limit = (
			flt(pu.discount_limit) if pu.discount_limit not in (None, "") else DEFAULT_DISCOUNT_LIMIT
		)
		row = {
			"name": user.name,
			"username": user.username or user.name,
			"full_name": user.full_name or user.name,
			"enabled": cint(user.enabled),
			"modified": str(user.modified) if user.modified else None,
			"password_hash": "",
			"role": role_name,
			"pos_profile": pu.pos_profile or "",
			"warehouse": pu.warehouse or "",
			"company": pu.company or "",
			"theme": "Default",
			"discount_limit": discount_limit,
			**{key: cint(perms.get(key, False)) for key in ALL_PERMISSION_KEYS},
		}
		results.append(row)

	return results


@frappe.whitelist()
def get_role_permission_matrix() -> dict:
	"""Return the full role/permission matrix for the admin UI.

	Shape::

	    {
	        "roles": [{"name", "role_name"}],
	        "permissions": [{"name", "label", "group"}],
	        "matrix": {role_name: {permission_name: bool}},
	    }
	"""
	_require_manage_permissions()
	roles = frappe.get_all(
		"POS Role",
		fields=["name", "role_name"],
		order_by="role_name asc",
		ignore_permissions=True,
	)
	permissions = frappe.get_all(
		"POS Permission",
		fields=["name", "permission_label as label"],
		ignore_permissions=True,
	)
	# Order permissions by the canonical catalog order; tag with group.
	from xpos.install import POS_PERMISSIONS

	group_of = {name: group for name, _label, group in POS_PERMISSIONS}
	order = {name: idx for idx, (name, _l, _g) in enumerate(POS_PERMISSIONS)}
	for perm in permissions:
		perm["group"] = group_of.get(perm.name, "Other")
	permissions.sort(key=lambda p: order.get(p["name"], len(order)))

	matrix: dict[str, dict[str, bool]] = {}
	for role in roles:
		matrix[role.name] = _resolve_role_permissions(role.name)

	return {"roles": roles, "permissions": permissions, "matrix": matrix}


@frappe.whitelist()
def set_role_permission(role: str, permission: str, enabled: bool | int | str) -> dict:
	"""Upsert a single POS Role Permission child row and bust the cache."""
	_require_manage_permissions()
	if not frappe.db.exists("POS Role", role):
		frappe.throw(_("POS Role {0} not found").format(role))

	enabled = 1 if cint(enabled) else 0
	doc = frappe.get_doc("POS Role", role)

	target = next((row for row in doc.permissions if row.permission == permission), None)
	if target:
		target.enabled = enabled
	else:
		doc.append("permissions", {"permission": permission, "enabled": enabled})

	doc.save(ignore_permissions=True)
	clear_role_permission_cache(role)

	return {"role": role, "permission": permission, "enabled": enabled}
