"""Override POS Invoice Merge Log to stabilise consolidated return payments."""

from __future__ import annotations

import frappe
from erpnext.accounts.doctype.pos_invoice_merge_log.pos_invoice_merge_log import (
	POSInvoiceMergeLog as ERPNextPOSInvoiceMergeLog,
)
from frappe import _
from frappe.utils import cint, flt, get_time, getdate

from xpos.x_pos.api.item_processing.stock import get_stock_availability


def submit_allowing_negative_stock(invoice) -> None:
	"""Submit a consolidated invoice without the negative stock guard."""

	original = invoice.update_stock_ledger

	def update_stock_ledger(**kwargs):
		kwargs["allow_negative_stock"] = True
		return original(**kwargs)

	invoice.update_stock_ledger = update_stock_ledger
	try:
		invoice.submit()
	finally:
		invoice.update_stock_ledger = original


def negative_stock_allowed() -> bool:
	return bool(cint(frappe.db.get_single_value("Stock Settings", "allow_negative_stock") or 0))


class CustomPOSInvoiceMergeLog(ERPNextPOSInvoiceMergeLog):
	"""Ensure consolidated credit notes keep payment totals within tolerance."""

	def on_submit(self):
		"""Guard the consolidation against overselling."""

		pos_invoices = [frappe.get_cached_doc("POS Invoice", d.pos_invoice) for d in self.pos_invoices]

		self.validate_net_stock(pos_invoices)
		super().on_submit()
		self.assert_no_negative_stock(pos_invoices)

	def collect_net_stock_movement(self, pos_invoices) -> dict[tuple[str, str], float]:
		"""Sum stock movement per ``(item_code, warehouse)`` across the merge log."""

		movement: dict[tuple[str, str], float] = {}

		for invoice in pos_invoices:
			for table, qty_field in (("items", "stock_qty"), ("packed_items", "qty")):
				for row in invoice.get(table) or []:
					item_code = row.get("item_code")
					warehouse = row.get("warehouse")
					if not item_code or not warehouse:
						continue
					if not cint(frappe.get_cached_value("Item", item_code, "is_stock_item") or 0):
						continue

					qty = flt(row.get(qty_field))
					if not qty:
						continue

					key = (item_code, warehouse)
					movement[key] = movement.get(key, 0.0) + qty

		return movement

	def validate_net_stock(self, pos_invoices) -> None:
		"""Throw when the shift's *net* movement exceeds available stock."""

		if negative_stock_allowed():
			return

		shortfalls = []
		for (item_code, warehouse), net_qty in self.collect_net_stock_movement(pos_invoices).items():
			if net_qty <= 0:
				continue

			available = flt(get_stock_availability(item_code, warehouse))
			if net_qty > available:
				shortfalls.append(
					_("<li>{0} in {1}: required {2}, available {3}</li>").format(
						frappe.bold(item_code),
						frappe.bold(warehouse),
						frappe.bold(flt(net_qty, 2)),
						frappe.bold(flt(available, 2)),
					)
				)

		if shortfalls:
			frappe.throw(
				_(
					"Cannot consolidate: the following items were sold beyond available stock.<br>"
					"<ul>{0}</ul>"
				).format("".join(shortfalls)),
				title=_("Insufficient Stock"),
			)

	def assert_no_negative_stock(self, pos_invoices) -> None:
		"""Fail the whole consolidation if any bin ended up below zero.

		``on_submit`` runs in a single transaction, so throwing here rolls back
		the consolidated invoice, every credit note and this merge log
		together - there is no half-consolidated state to clean up.  This is
		the backstop for anything the arithmetic in :meth:`validate_net_stock`
		cannot model: bundles, UOM edge cases, serial/batch bundles.
		"""

		if negative_stock_allowed():
			return

		keys = list(self.collect_net_stock_movement(pos_invoices))
		if not keys:
			return

		negatives = []
		for item_code, warehouse in keys:
			actual_qty = flt(
				frappe.db.get_value("Bin", {"item_code": item_code, "warehouse": warehouse}, "actual_qty")
			)
			if actual_qty < 0:
				negatives.append(
					_("<li>{0} in {1}: {2}</li>").format(
						frappe.bold(item_code), frappe.bold(warehouse), frappe.bold(flt(actual_qty, 2))
					)
				)

		if negatives:
			frappe.throw(
				_(
					"Consolidation would leave negative stock and has been rolled back.<br><ul>{0}</ul>"
				).format("".join(negatives)),
				title=_("Negative Stock"),
			)

	def process_merging_into_sales_invoice(self, data):
		"""Allow negative stock during POS consolidation."""
		sales_invoice = self.get_new_sales_invoice()
		sales_invoice = self.merge_pos_invoice_into(sales_invoice, data)

		sales_invoice.is_consolidated = 1
		sales_invoice.set_posting_time = 1
		sales_invoice.update_stock = 1

		if not sales_invoice.posting_date:
			sales_invoice.posting_date = getdate(self.posting_date)

		if not sales_invoice.posting_time:
			sales_invoice.posting_time = get_time(self.posting_time)

		sales_invoice.save()
		submit_allowing_negative_stock(sales_invoice)

		self.consolidated_invoice = sales_invoice.name

		return sales_invoice

	def process_merging_into_credit_notes(self, data):
		"""
		Duplicate ERPNext's loop so we can normalise item rates before save.
		The credit note's return_against is the consolidated SI, but rates come
		from POS return invoices whose net_rate may be slightly higher due to
		rounding in different calculation paths.  Capping them to the SI rate
		lets validate_returned_items pass without bypassing the check.
		"""
		credit_notes = {}
		for key, value in data.items():
			if not value:
				continue

			credit_note = self.get_new_sales_invoice()
			credit_note.is_return = 1
			credit_note = self.merge_pos_invoice_into(credit_note, value)
			credit_note.return_against = key
			credit_note.is_consolidated = 1
			credit_note.set_posting_time = 1
			credit_note.update_stock = 1
			credit_note.posting_date = getdate(self.posting_date)
			credit_note.posting_time = get_time(self.posting_time)

			self._cap_item_rates_to_return_against(credit_note)

			credit_note.save()
			submit_allowing_negative_stock(credit_note)

			self.consolidated_credit_note = credit_note.name
			credit_notes[credit_note.name] = [d.name for d in value]

		return credit_notes

	def _cap_item_rates_to_return_against(self, credit_note) -> None:
		"""
		Cap credit note item rates that exceed the consolidated SI rate.
		"""
		si_rates = {
			row.name: flt(row.rate)
			for row in frappe.db.get_all(
				"Sales Invoice Item",
				filters={"parent": credit_note.return_against},
				fields=["name", "rate"],
			)
		}

		changed = False
		for item in credit_note.get("items"):
			ref_rate = si_rates.get(item.get("sales_invoice_item"))
			if ref_rate is not None and flt(item.rate) > ref_rate:
				item.rate = ref_rate
				changed = True

		if changed:
			credit_note.calculate_taxes_and_totals()
			self._normalize_return_payments(credit_note)

	def merge_pos_invoice_into(self, invoice, data):
		invoice = super().merge_pos_invoice_into(invoice, data)

		if getattr(invoice, "is_return", 0):
			self._normalize_return_payments(invoice)

		return invoice

	def _normalize_return_payments(self, invoice) -> None:
		"""Clamp aggregated payment totals for consolidated return invoices."""

		invoice_total = flt(invoice.rounded_total or invoice.grand_total)
		conversion_rate = invoice.conversion_rate or 1

		if not invoice_total:
			invoice.write_off_amount = 0
			invoice.base_write_off_amount = 0
			invoice.set("payments", [])
			invoice.set_paid_amount()
			return

		invoice_sign = -1 if invoice_total < 0 else 1
		invoice_total_abs = abs(invoice_total)

		precision_total = invoice.precision("grand_total") or 2
		precision_paid = invoice.precision("paid_amount") or 2
		precision_base_paid = invoice.precision("base_paid_amount") or 2
		precision_write_off = invoice.precision("write_off_amount") or 2
		precision_base_write_off = invoice.precision("base_write_off_amount") or 2
		tolerance = 1 / (10 ** (precision_total + 1))

		write_off_abs = abs(flt(invoice.write_off_amount))
		if write_off_abs > invoice_total_abs:
			write_off_abs = invoice_total_abs

		invoice.write_off_amount = invoice_sign * flt(write_off_abs, precision_write_off)
		invoice.base_write_off_amount = invoice_sign * flt(
			write_off_abs * conversion_rate, precision_base_write_off
		)

		payments = invoice.get("payments", [])
		if not payments:
			invoice.set_paid_amount()
			return

		min_unit = 1 / (10**precision_paid) if precision_paid is not None else 0

		for payment in payments:
			abs_amount = abs(flt(payment.amount))
			if not abs_amount and payment.base_amount:
				abs_amount = abs(flt(payment.base_amount)) / conversion_rate if conversion_rate else 0

			payment.amount = invoice_sign * flt(abs_amount, precision_paid)
			payment.base_amount = invoice_sign * flt(abs_amount * conversion_rate, precision_base_paid)

		invoice.set_paid_amount()

		difference = abs(flt(invoice.paid_amount)) + abs(flt(invoice.write_off_amount)) - invoice_total_abs

		if difference > tolerance:
			self._reduce_payment_difference(
				invoice,
				difference,
				invoice_sign,
				conversion_rate,
				precision_paid,
				precision_base_paid,
				tolerance,
				min_unit,
			)

		self._cleanup_zero_amount_payments(invoice, tolerance, precision_base_paid)
		invoice.set_paid_amount()

		remaining_diff = (
			abs(flt(invoice.paid_amount)) + abs(flt(invoice.write_off_amount)) - invoice_total_abs
		)
		if remaining_diff > tolerance and invoice.payments:
			last_payment = invoice.payments[-1]
			current_abs = abs(flt(last_payment.amount))
			adjustment = min(current_abs, remaining_diff)
			new_abs = current_abs - adjustment

			new_amount = invoice_sign * flt(new_abs, precision_paid)
			if abs(flt(new_amount)) >= current_abs - tolerance and min_unit and current_abs > min_unit:
				new_amount = invoice_sign * flt(current_abs - min_unit, precision_paid)

			last_payment.amount = new_amount
			last_payment.base_amount = invoice_sign * flt(
				abs(flt(last_payment.amount)) * conversion_rate,
				precision_base_paid,
			)

			self._cleanup_zero_amount_payments(invoice, tolerance, precision_base_paid)
			invoice.set_paid_amount()

	def _reduce_payment_difference(
		self,
		invoice,
		difference: float,
		invoice_sign: int,
		conversion_rate: float,
		precision_paid: int,
		precision_base_paid: int,
		tolerance: float,
		min_unit: float,
	) -> None:
		"""Distribute the excess paid amount across existing payment rows."""

		remaining = difference
		for payment in reversed(invoice.payments):
			current_abs = abs(flt(payment.amount))
			if current_abs <= tolerance:
				continue

			deduction = min(current_abs, remaining)
			new_abs = current_abs - deduction

			new_amount = invoice_sign * flt(new_abs, precision_paid)
			new_abs_after = abs(flt(new_amount))

			if new_abs_after >= current_abs - tolerance and min_unit and current_abs > min_unit:
				new_amount = invoice_sign * flt(current_abs - min_unit, precision_paid)
				new_abs_after = abs(flt(new_amount))

			payment.amount = new_amount
			payment.base_amount = invoice_sign * flt(new_abs_after * conversion_rate, precision_base_paid)

			remaining -= current_abs - new_abs_after
			if remaining <= tolerance:
				break

	def _cleanup_zero_amount_payments(
		self,
		invoice,
		tolerance: float,
		precision_base_paid: int,
	) -> None:
		"""Drop zeroed payment rows and keep indices tidy."""

		conversion_rate = invoice.conversion_rate or 1
		cleaned = []
		for idx, payment in enumerate(invoice.get("payments", []), start=1):
			if abs(flt(payment.amount)) <= tolerance:
				continue

			payment.idx = idx
			payment.base_amount = flt(payment.amount * conversion_rate, precision_base_paid)
			cleaned.append(payment)

		if len(cleaned) != len(invoice.get("payments", [])):
			invoice.set("payments", cleaned)
