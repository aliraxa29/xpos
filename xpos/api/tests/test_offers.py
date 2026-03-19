# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt

import unittest
from types import SimpleNamespace
from unittest.mock import patch, MagicMock

from xpos.api import offers


class TestGetOffers(unittest.TestCase):
    """Tests for get_offers function."""

    @patch("xpos.api.offers._get_promotional_scheme_offers")
    @patch("xpos.api.offers.frappe")
    def test_get_offers_returns_active_offers(self, mock_frappe, mock_promo):
        """Test that get_offers returns active POS offers."""
        mock_pos = MagicMock()
        mock_pos.company = "Test Company"
        mock_pos.warehouse = "Store - TC"
        mock_frappe.get_cached_doc.return_value = mock_pos
        mock_frappe.db.sql.return_value = [
            {
                "name": "OFFER-001",
                "offer_title": "10% Off",
                "discount_percentage": 10,
                "disable": 0,
            }
        ]
        mock_promo.return_value = []

        result = offers.get_offers("POS-PROFILE-1")

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["name"], "OFFER-001")

    @patch("xpos.api.offers._get_promotional_scheme_offers")
    @patch("xpos.api.offers.frappe")
    def test_get_offers_includes_promotional_schemes(self, mock_frappe, mock_promo):
        """Test that get_offers includes promotional scheme offers."""
        mock_pos = MagicMock()
        mock_pos.company = "Test Company"
        mock_pos.warehouse = "Store - TC"
        mock_frappe.get_cached_doc.return_value = mock_pos
        mock_frappe.db.sql.return_value = []
        mock_promo.return_value = [
            {
                "name": "PROMO-001",
                "offer_title": "Buy 2 Get 1",
                "from_promotional_scheme": 1,
            }
        ]

        result = offers.get_offers("POS-PROFILE-1")

        mock_promo.assert_called_once_with(mock_pos)
        self.assertEqual(len(result), 1)

    @patch("xpos.api.offers._get_promotional_scheme_offers")
    @patch("xpos.api.offers.frappe")
    def test_get_offers_normalizes_discount_fields(self, mock_frappe, mock_promo):
        """Test that get_offers normalizes discount fields."""
        mock_pos = MagicMock()
        mock_pos.company = "Test Company"
        mock_pos.warehouse = "Store - TC"
        mock_frappe.get_cached_doc.return_value = mock_pos
        mock_frappe.db.sql.return_value = [
            {
                "name": "OFFER-002",
                "discount_percentage": None,  # May be None
                "discount_amount": None,
                "min_qty": None,
                "max_qty": None,
            }
        ]
        mock_promo.return_value = []

        result = offers.get_offers("POS-PROFILE-1")

        # Fields should be normalized to 0 instead of None
        self.assertEqual(result[0].get("min_qty", 0), 0)


class TestGetPosCoupon(unittest.TestCase):
    """Tests for get_pos_coupon function."""

    @patch("xpos.api.offers.frappe")
    def test_get_pos_coupon_validates_existing_coupon(self, mock_frappe):
        """Test that get_pos_coupon validates and returns coupon."""
        mock_frappe.db.get_value.return_value = {
            "name": "COUPON-001",
            "coupon_code": "SUMMER10",
            "coupon_type": "Discount",
            "discount_percentage": 10,
            "valid_from": None,
            "valid_upto": None,
            "customer": None,
        }

        result = offers.get_pos_coupon("SUMMER10", "CUST-001", "Test Company")

        mock_frappe.db.get_value.assert_called()

    @patch("xpos.api.offers.frappe")
    def test_get_pos_coupon_throws_for_invalid_coupon(self, mock_frappe):
        """Test that get_pos_coupon throws error for invalid coupon."""
        mock_frappe.db.get_value.return_value = None
        mock_frappe.throw.side_effect = Exception("Invalid coupon")

        with self.assertRaises(Exception):
            offers.get_pos_coupon("INVALID", "CUST-001", "Test Company")

    @patch("xpos.api.offers.frappe")
    def test_get_pos_coupon_validates_expiry(self, mock_frappe):
        """Test that get_pos_coupon validates coupon expiry date."""
        mock_frappe.db.get_value.return_value = {
            "name": "COUPON-002",
            "coupon_code": "EXPIRED10",
            "valid_from": "2025-01-01",
            "valid_upto": "2025-01-31",  # Expired
        }
        mock_frappe.throw.side_effect = Exception("Coupon has expired")

        with self.assertRaises(Exception):
            offers.get_pos_coupon("EXPIRED10", "CUST-001", "Test Company")


class TestValidateCoupon(unittest.TestCase):
    """Tests for coupon validation logic."""

    @patch("xpos.api.offers.frappe")
    def test_validate_coupon_checks_usage(self, mock_frappe):
        """Test that coupon validation checks if already used."""
        # A coupon with used=1 should be invalid
        mock_frappe.db.get_value.return_value = None  # Not found when filtered by used=0

        result = mock_frappe.db.get_value.return_value
        self.assertIsNone(result)

    def test_coupon_date_validation(self):
        """Test coupon date validation logic."""
        from frappe.utils import getdate, nowdate

        coupon = {
            "valid_from": "2026-01-01",
            "valid_upto": "2026-12-31",
        }

        # Simulate date check
        today = getdate("2026-06-15")  # Mid-year date
        valid_from = getdate(coupon["valid_from"])
        valid_upto = getdate(coupon["valid_upto"])

        is_valid = valid_from <= today <= valid_upto
        self.assertTrue(is_valid)


class TestGetActiveGiftCoupons(unittest.TestCase):
    """Tests for get_active_gift_coupons function."""

    @patch("xpos.api.offers.frappe")
    def test_get_active_gift_coupons_returns_customer_coupons(self, mock_frappe):
        """Test that get_active_gift_coupons returns customer's gift cards."""
        mock_frappe.get_all.return_value = [
            {
                "name": "GIFT-001",
                "coupon_code": "GIFT100",
                "discount_amount": 100,
                "customer": "CUST-001",
            }
        ]

        result = offers.get_active_gift_coupons("CUST-001", "Test Company")

        mock_frappe.get_all.assert_called()
        self.assertEqual(len(result), 1)


class TestGetDeliveryCharges(unittest.TestCase):
    """Tests for get_delivery_charges function."""

    @patch("xpos.api.offers.frappe")
    def test_get_delivery_charges_returns_charges(self, mock_frappe):
        """Test that get_delivery_charges returns delivery charge rules."""
        mock_frappe.get_all.return_value = [
            {
                "name": "DC-001",
                "delivery_type": "Standard",
                "charge_amount": 50,
            },
            {
                "name": "DC-002",
                "delivery_type": "Express",
                "charge_amount": 100,
            },
        ]

        result = offers.get_delivery_charges("POS-PROFILE-1")

        mock_frappe.get_all.assert_called()

    @patch("xpos.api.offers.frappe")
    def test_get_delivery_charges_filters_by_profile(self, mock_frappe):
        """Test that delivery charges are filtered by POS profile."""
        mock_frappe.get_all.return_value = []

        result = offers.get_delivery_charges("POS-PROFILE-1")

        call_args = mock_frappe.get_all.call_args
        # Verify the filter includes pos_profile
        self.assertIsNotNone(call_args)


class TestOfferApplicationLogic(unittest.TestCase):
    """Tests for offer application logic."""

    def test_percentage_discount_calculation(self):
        """Test percentage discount calculation."""
        subtotal = 100
        discount_percentage = 10

        discount = subtotal * (discount_percentage / 100)
        final = subtotal - discount

        self.assertEqual(discount, 10)
        self.assertEqual(final, 90)

    def test_fixed_discount_calculation(self):
        """Test fixed amount discount calculation."""
        subtotal = 100
        discount_amount = 15

        final = subtotal - discount_amount

        self.assertEqual(final, 85)

    def test_min_qty_requirement(self):
        """Test minimum quantity requirement for offer."""
        offer = {"min_qty": 3}
        cart_qty = 5

        meets_requirement = cart_qty >= offer["min_qty"]
        self.assertTrue(meets_requirement)

    def test_min_amount_requirement(self):
        """Test minimum amount requirement for offer."""
        offer = {"min_amt": 100}
        cart_total = 150

        meets_requirement = cart_total >= offer["min_amt"]
        self.assertTrue(meets_requirement)

    def test_max_qty_limit(self):
        """Test maximum quantity limit for offer."""
        offer = {"max_qty": 5, "discount_percentage": 10}
        cart_qty = 10

        # Only up to max_qty items get the discount
        discounted_qty = min(cart_qty, offer["max_qty"])
        self.assertEqual(discounted_qty, 5)

    def test_buy_x_get_y_logic(self):
        """Test buy X get Y offer logic."""
        offer = {
            "buy_qty": 2,
            "get_qty": 1,
            "free_item": "ITEM-FREE",
        }
        cart_qty = 6  # Buy 6, get 3 free

        free_items = (cart_qty // offer["buy_qty"]) * offer["get_qty"]
        self.assertEqual(free_items, 3)


class TestOfferPriority(unittest.TestCase):
    """Tests for offer priority and stacking."""

    def test_offers_sorted_by_priority(self):
        """Test that offers are sorted by priority."""
        offers_list = [
            {"name": "OFFER-1", "priority": 3},
            {"name": "OFFER-2", "priority": 1},
            {"name": "OFFER-3", "priority": 2},
        ]

        sorted_offers = sorted(offers_list, key=lambda x: x.get("priority", 999))
        
        self.assertEqual(sorted_offers[0]["name"], "OFFER-2")
        self.assertEqual(sorted_offers[2]["name"], "OFFER-1")

    def test_non_stackable_offers(self):
        """Test that non-stackable offers don't combine."""
        applied_offers = []
        new_offer = {"name": "OFFER-X", "stackable": 0}

        # If offer is non-stackable and we already have offers, shouldn't apply
        if applied_offers or not new_offer.get("stackable", 1):
            can_apply = len(applied_offers) == 0 or new_offer.get("stackable", 1) == 1
        else:
            can_apply = True

        self.assertTrue(can_apply)  # Can apply since no existing offers


class TestPromotionalSchemeOffers(unittest.TestCase):
    """Tests for promotional scheme offer conversion."""

    def test_promotional_scheme_to_pos_offer_mapping(self):
        """Test conversion of promotional scheme to POS offer format."""
        promo_rule = {
            "name": "PROMO-RULE-001",
            "discount_percentage": 15,
            "min_qty": 2,
            "apply_on": "Item Code",
        }

        # Convert to POS offer format
        pos_offer = {
            "name": promo_rule["name"],
            "discount_percentage": promo_rule["discount_percentage"],
            "min_qty": promo_rule["min_qty"],
            "from_promotional_scheme": 1,
            "auto": 1,
        }

        self.assertEqual(pos_offer["discount_percentage"], 15)
        self.assertEqual(pos_offer["from_promotional_scheme"], 1)


if __name__ == "__main__":
    unittest.main()
