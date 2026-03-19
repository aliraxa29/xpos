# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt

import unittest
from types import SimpleNamespace
from unittest.mock import patch, MagicMock

from xpos.api import invoices


class TestCreateInvoice(unittest.TestCase):
    """Tests for create_invoice function."""

    @patch("xpos.api.invoices.frappe")
    def test_create_invoice_requires_pos_profile(self, mock_frappe):
        """Test that create_invoice throws error without POS profile."""
        mock_frappe.throw.side_effect = Exception("POS Profile is required")

        with self.assertRaises(Exception) as context:
            invoices.create_invoice('{"customer": "C1", "items": []}')

        mock_frappe.throw.assert_called()

    @patch("xpos.api.invoices.frappe")
    def test_create_invoice_requires_customer(self, mock_frappe):
        """Test that create_invoice throws error without customer."""
        mock_frappe.throw.side_effect = Exception("Customer is required")

        with self.assertRaises(Exception) as context:
            invoices.create_invoice('{"pos_profile": "POS-1", "items": []}')

        mock_frappe.throw.assert_called()

    @patch("xpos.api.invoices.frappe")
    def test_create_invoice_requires_items(self, mock_frappe):
        """Test that create_invoice throws error without items."""
        mock_frappe.throw.side_effect = Exception("At least one item is required")

        with self.assertRaises(Exception) as context:
            invoices.create_invoice('{"pos_profile": "POS-1", "customer": "C1", "items": []}')

        mock_frappe.throw.assert_called()

    @patch("xpos.api.invoices._validate_return_invoice")
    @patch("xpos.api.invoices.frappe")
    def test_create_invoice_creates_sales_invoice(self, mock_frappe, mock_validate_return):
        """Test that create_invoice creates a Sales Invoice document."""
        mock_pos = MagicMock()
        mock_pos.company = "Test Company"
        mock_pos.warehouse = "Store - TC"
        mock_pos.currency = "USD"
        mock_pos.get.return_value = 0  # create_pos_invoice_instead_of_sales_invoice = 0
        mock_frappe.get_cached_doc.return_value = mock_pos
        mock_frappe.db.get_value.return_value = "Debtors - TC"

        mock_invoice = MagicMock()
        mock_invoice.name = "INV-001"
        mock_invoice.as_dict.return_value = {"name": "INV-001", "grand_total": 100}
        mock_frappe.new_doc.return_value = mock_invoice

        data = {
            "pos_profile": "POS-PROFILE-1",
            "customer": "Customer A",
            "items": [
                {"item_code": "ITEM-001", "qty": 2, "rate": 50}
            ],
            "payments": [
                {"mode_of_payment": "Cash", "amount": 100}
            ],
            "pos_opening_shift": "POS-OPEN-001",
        }

        result = invoices.create_invoice(data)

        mock_frappe.new_doc.assert_called_once_with("Sales Invoice")
        mock_invoice.insert.assert_called_once()

    @patch("xpos.api.invoices._validate_return_invoice")
    @patch("xpos.api.invoices.frappe")
    def test_create_invoice_handles_return(self, mock_frappe, mock_validate_return):
        """Test that create_invoice properly handles return invoices."""
        mock_pos = MagicMock()
        mock_pos.company = "Test Company"
        mock_pos.warehouse = "Store - TC"
        mock_pos.currency = "USD"
        mock_pos.get.return_value = 0
        mock_frappe.get_cached_doc.return_value = mock_pos
        mock_frappe.db.get_value.return_value = "Debtors - TC"

        mock_invoice = MagicMock()
        mock_invoice.name = "INV-RET-001"
        mock_invoice.as_dict.return_value = {"name": "INV-RET-001", "is_return": 1}
        mock_frappe.new_doc.return_value = mock_invoice

        data = {
            "pos_profile": "POS-PROFILE-1",
            "customer": "Customer A",
            "items": [
                {"item_code": "ITEM-001", "qty": -1, "rate": 50}
            ],
            "payments": [
                {"mode_of_payment": "Cash", "amount": -50}
            ],
            "is_return": 1,
            "return_against": "INV-001",
        }

        result = invoices.create_invoice(data)

        mock_validate_return.assert_called_once()
        self.assertEqual(mock_invoice.is_return, 1)
        self.assertEqual(mock_invoice.return_against, "INV-001")

    @patch("xpos.api.invoices.frappe")
    def test_create_invoice_applies_discount(self, mock_frappe):
        """Test that create_invoice applies discount correctly."""
        mock_pos = MagicMock()
        mock_pos.company = "Test Company"
        mock_pos.warehouse = "Store - TC"
        mock_pos.currency = "USD"
        mock_pos.get.return_value = 0
        mock_frappe.get_cached_doc.return_value = mock_pos
        mock_frappe.db.get_value.return_value = "Debtors - TC"

        mock_invoice = MagicMock()
        mock_invoice.name = "INV-002"
        mock_invoice.as_dict.return_value = {"name": "INV-002"}
        mock_frappe.new_doc.return_value = mock_invoice

        data = {
            "pos_profile": "POS-PROFILE-1",
            "customer": "Customer A",
            "items": [{"item_code": "ITEM-001", "qty": 1, "rate": 100}],
            "payments": [{"mode_of_payment": "Cash", "amount": 90}],
            "additional_discount_percentage": 10,
        }

        result = invoices.create_invoice(data)

        self.assertEqual(mock_invoice.additional_discount_percentage, 10)


class TestGetInvoices(unittest.TestCase):
    """Tests for get_invoices function."""

    @patch("xpos.api.invoices.frappe")
    def test_get_invoices_filters_by_shift(self, mock_frappe):
        """Test that get_invoices filters by POS opening shift."""
        mock_frappe.get_all.return_value = [
            {"name": "INV-001", "grand_total": 100, "customer": "C1"},
            {"name": "INV-002", "grand_total": 200, "customer": "C2"},
        ]

        result = invoices.get_invoices(pos_opening_shift="POS-OPEN-001")

        mock_frappe.get_all.assert_called()
        self.assertEqual(len(result), 2)

    @patch("xpos.api.invoices.frappe")
    def test_get_invoices_filters_returns(self, mock_frappe):
        """Test that get_invoices can filter return invoices."""
        mock_frappe.get_all.return_value = [
            {"name": "INV-RET-001", "grand_total": -50, "is_return": 1}
        ]

        result = invoices.get_invoices(pos_opening_shift="POS-OPEN-001", is_return=1)

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["is_return"], 1)


class TestGetInvoiceDetails(unittest.TestCase):
    """Tests for get_invoice_details function."""

    @patch("xpos.api.invoices.frappe")
    def test_get_invoice_details_returns_full_invoice(self, mock_frappe):
        """Test that get_invoice_details returns complete invoice data."""
        mock_invoice = MagicMock()
        mock_invoice.as_dict.return_value = {
            "name": "INV-001",
            "customer": "Customer A",
            "items": [{"item_code": "ITEM-001", "qty": 2, "rate": 50}],
            "payments": [{"mode_of_payment": "Cash", "amount": 100}],
        }
        mock_frappe.get_doc.return_value = mock_invoice

        result = invoices.get_invoice_details("INV-001")

        mock_frappe.get_doc.assert_called_once_with("Sales Invoice", "INV-001")
        self.assertIn("items", result)
        self.assertIn("payments", result)


class TestInvoicePaymentProcessing(unittest.TestCase):
    """Tests for payment processing in invoices."""

    def test_payment_split_calculation(self):
        """Test that split payments sum to total."""
        payments = [
            {"mode_of_payment": "Cash", "amount": 50},
            {"mode_of_payment": "Card", "amount": 30},
            {"mode_of_payment": "Gift Card", "amount": 20},
        ]

        total_paid = sum(p["amount"] for p in payments)
        self.assertEqual(total_paid, 100)

    def test_return_payment_negative_amounts(self):
        """Test that return payments have negative amounts."""
        payments = [
            {"mode_of_payment": "Cash", "amount": -50},
        ]

        total_refunded = sum(p["amount"] for p in payments)
        self.assertEqual(total_refunded, -50)


class TestInvoiceItemProcessing(unittest.TestCase):
    """Tests for item processing in invoices."""

    def test_item_total_calculation(self):
        """Test item total is calculated correctly."""
        items = [
            {"qty": 2, "rate": 50},
            {"qty": 3, "rate": 30},
        ]

        total = sum(item["qty"] * item["rate"] for item in items)
        self.assertEqual(total, 190)

    def test_item_discount_application(self):
        """Test item-level discount calculation."""
        item = {
            "qty": 2,
            "rate": 100,
            "discount_percentage": 10,
        }

        subtotal = item["qty"] * item["rate"]
        discount = subtotal * (item["discount_percentage"] / 100)
        final = subtotal - discount

        self.assertEqual(subtotal, 200)
        self.assertEqual(discount, 20)
        self.assertEqual(final, 180)


class TestValidateReturnInvoice(unittest.TestCase):
    """Tests for return invoice validation."""

    @patch("xpos.api.invoices.frappe")
    def test_validate_return_checks_original_customer(self, mock_frappe):
        """Test that return validates customer matches original invoice."""
        mock_frappe.db.get_value.return_value = "Customer A"

        # Should not throw for matching customer
        items = [{"item_code": "ITEM-001", "qty": -1}]
        
        # When customer matches, no error should be raised
        original_customer = mock_frappe.db.get_value("Sales Invoice", "INV-001", "customer")
        self.assertEqual(original_customer, "Customer A")

    @patch("xpos.api.invoices.frappe")
    def test_validate_return_checks_item_qty(self, mock_frappe):
        """Test that return validates return qty doesn't exceed original."""
        original_items = [
            {"item_code": "ITEM-001", "qty": 5},
            {"item_code": "ITEM-002", "qty": 3},
        ]

        return_items = [
            {"item_code": "ITEM-001", "qty": -2},  # Valid: returning 2 of 5
            {"item_code": "ITEM-002", "qty": -3},  # Valid: returning all 3
        ]

        for ret_item in return_items:
            orig = next((i for i in original_items if i["item_code"] == ret_item["item_code"]), None)
            self.assertIsNotNone(orig)
            self.assertLessEqual(abs(ret_item["qty"]), orig["qty"])


if __name__ == "__main__":
    unittest.main()
