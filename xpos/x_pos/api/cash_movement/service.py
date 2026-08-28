import frappe
from frappe import _
from frappe.utils import getdate, nowdate

from .permissions import (
	ensure_delete_allowed,
	ensure_feature_enabled,
	ensure_movement_allowed,
	ensure_owner_or_manager,
	is_manager,
)
from .posting import create_journal_entry
from .queries import get_shift_movements
from .queries import get_submitted_expenses as query_submitted_expenses
from .validation import (
	ensure_no_duplicate_client_request,
	extract_allowed_accounts,
	get_opening_shift,
	get_pos_profile,
	parse_payload,
	resolve_source_cash_account,
	resolve_target_account,
	validate_account_company,
	validate_amount,
	validate_company_consistency,
	validate_remarks,
)


def _enforce_shift_access(pos_opening_shift: str):
	shift_user = frappe.db.get_value("POS Opening Shift", pos_opening_shift, "user")
	if not shift_user:
		frappe.throw(_("POS Opening Shift not found."))
	if shift_user != frappe.session.user and not is_manager():
		frappe.throw(_("You are not allowed to access this shift."))


def _create_cash_movement(payload: dict, movement_type: str):
	data = parse_payload(payload)
	opening_shift_name = data.get("pos_opening_shift") or data.get("pos_opening_shift_name")
	opening_shift = get_opening_shift(opening_shift_name)

	profile_name = data.get("pos_profile") or data.get("pos_profile_name") or opening_shift.pos_profile
	profile_doc = get_pos_profile(profile_name)

	validate_company_consistency(opening_shift, profile_doc)
	ensure_feature_enabled(profile_doc)
	ensure_movement_allowed(profile_doc, movement_type)

	amount = validate_amount(data.get("amount"), profile_doc)
	remarks = (data.get("remarks") or "").strip()
	validate_remarks(remarks, profile_doc)

	existing = ensure_no_duplicate_client_request(data.get("client_request_id"))
	if existing:
		return existing.as_dict()

	source_account = resolve_source_cash_account(data, profile_doc)
	target_account, expense_account = resolve_target_account(data, profile_doc, movement_type)

	validate_account_company(source_account, profile_doc.company, _("Source account"))
	validate_account_company(target_account, profile_doc.company, _("Target account"))

	if movement_type == "Deposit" and source_account == target_account:
		frappe.throw(_("Source and target accounts cannot be the same for cash deposit."))

	movement_doc = frappe.get_doc(
		{
			"doctype": "POS Cash Movement",
			"posting_date": data.get("posting_date") or nowdate(),
			"company": profile_doc.company,
			"pos_profile": profile_doc.name,
			"pos_opening_shift": opening_shift.name,
			"user": frappe.session.user,
			"movement_type": movement_type,
			"amount": amount,
			"source_account": source_account,
			"target_account": target_account,
			"expense_account": expense_account,
			"remarks": remarks,
			"client_request_id": data.get("client_request_id"),
		}
	)
	movement_doc.flags.ignore_permissions = True
	movement_doc.insert()

	journal_entry = create_journal_entry(
		company=movement_doc.company,
		posting_date=movement_doc.posting_date,
		movement_type=movement_doc.movement_type,
		amount=movement_doc.amount,
		source_account=movement_doc.source_account,
		target_account=movement_doc.target_account,
		remarks=movement_doc.remarks,
		cost_center=profile_doc.get("cost_center"),
	)
	movement_doc.db_set("journal_entry", journal_entry, update_modified=False)
	movement_doc.submit()
	movement_doc.reload()
	return movement_doc.as_dict()


@frappe.whitelist()
def get_cash_movement_context(pos_profile: str | None = None, pos_opening_shift: str | None = None):
	profile_name = pos_profile
	if not profile_name and pos_opening_shift:
		profile_name = frappe.db.get_value("POS Opening Shift", pos_opening_shift, "pos_profile")
	if not profile_name:
		frappe.throw(_("POS Profile is required."))

	profile_doc = get_pos_profile(profile_name)
	allowed_expense_accounts = extract_allowed_accounts(profile_doc.get("allowed_expense_accounts"))
	allowed_source_accounts = extract_allowed_accounts(profile_doc.get("allowed_source_accounts"))
	default_source_account = None
	try:
		default_source_account = resolve_source_cash_account({}, profile_doc)
	except Exception:
		default_source_account = None

	return {
		"pos_profile": profile_doc.name,
		"company": profile_doc.company,
		"currency": profile_doc.currency,
		"enable_cash_movement": bool(profile_doc.get("enable_cash_movement")),
		"allow_pos_expense": bool(profile_doc.get("allow_pos_expense")),
		"allow_cash_deposit": bool(profile_doc.get("allow_cash_deposit")),
		"allow_cancel_submitted_cash_movement": bool(profile_doc.get("allow_cancel_submitted_cash_movement")),
		"allow_delete_cancelled_cash_movement": bool(profile_doc.get("allow_delete_cancelled_cash_movement")),
		"require_cash_movement_remarks": bool(profile_doc.get("require_cash_movement_remarks")),
		"cash_movement_max_amount": profile_doc.get("cash_movement_max_amount"),
		"default_pos_expense_account": profile_doc.get("default_pos_expense_account"),
		"allowed_expense_accounts": allowed_expense_accounts,
		"default_source_account": default_source_account,
		"allow_source_account_override": bool(profile_doc.get("allow_source_account_override")),
		"allowed_source_accounts": allowed_source_accounts,
		"back_office_cash_account": profile_doc.get("back_office_cash_account"),
		"cash_mode_of_payment": profile_doc.get("cash_mode_of_payment"),
		"cost_center": profile_doc.get("cost_center"),
	}


@frappe.whitelist()
def create_pos_expense(payload: dict):
	return _create_cash_movement(payload, "Expense")


@frappe.whitelist()
def create_cash_deposit(payload: dict):
	return _create_cash_movement(payload, "Deposit")


@frappe.whitelist()
def get_shift_cash_movements(
	pos_opening_shift: str,
	movement_type: str | None = None,
	status: str = "submitted",
	search_text: str | None = None,
	limit_start: int = 0,
	limit_page_length: int = 50,
):
	_enforce_shift_access(pos_opening_shift)
	return get_shift_movements(
		pos_opening_shift=pos_opening_shift,
		movement_type=movement_type,
		status=status,
		search_text=search_text,
		limit_start=limit_start,
		limit_page_length=limit_page_length,
	)


@frappe.whitelist()
def get_submitted_expenses(pos_opening_shift: str, limit_start: int = 0, limit_page_length: int = 50):
	_enforce_shift_access(pos_opening_shift)
	return query_submitted_expenses(
		pos_opening_shift=pos_opening_shift,
		limit_start=limit_start,
		limit_page_length=limit_page_length,
	)


@frappe.whitelist()
def delete_cash_movement(name: str):
	movement_doc = frappe.get_doc("POS Cash Movement", name)
	ensure_owner_or_manager(movement_doc)
	if movement_doc.docstatus != 2:
		frappe.throw(_("Only cancelled cash movements can be deleted."))

	profile_doc = get_pos_profile(movement_doc.pos_profile)
	ensure_feature_enabled(profile_doc)
	ensure_delete_allowed(profile_doc)

	movement_doc.delete(ignore_permissions=True)
	return {"deleted": name}


@frappe.whitelist()
def duplicate_cash_movement(name: str, posting_date: str | None = None):
	movement_doc = frappe.get_doc("POS Cash Movement", name)
	ensure_owner_or_manager(movement_doc)
	if movement_doc.docstatus not in (1, 2):
		frappe.throw(_("Only submitted or cancelled cash movements can be duplicated."))

	payload = {
		"pos_profile": movement_doc.pos_profile,
		"pos_opening_shift": movement_doc.pos_opening_shift,
		"amount": movement_doc.amount,
		"source_account": movement_doc.source_account,
		"remarks": movement_doc.remarks,
	}

	if movement_doc.movement_type == "Expense":
		payload["expense_account"] = movement_doc.expense_account
	else:
		payload["target_account"] = movement_doc.target_account

	if posting_date:
		try:
			payload["posting_date"] = str(getdate(posting_date))
		except Exception:
			frappe.throw(_("Invalid posting date."))

	return _create_cash_movement(payload, movement_doc.movement_type)
