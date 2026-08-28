# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt

import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from xpos.api import items
from xpos.x_pos.api.item_processing import barcode

# The client's sample barcode, cross-checked against the weight printed on the label.
#
#   pos: 1  2  3  4  5  6  7  8  9 10 11 12 13
#        2  0  0  1  0  0  1  0  0  2  0  5  3
#        ^  \___________/  \___________/     ^
#     prefix   item code       weight   check digit
SAMPLE = "2001001002053"

CLIENT_SETTINGS = SimpleNamespace(
	prefix_included_or_not=1,
	no_of_prefix_characters=1,
	prefix="2",
	item_code_starting_digit=2,
	item_code_total_digits=6,
	weight_starting_digit=8,
	weight_total_digits=2,
	weight_decimals=3,
	price_included_in_barcode_or_not=0,
	price_starting_digit=0,
	price_total_digit=0,
	price_decimals=0,
)


def with_settings(settings=CLIENT_SETTINGS):
	return patch(
		"xpos.x_pos.api.item_processing.barcode.get_scale_barcode_settings",
		return_value=settings,
	)


class TestScaleBarcodeDecoding(unittest.TestCase):
	"""The decoder itself, which had no test coverage at all."""

	def test_client_sample_decodes_to_item_and_weight(self):
		"""Acceptance criterion 5: barcode 2001001002053 is item 001001 at 0.205 kg."""
		with with_settings():
			data = barcode.parse_scale_barcode_data(SAMPLE)

		self.assertEqual(data["item_code"], "001001")
		self.assertEqual(data["qty"], 0.205)
		self.assertEqual(data["barcode"], SAMPLE)
		self.assertNotIn("price", data)

	def test_weight_digits_counts_integer_places_only(self):
		"""The segment spans weight_total_digits + weight_decimals characters.

		This is the trap in the published example: `weight_total_digits` is not the length of the
		whole weight field, it is the number of digits before the decimal point.
		"""
		with with_settings():
			data = barcode.parse_scale_barcode_data("2001001012345")

		# Positions 8-9 are the integer part, 10-12 the decimals: "01" + "." + "234".
		self.assertEqual(data["qty"], 1.234)

	def test_leading_zeros_in_the_item_code_are_preserved(self):
		"""Item codes are matched as strings; stripping zeros would look up the wrong item."""
		with with_settings():
			data = barcode.parse_scale_barcode_data(SAMPLE)

		self.assertEqual(data["item_code"], "001001")

	def test_barcode_with_a_different_prefix_is_rejected(self):
		with with_settings():
			self.assertIsNone(barcode.parse_scale_barcode_data("3001001002053"))

	def test_blank_barcode_is_rejected(self):
		with with_settings():
			self.assertIsNone(barcode.parse_scale_barcode_data(""))

	def test_missing_settings_yields_nothing(self):
		with with_settings(None):
			self.assertIsNone(barcode.parse_scale_barcode_data(SAMPLE))

	def test_barcode_too_short_for_the_weight_segment_decodes_without_a_quantity(self):
		"""The decoder itself is lenient here: it returns the item code and omits `qty`.

		`resolve_scale_barcode` is what rejects this, because selling 1 unit instead of the weight
		on the label would overcharge the customer.
		"""
		with with_settings():
			data = barcode.parse_scale_barcode_data("20010010")

		self.assertEqual(data["item_code"], "001001")
		self.assertNotIn("qty", data)


class TestResolveScaleBarcode(unittest.TestCase):
	"""The live search path, which previously returned None on every scan."""

	@patch("xpos.api.items.frappe")
	def test_item_code_match_returns_the_weighed_quantity(self, mock_frappe):
		mock_frappe.db.exists.return_value = True
		mock_frappe.get_cached_doc.return_value = MagicMock(
			name="001001",
			item_name="Cashews",
			stock_uom="Kg",
			has_batch_no=0,
			has_serial_no=0,
			is_stock_item=1,
			image=None,
		)
		mock_frappe.get_cached_doc.return_value.name = "001001"
		mock_frappe.get_cached_doc.return_value.get.return_value = None

		with with_settings():
			result = items.resolve_scale_barcode(SAMPLE)

		self.assertEqual(result["item_code"], "001001")
		self.assertEqual(result["qty"], 0.205)
		self.assertTrue(result["is_scale_barcode"])
		self.assertEqual(result["uom"], "Kg")
		self.assertIsNone(result["scale_price"])

	@patch("xpos.api.items.frappe")
	def test_falls_back_to_item_barcode_when_no_item_has_that_code(self, mock_frappe):
		"""Some scales encode an assigned barcode rather than the item code."""
		mock_frappe.db.exists.return_value = False
		mock_frappe.db.get_value.return_value = SimpleNamespace(item_code="CASHEW-001", uom="Gram")
		doc = MagicMock(item_name="Cashews", stock_uom="Kg", has_batch_no=0, has_serial_no=0)
		doc.name = "CASHEW-001"
		doc.get.return_value = None
		mock_frappe.get_cached_doc.return_value = doc

		with with_settings():
			result = items.resolve_scale_barcode(SAMPLE)

		self.assertEqual(result["item_code"], "CASHEW-001")
		# The Item Barcode row's UOM wins, because that is what the scale was configured against.
		self.assertEqual(result["uom"], "Gram")

	@patch("xpos.api.items.frappe")
	def test_unknown_item_yields_nothing(self, mock_frappe):
		mock_frappe.db.exists.return_value = False
		mock_frappe.db.get_value.return_value = None

		with with_settings():
			self.assertIsNone(items.resolve_scale_barcode(SAMPLE))

	@patch("xpos.api.items.frappe")
	def test_non_scale_barcode_yields_nothing(self, mock_frappe):
		with with_settings():
			self.assertIsNone(items.resolve_scale_barcode("9999999999999"))

	@patch("xpos.api.items.frappe")
	def test_truncated_barcode_is_refused_rather_than_sold_as_one_unit(self, mock_frappe):
		"""Without this the cart would take 1 kg of cashews instead of 0.205 kg."""
		mock_frappe.db.exists.return_value = True

		with with_settings():
			self.assertIsNone(items.resolve_scale_barcode("20010010"))

	@patch("xpos.api.items.frappe")
	def test_settings_without_a_weight_segment_still_resolve_the_item(self, mock_frappe):
		"""Then the barcode is just a prefixed item code and a quantity of 1 is correct."""
		mock_frappe.db.exists.return_value = True
		doc = MagicMock(item_name="Cashews", stock_uom="Kg", has_batch_no=0, has_serial_no=0)
		doc.name = "001001"
		doc.get.return_value = None
		mock_frappe.get_cached_doc.return_value = doc

		no_weight = SimpleNamespace(
			prefix_included_or_not=1,
			no_of_prefix_characters=1,
			prefix="2",
			item_code_starting_digit=2,
			item_code_total_digits=6,
			weight_starting_digit=0,
			weight_total_digits=0,
			weight_decimals=0,
			price_included_in_barcode_or_not=0,
		)
		with with_settings(no_weight):
			result = items.resolve_scale_barcode("20010010")

		self.assertEqual(result["item_code"], "001001")
		self.assertEqual(result["qty"], 0)
