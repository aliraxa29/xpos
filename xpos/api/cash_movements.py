# Copyright (c) 2026, Kodlyft and contributors
# For license information, please see license.txt


import json

import frappe
from erpnext.accounts.doctype.sales_invoice.sales_invoice import (
	get_bank_cash_account,
)
from frappe import _
from frappe.utils import cint, flt, now_datetime, nowdate


@frappe.whitelist()
def get_cash_movement_context(pos_profile: str):
	"""Returns configuration context for cash movement dialogs."""
	pos = frappe.get_cached_doc("POS Profile", pos_profile)

	enable_cash_movement = cint(pos.get("enable_cash_movement"))
	allow_pos_expense = cint(pos.get("allow_pos_expense"))
	allow_cash_deposit = cint(pos.get("allow_cash_deposit"))

	expense_accounts = frappe.get_all(
		"POS Allowed Expense Account",
		filters={"parent": pos_profile},
		fields=["account"],
		order_by="idx",
	)

	deposit_accounts = frappe.get_all(
		"Account",
		filters={"disabled": 0, "is_group": 0, "account_type": "Bank", "company": pos.company},
		fields=["name"],
		order_by="idx",
	)

	source_accounts = frappe.get_all(
		"POS Allowed Source Account",
		filters={"parent": pos_profile},
		fields=["account"],
		order_by="idx",
	)
	cash_account = None
	cash_mop = pos.get("cash_mode_of_payment") or "Cash"
	account_info = get_bank_cash_account(cash_mop, pos.company)
	cash_account = account_info.get("account")

	return {
		"enable_cash_movement": enable_cash_movement,
		"allow_pos_expense": allow_pos_expense,
		"allow_cash_deposit": allow_cash_deposit,
		"deposit_accounts": deposit_accounts,
		"expense_accounts": expense_accounts,
		"source_accounts": source_accounts,
		"cash_account": cash_account,
		"company": pos.company,
		"cost_center": pos.get("cost_center") or frappe.db.get_value("Company", pos.company, "cost_center"),
	}


@frappe.whitelist()
def create_pos_expense(payload: str | dict):
	"""Creates a POS Expense cash movement with journal entry."""

	if isinstance(payload, str):
		payload = json.loads(payload)

	pos_opening_shift = payload.get("pos_opening_shift")
	amount = flt(payload.get("amount"))
	expense_account = payload.get("expense_account")
	remarks = payload.get("reason", "")
	cash_account = payload.get("cash_account")
	company = payload.get("company")
	cost_center = payload.get("cost_center")

	if not pos_opening_shift:
		frappe.throw(_("POS Opening Shift is required"))
	if amount <= 0:
		frappe.throw(_("Amount must be greater than zero"))
	if not expense_account:
		frappe.throw(_("Expense account is required"))

	opening = frappe.get_doc("POS Opening Shift", pos_opening_shift)

	if opening.user != frappe.session.user and "POS Manager" not in frappe.get_roles():
		frappe.throw(_("{0} can only create expenses for their own shift").format(frappe.session.user))

	company = company or opening.company
	cost_center = cost_center or frappe.db.get_value("Company", company, "cost_center")

	if not cash_account:
		cash_mop = "Cash"
		try:
			pos = frappe.get_cached_doc("POS Profile", opening.pos_profile)
			cash_mop = pos.get("cash_mode_of_payment") or "Cash"
		except Exception:
			pass
		from erpnext.accounts.doctype.sales_invoice.sales_invoice import (
			get_bank_cash_account,
		)

		account_info = get_bank_cash_account(cash_mop, company)
		cash_account = account_info.get("account")

	je = frappe.get_doc(
		{
			"doctype": "Journal Entry",
			"posting_date": nowdate(),
			"company": company,
			"user_remark": f"POS Expense: {remarks}" if remarks else "POS Expense",
			"accounts": [
				{
					"account": expense_account,
					"debit_in_account_currency": amount,
					"cost_center": cost_center,
					"user_remark": remarks,
				},
				{
					"account": cash_account,
					"credit_in_account_currency": amount,
					"cost_center": cost_center,
					"user_remark": remarks,
				},
			],
		}
	)
	je.insert(ignore_permissions=True)
	je.submit()

	movement = _create_cash_movement_record(
		pos_profile=frappe.db.get_value("POS Opening Shift", pos_opening_shift, "pos_profile"),
		pos_opening_shift=pos_opening_shift,
		source_account=cash_account,
		target_account=expense_account,
		expense_account=expense_account,
		movement_type="Expense",
		amount=amount,
		remarks=remarks,
		journal_entry=je.name,
		company=company,
	)

	return movement


@frappe.whitelist()
def create_cash_deposit(payload: str | dict):
	"""Creates a Cash Deposit movement with journal entry."""

	if isinstance(payload, str):
		payload = json.loads(payload)

	pos_opening_shift = payload.get("pos_opening_shift")
	amount = flt(payload.get("amount"))
	target_account = payload.get("target_account")
	remarks = payload.get("reason", "")
	cash_account = payload.get("cash_account")
	company = payload.get("company")
	cost_center = payload.get("cost_center")

	if not pos_opening_shift:
		frappe.throw(_("POS Opening Shift is required"))
	if amount <= 0:
		frappe.throw(_("Amount must be greater than zero"))
	if not target_account:
		frappe.throw(_("Target account is required"))

	opening = frappe.get_doc("POS Opening Shift", pos_opening_shift)

	if opening.user != frappe.session.user and "POS Manager" not in frappe.get_roles():
		frappe.throw(_("{0} can only create deposits for their own shift").format(frappe.session.user))

	company = company or opening.company
	cost_center = cost_center or frappe.db.get_value("Company", company, "cost_center")

	if not cash_account:
		cash_mop = "Cash"
		try:
			pos = frappe.get_cached_doc("POS Profile", opening.pos_profile)
			cash_mop = pos.get("cash_mode_of_payment") or "Cash"
		except Exception:
			pass

		account_info = get_bank_cash_account(cash_mop, company)
		cash_account = account_info.get("account")

	je = frappe.get_doc(
		{
			"doctype": "Journal Entry",
			"posting_date": nowdate(),
			"company": company,
			"user_remark": (f"POS Cash Deposit: {remarks}" if remarks else "POS Cash Deposit"),
			"accounts": [
				{
					"account": target_account,
					"debit_in_account_currency": amount,
					"cost_center": cost_center,
					"user_remark": remarks,
				},
				{
					"account": cash_account,
					"credit_in_account_currency": amount,
					"cost_center": cost_center,
					"user_remark": remarks,
				},
			],
		}
	)
	je.insert(ignore_permissions=True)
	je.submit()

	movement = _create_cash_movement_record(
		pos_profile=frappe.db.get_value("POS Opening Shift", pos_opening_shift, "pos_profile"),
		pos_opening_shift=pos_opening_shift,
		source_account=cash_account,
		target_account=target_account,
		expense_account="",
		movement_type="Deposit",
		amount=amount,
		remarks=remarks,
		journal_entry=je.name,
		company=company,
	)

	return movement


@frappe.whitelist()
def get_shift_cash_movements(
	pos_opening_shift: str,
	movement_type: str | None = None,
	status: str | None = None,
	search_text: str | None = None,
	from_date: str | None = None,
	to_date: str | None = None,
	limit_start: int = 0,
	limit_page_length: int = 20,
):
	"""
	Lists cash movements for a shift with search and pagination.
	"""
	filters = {"pos_opening_shift": pos_opening_shift}

	if movement_type:
		filters["movement_type"] = movement_type

	if from_date and to_date:
		filters["posting_date"] = ["between", [from_date, to_date]]
	elif from_date:
		filters["posting_date"] = [">=", from_date]
	elif to_date:
		filters["posting_date"] = ["<=", to_date]

	fields = [
		"name",
		"docstatus",
		"movement_type",
		"amount",
		"remarks",
		"posting_date",
		"posting_time",
		"journal_entry",
		"expense_account",
		"target_account",
		"source_account",
	]

	total = frappe.db.count("POS Cash Movement", filters=filters)
	data = frappe.get_list(
		"POS Cash Movement",
		filters=filters,
		fields=fields,
		limit_start=cint(limit_start),
		limit_page_length=cint(limit_page_length),
		order_by="creation desc",
	)

	return {"data": data, "total": total}


def _create_cash_movement_record(**kwargs):
	"""Create a POS Cash Movement record if the doctype exists."""
	movement = frappe.get_doc(
		{
			"doctype": "POS Cash Movement",
			"docstatus": 1,
			"pos_profile": kwargs.get("pos_profile"),
			"pos_opening_shift": kwargs.get("pos_opening_shift"),
			"user": frappe.session.user,
			"journal_entry": kwargs.get("journal_entry"),
			"movement_type": kwargs.get("movement_type"),
			"amount": kwargs.get("amount"),
			"source_account": kwargs.get("source_account"),
			"target_account": kwargs.get("target_account"),
			"expense_account": kwargs.get("expense_account"),
			"remarks": kwargs.get("remarks"),
			"company": kwargs.get("company"),
			"posting_date": nowdate(),
			"posting_time": now_datetime().strftime("%H:%M:%S"),
			"status": "Submitted",
		}
	)
	movement.insert(ignore_permissions=True)
	return movement.as_dict()
