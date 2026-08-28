import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from xpos.x_pos.api import invoice


class FakeDoc(SimpleNamespace):
	"""Namespace that also answers `doc.get(...)`, as Frappe documents do."""

	def get(self, key, default=None):
		return getattr(self, key, default)


class TestAutoSetDeliveryCharges(unittest.TestCase):
	"""Tests for delivery-charge auto-application hooks."""

	@patch("xpos.x_pos.api.invoice.get_applicable_delivery_charges")
	def test_auto_set_delivery_charges_skips_xpos_managed_docs(self, mock_get_applicable):
		"""xpos-managed invoices should not get surprise delivery charges from validate hooks."""
		doc = FakeDoc(
			pos_profile="POS-1",
			flags=SimpleNamespace(xpos_skip_auto_delivery_charges=True),
		)

		invoice.auto_set_delivery_charges(doc)

		mock_get_applicable.assert_not_called()


class TestCalcDeliveryCharges(unittest.TestCase):
	"""Tests for delivery-charge tax row generation."""

	@patch("xpos.x_pos.api.invoice.flt", side_effect=lambda value, precision=None: float(value))
	@patch("xpos.x_pos.api.invoice.frappe.get_cached_doc")
	def test_calc_delivery_charges_replaces_existing_same_charge_row(self, mock_get_cached_doc, _mock_flt):
		"""Pre-calculating totals should not duplicate the same delivery-charge tax row."""
		taxes = [SimpleNamespace(charge_type="Actual", description="Home Delivery")]

		def append_row(_table_name, row):
			taxes.append(SimpleNamespace(**row))

		doc = FakeDoc(
			pos_profile="POS-1",
			pos_delivery_charges="Home Delivery",
			pos_delivery_charges_rate=0,
			conversion_rate=1,
			taxes=taxes,
			is_new=lambda: True,
			precision=lambda _fieldname: 2,
			append=append_row,
			calculate_taxes_and_totals=MagicMock(),
		)

		mock_get_cached_doc.return_value = SimpleNamespace(
			default_rate=300,
			profiles=[SimpleNamespace(pos_profile="POS-1", rate=300)],
			cost_center="Main - TC",
			shipping_account="Shipping - TC",
		)

		invoice.calc_delivery_charges(doc)

		matching_rows = [
			row for row in taxes if row.charge_type == "Actual" and row.description == "Home Delivery"
		]
		self.assertEqual(len(matching_rows), 1)
		self.assertEqual(matching_rows[0].tax_amount, 300)
		doc.calculate_taxes_and_totals.assert_called_once()
