# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt

import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from xpos.api import exchange


class TestResolveTenderRate(unittest.TestCase):
	"""The rate a foreign tender leg is valued at is resolved here and nowhere else."""

	@patch("xpos.api.exchange.frappe")
	def test_same_currency_short_circuits_to_one(self, mock_frappe):
		"""An LBP leg on an LBP invoice needs no lookup at all."""
		rate, rate_date = exchange.resolve_tender_rate("LBP", "LBP", "2026-08-17")

		self.assertEqual(rate, 1.0)
		self.assertEqual(rate_date, "2026-08-17")
		mock_frappe.get_all.assert_not_called()

	@patch("xpos.api.exchange.frappe")
	def test_blank_currency_short_circuits_to_one(self, mock_frappe):
		"""An untagged mode of payment carries no currency and must not hit the database."""
		rate, _rate_date = exchange.resolve_tender_rate("", "LBP", "2026-08-17")

		self.assertEqual(rate, 1.0)
		mock_frappe.get_all.assert_not_called()

	@patch("xpos.api.exchange.frappe")
	def test_query_is_bounded_by_posting_date_and_for_selling(self, mock_frappe):
		"""A back-dated invoice must not silently pick up today's rate.

		This is the reason `get_latest_rate` is not used directly: it orders by date
		descending with no upper bound and ignores the buying/selling flags.
		"""
		mock_frappe.get_all.return_value = [SimpleNamespace(exchange_rate=90000, date="2026-08-17")]
		mock_frappe.utils = MagicMock()

		with patch("xpos.api.exchange.getdate", side_effect=lambda value: value):
			rate, rate_date = exchange.resolve_tender_rate("USD", "LBP", "2026-08-17")

		self.assertEqual(rate, 90000.0)
		self.assertEqual(rate_date, "2026-08-17")

		filters = mock_frappe.get_all.call_args.kwargs["filters"]
		self.assertEqual(filters["from_currency"], "USD")
		self.assertEqual(filters["to_currency"], "LBP")
		self.assertEqual(filters["date"], ["<=", "2026-08-17"])
		self.assertEqual(filters["for_selling"], 1)
		self.assertEqual(mock_frappe.get_all.call_args.kwargs["limit"], 1)
		self.assertEqual(mock_frappe.get_all.call_args.kwargs["order_by"], "date desc, creation desc")

	@patch("xpos.api.exchange.get_latest_rate")
	@patch("xpos.api.exchange.frappe")
	def test_falls_back_to_get_latest_rate_and_logs(self, mock_frappe, mock_get_latest_rate):
		"""With no selling-flagged record on or before the date, fall back but leave a trail."""
		mock_frappe.get_all.return_value = []
		mock_get_latest_rate.return_value = (89000, "2026-08-10")

		with patch("xpos.api.exchange.getdate", side_effect=lambda value: value):
			rate, rate_date = exchange.resolve_tender_rate("USD", "LBP", "2026-08-17")

		self.assertEqual(rate, 89000.0)
		self.assertEqual(rate_date, "2026-08-10")
		mock_frappe.log_error.assert_called_once()

	@patch("xpos.api.exchange.get_latest_rate")
	@patch("xpos.api.exchange.frappe")
	def test_returns_zero_when_no_rate_exists_anywhere(self, mock_frappe, mock_get_latest_rate):
		"""Callers treat zero as "no rate set" and raise their own message.

		erpnext's get_exchange_rate swallows its own failures and returns 0.0, so this
		path returns rather than raising.
		"""
		mock_frappe.get_all.return_value = []
		mock_get_latest_rate.return_value = (0.0, None)

		with patch("xpos.api.exchange.getdate", side_effect=lambda value: value):
			rate, rate_date = exchange.resolve_tender_rate("USD", "LBP", "2026-08-17")

		self.assertEqual(rate, 0.0)
		self.assertEqual(rate_date, "2026-08-17")
		mock_frappe.log_error.assert_not_called()

	@patch("xpos.api.exchange.frappe")
	def test_cache_prevents_a_second_query_for_the_same_pair(self, mock_frappe):
		"""One invoice with several USD legs must resolve the rate once."""
		mock_frappe.get_all.return_value = [SimpleNamespace(exchange_rate=90000, date="2026-08-17")]
		cache: dict = {}

		with patch("xpos.api.exchange.getdate", side_effect=lambda value: value):
			first = exchange.resolve_tender_rate("USD", "LBP", "2026-08-17", cache)
			second = exchange.resolve_tender_rate("USD", "LBP", "2026-08-17", cache)

		self.assertEqual(first, second)
		self.assertEqual(mock_frappe.get_all.call_count, 1)

	@patch("xpos.api.exchange.frappe")
	def test_cache_is_keyed_by_posting_date(self, mock_frappe):
		"""Two invoices on different dates must not share a rate."""
		mock_frappe.get_all.side_effect = [
			[SimpleNamespace(exchange_rate=90000, date="2026-08-17")],
			[SimpleNamespace(exchange_rate=89000, date="2026-08-10")],
		]
		cache: dict = {}

		with patch("xpos.api.exchange.getdate", side_effect=lambda value: value):
			today = exchange.resolve_tender_rate("USD", "LBP", "2026-08-17", cache)
			backdated = exchange.resolve_tender_rate("USD", "LBP", "2026-08-10", cache)

		self.assertEqual(today[0], 90000.0)
		self.assertEqual(backdated[0], 89000.0)
		self.assertEqual(mock_frappe.get_all.call_count, 2)


class TestCurrencyPrecision(unittest.TestCase):
	"""Precision comes from Currency.number_format so no currency list is hardcoded."""

	@patch("xpos.api.exchange.frappe")
	def test_zero_decimal_format_yields_zero_precision(self, mock_frappe):
		"""LBP is quoted in whole units, so a tender leg must not round to cents.

		`#,###` is the zero-decimal format with comma grouping; `#.###` is its
		period-grouped twin. Neither carries a decimal separator.
		"""
		mock_frappe.db.get_value.return_value = "#,###"

		self.assertEqual(exchange.get_currency_precision("LBP"), 0)

	@patch("xpos.api.exchange.frappe")
	def test_period_grouped_zero_decimal_format_also_yields_zero(self, mock_frappe):
		mock_frappe.db.get_value.return_value = "#.###"

		self.assertEqual(exchange.get_currency_precision("LBP"), 0)

	@patch("xpos.api.exchange.frappe")
	def test_two_decimal_format_yields_two(self, mock_frappe):
		mock_frappe.db.get_value.return_value = "#,###.##"

		self.assertEqual(exchange.get_currency_precision("USD"), 2)

	@patch("xpos.api.exchange.frappe")
	def test_unknown_format_falls_back_to_two(self, mock_frappe):
		"""An unrecognised format string must not raise on the payment path."""
		mock_frappe.db.get_value.return_value = "not-a-number-format"

		self.assertEqual(exchange.get_currency_precision("USD"), exchange.DEFAULT_CURRENCY_PRECISION)

	@patch("xpos.api.exchange.frappe")
	def test_missing_currency_falls_back_to_two(self, mock_frappe):
		mock_frappe.db.get_value.return_value = None

		self.assertEqual(exchange.get_currency_precision("USD"), exchange.DEFAULT_CURRENCY_PRECISION)

	def test_blank_currency_falls_back_to_two(self):
		self.assertEqual(exchange.get_currency_precision(""), exchange.DEFAULT_CURRENCY_PRECISION)


class TestModeTenderCurrencies(unittest.TestCase):
	"""Mode of Payment is the single source of truth for a leg's currency."""

	@patch("xpos.api.exchange.frappe")
	def test_tender_currency_and_type_are_read_together(self, mock_frappe):
		mock_frappe.db.has_column.return_value = True
		mock_frappe.get_all.return_value = [
			frappe_row("Cash USD", "Cash", "USD"),
			frappe_row("Cash LBP", "Cash", None),
		]

		result = exchange.get_mode_tender_currencies(["Cash USD", "Cash LBP"])

		self.assertEqual(result["Cash USD"], {"currency": "USD", "type": "Cash"})
		self.assertEqual(result["Cash LBP"], {"currency": None, "type": "Cash"})

	@patch("xpos.api.exchange.frappe")
	def test_degrades_to_single_currency_before_migration(self, mock_frappe):
		"""Code deployed ahead of `bench migrate` must not break every shift check."""
		mock_frappe.db.has_column.return_value = False
		mock_frappe.get_all.return_value = [frappe_row("Cash", "Cash", None)]

		result = exchange.get_mode_tender_currencies(["Cash"])

		self.assertEqual(result["Cash"], {"currency": None, "type": "Cash"})
		self.assertNotIn("pos_tender_currency", mock_frappe.get_all.call_args.kwargs["fields"])

	@patch("xpos.api.exchange.frappe")
	def test_empty_mode_list_makes_no_query(self, mock_frappe):
		self.assertEqual(exchange.get_mode_tender_currencies([]), {})
		mock_frappe.get_all.assert_not_called()


def frappe_row(name: str, mode_type: str, tender_currency: str | None):
	"""Build a row that behaves like frappe's _dict result: attribute and .get access."""
	row = MagicMock()
	row.name = name
	row.type = mode_type
	row.get.side_effect = lambda key, default=None: {
		"name": name,
		"type": mode_type,
		"pos_tender_currency": tender_currency,
	}.get(key, default)
	return row


class TestBuildTenderRatePayload(unittest.TestCase):
	"""One row per payment mode, so the POS can tag legs without a round trip per mode."""

	@patch("xpos.api.exchange.get_currency_meta")
	@patch("xpos.api.exchange.resolve_tender_rate")
	@patch("xpos.api.exchange.get_mode_tender_currencies")
	@patch("xpos.api.exchange.frappe")
	def test_foreign_and_base_modes_are_both_described(
		self, mock_frappe, mock_tender_map, mock_resolve, mock_meta
	):
		mock_frappe.get_cached_value.return_value = "LBP"
		mock_tender_map.return_value = {
			"Cash USD": {"currency": "USD", "type": "Cash"},
			"Cash LBP": {"currency": None, "type": "Cash"},
		}
		mock_resolve.side_effect = lambda currency, base, date, cache: (
			(90000.0, "2026-08-17") if currency == "USD" else (1.0, "2026-08-17")
		)
		mock_meta.side_effect = lambda currency: {
			"currency": currency,
			"symbol": "$" if currency == "USD" else "L£",
			"precision": 2 if currency == "USD" else 0,
			"smallest_fraction": 0.0,
			"symbol_on_right": 0,
		}

		profile = SimpleNamespace(
			company="Kajo",
			get=lambda field: [
				SimpleNamespace(mode_of_payment="Cash USD"),
				SimpleNamespace(mode_of_payment="Cash LBP"),
			],
		)

		payload = exchange.build_tender_rate_payload(profile, "2026-08-17")

		usd, lbp = payload
		self.assertEqual(usd["mode_of_payment"], "Cash USD")
		self.assertEqual(usd["currency"], "USD")
		self.assertEqual(usd["exchange_rate"], 90000.0)
		self.assertTrue(usd["is_foreign_tender"])
		self.assertEqual(usd["precision"], 2)

		self.assertEqual(lbp["currency"], "LBP")
		self.assertEqual(lbp["exchange_rate"], 1.0)
		self.assertFalse(lbp["is_foreign_tender"])
		self.assertEqual(lbp["precision"], 0)

	@patch("xpos.api.exchange.get_mode_tender_currencies")
	@patch("xpos.api.exchange.frappe")
	def test_profile_without_payment_modes_yields_nothing(self, mock_frappe, mock_tender_map):
		mock_frappe.get_cached_value.return_value = "LBP"
		mock_tender_map.return_value = {}
		profile = SimpleNamespace(company="Kajo", get=lambda field: [])

		self.assertEqual(exchange.build_tender_rate_payload(profile, "2026-08-17"), [])
