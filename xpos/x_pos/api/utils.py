import json
import logging
import time
from functools import cache

import frappe

# Reusable ORM filter to exclude template items
HAS_VARIANTS_EXCLUSION = {"has_variants": 0}


logger = logging.getLogger(__name__)


def expand_item_groups(item_groups: list[str] | None):
	"""Expand any parent item groups to include their children.

	This function takes a list of item groups and expands any parent groups
	to include all their descendants, while keeping leaf groups as-is.
	"""
	if not item_groups:
		return item_groups

	try:
		from erpnext.setup.doctype.item_group.item_group import get_child_groups
	except Exception:
		get_child_groups = None

	expanded_groups = set()
	for group in item_groups:
		if not group:
			continue

		is_group = frappe.db.get_value("Item Group", group, "is_group")

		if is_group:
			if get_child_groups:
				try:
					descendants = get_child_groups(group) or []
					expanded_groups.update(descendants)
				except Exception:
					descendants = frappe.db.get_descendants("Item Group", group) or []
					expanded_groups.update(descendants)
			else:
				descendants = frappe.db.get_descendants("Item Group", group) or []
				expanded_groups.update(descendants)
		else:
			expanded_groups.add(group)

	return list(expanded_groups)


def ensure_pos_profile(pos_profile: str | None):
	"""Return a ``(profile_dict, profile_json)`` tuple for the given profile name.

	Only a profile **name** is accepted (or ``None``, which resolves the
	session user's own profile). The returned profile decides which item
	groups, warehouse and price list the caller may see, so accepting a
	caller-supplied profile object -- previously allowed, including a JSON
	string that decoded to one -- let any user redefine their own scope.
	"""
	from frappe import as_json

	from xpos.api.profiles import resolve_pos_profile

	name = pos_profile
	if isinstance(name, str):
		stripped = name.strip()
		if stripped.startswith('"') and stripped.endswith('"'):
			try:
				stripped = json.loads(stripped)
			except ValueError:
				pass
		name = stripped

	profile_dict = resolve_pos_profile(name).as_dict()
	return profile_dict, as_json(profile_dict)


@frappe.whitelist()
def get_active_pos_profile(user: str | None = None):
	"""Return the active POS profile for the given user."""
	user = user or frappe.session.user
	profile = frappe.db.get_value("POS Profile User", {"user": user}, "parent")
	if not profile:
		profile = frappe.db.get_single_value("POS Settings", "pos_profile")
	if not profile:
		return None
	return frappe.get_doc("POS Profile", profile).as_dict()


@frappe.whitelist()
def get_default_warehouse(company: str | None = None):
	"""Return the default warehouse for the given company.

	Delegates to `xpos.api.utilities.get_default_warehouse` so the two API
	layers cannot drift apart again; the local copy previously queried a
	`Company.default_warehouse` column that does not exist.
	"""
	from xpos.api.utilities import get_default_warehouse as resolve_default_warehouse

	return resolve_default_warehouse(company)


def fetch_sales_person_names():
	"""Return the list of enabled sales persons allowed for the active POS profile."""

	logger.info("Fetching sales persons...")

	try:
		profile = get_active_pos_profile()
		allowed = []
		if profile:
			allowed = [
				d.get("sales_person")
				for d in profile.get("allowed_sales_persons", [])
				if d.get("sales_person")
			]

		filters = {"enabled": 1}
		if allowed:
			filters["name"] = ["in", allowed]

		sales_persons = frappe.get_list(
			"Sales Person",
			filters=filters,
			fields=["name", "sales_person_name"],
			limit_page_length=100000,
		)

		logger.info(
			"Found %s sales persons: %s",
			len(sales_persons),
			json.dumps(sales_persons),
		)

		return sales_persons
	except Exception as exc:
		logger.exception("Error fetching sales persons")
		frappe.log_error(
			f"Error fetching sales persons: {exc}",
			"POS Sales Person Error",
		)
		return []


def is_perf_logging_enabled() -> bool:
	"""Return True when lightweight POS performance logging is enabled."""

	return bool(frappe.conf.get("pos_perf_log_enabled"))


def log_perf_event(event: str, started_at: float, **context):
	"""Emit a structured performance log line when enabled."""

	if not is_perf_logging_enabled():
		return

	elapsed_ms = round((time.perf_counter() - started_at) * 1000, 2)
	context_parts = [f"{key}={context[key]}" for key in sorted(context.keys())]
	context_str = " ".join(context_parts)
	logger.info("[POS_PERF] event=%s elapsed_ms=%s %s", event, elapsed_ms, context_str)


@cache
def get_item_groups(pos_profile: str) -> list[str]:
	"""Return all item groups for a POS profile, including descendants.

	The linked groups from the ``POS Item Group`` child table are
	expanded to include all of their descendants. Results are cached
	to avoid duplicate database calls within a process.


	"""
	if not pos_profile or not frappe.db.exists("DocType", "POS Item Group"):
		return []

	groups = frappe.get_all(
		"POS Item Group",
		filters={"parent": pos_profile},
		pluck="item_group",
	)

	return expand_item_groups(groups)


def get(flag: str, pos_profile: str | None = None):
	"""Helper to fetch and cache commonly used POS profile related data."""
	pp = frappe.get_cached_doc("POS Profile", pos_profile) if pos_profile else None
	if pp and flag:
		return pp.get(flag)

	return None
