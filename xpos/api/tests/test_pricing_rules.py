# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt

import unittest
from unittest.mock import MagicMock, patch

from xpos.api import pricing_rules


class TestReconcileLinePrices(unittest.TestCase):
	"""Guards on the cart pricing endpoint's contract with the frontend."""

	def test_returns_empty_for_no_payload(self):
		self.assertEqual(
			pricing_rules.reconcile_line_prices(None),
			{"updates": [], "free_lines": [], "invoice_updates": {}},
		)

	def test_returns_empty_for_no_lines(self):
		result = pricing_rules.reconcile_line_prices({"context": {"company": "Test Co"}, "lines": []})

		self.assertEqual(result["updates"], [])

	@patch("xpos.api.pricing_rules.frappe")
	def test_throws_without_a_company(self, mock_frappe):
		mock_frappe.parse_json.side_effect = lambda v: v
		mock_frappe._dict = dict
		mock_frappe.throw.side_effect = RuntimeError("Company is required")

		with self.assertRaises(RuntimeError):
			pricing_rules.reconcile_line_prices({"context": {}, "lines": [{"item_code": "ITEM-A"}]})

	@patch("xpos.api.pricing_rules.pricing_rules_ignored", return_value=True)
	def test_respects_pos_profile_ignore_pricing_rule(self, _ignored):
		"""A profile with ignore_pricing_rule set must price nothing, matching save."""
		result = pricing_rules.reconcile_line_prices(
			{
				"context": {"company": "Test Co", "pos_profile": "Main"},
				"lines": [{"row_id": "r1", "item_code": "ITEM-A", "qty": 1, "rate": 100}],
			}
		)

		self.assertEqual(result, {"updates": [], "free_lines": [], "invoice_updates": {}})

	def test_accepts_a_json_string_payload(self):
		"""The frontend posts the cart as a JSON string."""
		result = pricing_rules.reconcile_line_prices('{"context": {"company": "Test Co"}, "lines": []}')

		self.assertEqual(result["updates"], [])


class TestPricingRulesIgnored(unittest.TestCase):
	@patch("xpos.api.pricing_rules.frappe")
	def test_false_without_a_profile(self, mock_frappe):
		self.assertFalse(pricing_rules.pricing_rules_ignored(None))
		mock_frappe.get_cached_value.assert_not_called()

	@patch("xpos.api.pricing_rules.frappe")
	def test_reads_the_flag_from_the_profile(self, mock_frappe):
		mock_frappe.get_cached_value.return_value = 1

		self.assertTrue(pricing_rules.pricing_rules_ignored("Main"))
		mock_frappe.get_cached_value.assert_called_once_with("POS Profile", "Main", "ignore_pricing_rule")


class TestApplyTransactionRules(unittest.TestCase):
	"""The invoice-level discount block the cart uses to set its own discount."""

	def make_doc(self, **fields):
		doc = MagicMock()
		doc.get.side_effect = lambda key, default=None: fields.get(key, default)
		return doc

	@patch("erpnext.accounts.doctype.pricing_rule.utils.apply_pricing_rule_on_transaction")
	def test_reports_a_percentage_discount(self, mock_apply):
		doc = self.make_doc(additional_discount_percentage=15, discount_amount=2.11)

		result = pricing_rules.apply_transaction_rules(doc)

		mock_apply.assert_called_once_with(doc)
		self.assertEqual(result["additional_discount_percentage"], 15)
		# A percentage rule leaves a derived amount behind; only the driver is sent
		# because the cart's discount is percentage-XOR-amount.
		self.assertEqual(result["discount_amount"], 0)
		self.assertTrue(result["from_pricing_rule"])

	@patch("erpnext.accounts.doctype.pricing_rule.utils.apply_pricing_rule_on_transaction")
	def test_reports_a_flat_discount(self, _mock_apply):
		doc = self.make_doc(additional_discount_percentage=0, discount_amount=25)

		result = pricing_rules.apply_transaction_rules(doc)

		self.assertEqual(result["discount_amount"], 25)
		self.assertEqual(result["additional_discount_percentage"], 0)
		self.assertTrue(result["from_pricing_rule"])

	@patch("erpnext.accounts.doctype.pricing_rule.utils.apply_pricing_rule_on_transaction")
	def test_reports_no_discount_so_the_cart_can_clear_its_own(self, _mock_apply):
		doc = self.make_doc(additional_discount_percentage=0, discount_amount=0)

		result = pricing_rules.apply_transaction_rules(doc)

		self.assertFalse(result["from_pricing_rule"])
		self.assertEqual(result["apply_discount_on"], "Grand Total")


class TestIsOfflineSupported(unittest.TestCase):
	"""Rules the browser engine cannot evaluate faithfully must be flagged, not guessed."""

	def test_plain_rule_is_supported(self):
		self.assertEqual(pricing_rules.is_offline_supported({}, False), 1)

	def test_mixed_conditions_are_not(self):
		self.assertEqual(pricing_rules.is_offline_supported({"mixed_conditions": 1}, False), 0)

	def test_cross_item_rules_are_not(self):
		self.assertEqual(pricing_rules.is_offline_supported({"apply_rule_on_other": "Item Code"}, False), 0)

	def test_condition_scripts_are_not(self):
		self.assertEqual(pricing_rules.is_offline_supported({"condition": "doc.total > 100"}, False), 0)

	def test_blank_condition_is_still_supported(self):
		self.assertEqual(pricing_rules.is_offline_supported({"condition": "   "}, False), 1)

	def test_cumulative_rules_are_not(self):
		self.assertEqual(pricing_rules.is_offline_supported({"is_cumulative": 1}, False), 0)

	def test_per_target_uom_is_not(self):
		self.assertEqual(pricing_rules.is_offline_supported({}, True), 0)


class TestGetActivePricingRules(unittest.TestCase):
	def test_returns_empty_without_a_company(self):
		self.assertEqual(pricing_rules.get_active_pricing_rules({"price_list": "Standard Selling"}), [])

	@patch("xpos.api.pricing_rules.pricing_rules_ignored", return_value=True)
	def test_returns_empty_when_the_profile_ignores_rules(self, _ignored):
		self.assertEqual(
			pricing_rules.get_active_pricing_rules({"company": "Test Co", "pos_profile": "Main"}), []
		)


class TestEnrichLines(unittest.TestCase):
	@patch("xpos.api.pricing_rules.frappe")
	def test_skips_the_query_when_nothing_is_missing(self, mock_frappe):
		lines = [{"item_code": "ITEM-A", "item_group": "Products", "brand": "Acme"}]

		pricing_rules.enrich_lines(lines)

		mock_frappe.get_all.assert_not_called()

	@patch("xpos.api.pricing_rules.frappe")
	def test_fills_in_item_group_and_brand(self, mock_frappe):
		row = MagicMock()
		row.name = "ITEM-A"
		row.item_name = "Item A"
		row.item_group = "Products"
		row.brand = "Acme"
		row.stock_uom = "Nos"
		mock_frappe.get_all.return_value = [row]

		lines = [{"item_code": "ITEM-A"}]
		pricing_rules.enrich_lines(lines)

		self.assertEqual(lines[0]["item_group"], "Products")
		self.assertEqual(lines[0]["brand"], "Acme")

	@patch("xpos.api.pricing_rules.frappe")
	def test_does_not_override_what_the_frontend_sent(self, mock_frappe):
		row = MagicMock()
		row.name = "ITEM-A"
		row.item_name = "Item A"
		row.item_group = "Products"
		row.brand = "Acme"
		row.stock_uom = "Nos"
		mock_frappe.get_all.return_value = [row]

		lines = [{"item_code": "ITEM-A", "item_group": "Beverages"}]
		pricing_rules.enrich_lines(lines)

		self.assertEqual(lines[0]["item_group"], "Beverages")


class TestParseJsonArg(unittest.TestCase):
	def test_returns_the_default_for_empty_input(self):
		self.assertIsNone(pricing_rules.parse_json_arg(None, None))
		self.assertIsNone(pricing_rules.parse_json_arg("", None))

	def test_passes_dicts_through(self):
		payload = {"context": {}, "lines": []}
		self.assertIs(pricing_rules.parse_json_arg(payload, None), payload)


if __name__ == "__main__":
	unittest.main()
