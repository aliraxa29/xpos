import frappe


def execute():
	"""Post change amount as its own ledger entry, and audit currency-tagged payment modes."""
	settings = frappe.get_single("POS Settings")
	if settings.post_change_gl_entries:
		print("POS Settings.post_change_gl_entries already enabled")
	else:
		settings.post_change_gl_entries = 1
		settings.save(ignore_permissions=True)
		print(
			"Enabled POS Settings.post_change_gl_entries so change posts its own ledger entry. "
			"This is required for mixed-currency cash tender to post correctly."
		)

	_audit_tender_modes()


def _audit_tender_modes():
	"""Warn about currency-tagged modes that cannot post, rather than failing the migration.

	Two master-data requirements are enforced by ERPNext at invoice time, not here:

	- ``Mode of Payment.type`` must be ``Cash``, because ``calculate_change_amount`` only
	  produces change when at least one payment row has that type.
	- A ``Mode of Payment Account`` row must exist for the company, because ``before_save``
	  calls ``set_account_for_mode_of_payment``, which throws without one.

	Both surface as hard errors on the first sale, so flag them at migration time instead.
	"""
	if not frappe.db.has_column("Mode of Payment", "pos_tender_currency"):
		return

	modes = frappe.get_all(
		"Mode of Payment",
		filters={"pos_tender_currency": ["is", "set"]},
		fields=["name", "type", "pos_tender_currency"],
	)
	if not modes:
		return

	companies = frappe.get_all("Company", pluck="name")

	for mode in modes:
		if mode.type != "Cash":
			print(
				f"Mode of Payment {mode.name} is tagged for {mode.pos_tender_currency} but its Type "
				f"is {mode.type or 'unset'}. Set it to Cash or change will not be calculated."
			)

		missing = [
			company
			for company in companies
			if not frappe.db.exists("Mode of Payment Account", {"parent": mode.name, "company": company})
		]
		if missing:
			print(
				f"Mode of Payment {mode.name} has no Mode of Payment Account row for: "
				f"{', '.join(missing)}. POS invoices using it will fail to save."
			)
