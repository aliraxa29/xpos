import unittest
from unittest.mock import MagicMock, patch

from xpos.x_pos.integrations import fbr


class DummyMeta:
	def get_field(self, fieldname):
		return True


class DummyDoc(dict):
	def __init__(self, **kwargs):
		super().__init__(**kwargs)
		object.__setattr__(self, "meta", DummyMeta())

	def get(self, key, default=None):
		return super().get(key, default)

	def set(self, key, value):
		self[key] = value

	def __getattr__(self, item):
		try:
			return self[item]
		except KeyError as exc:
			raise AttributeError(item) from exc

	def __setattr__(self, key, value):
		if key == "meta":
			object.__setattr__(self, key, value)
		else:
			self[key] = value


class TestFBRIntegration(unittest.TestCase):
	def setUp(self):
		self.translation_patcher = patch("xpos.x_pos.integrations.fbr._", lambda message: message)
		self.now_patcher = patch(
			"xpos.x_pos.integrations.fbr.now_datetime",
			return_value="2026-04-06 10:30:00",
		)
		self.translation_patcher.start()
		self.now_patcher.start()

	def tearDown(self):
		self.now_patcher.stop()
		self.translation_patcher.stop()

	def _make_invoice(self, **overrides):
		item = DummyDoc(
			item_code="ITEM-001",
			item_name="Test Item",
			qty=2,
			price_list_rate=100,
			rate=100,
			base_net_amount=200,
			base_amount=234,
		)
		payment = DummyDoc(mode_of_payment="Cash", amount=234)
		defaults = {
			"doctype": "Sales Invoice",
			"name": "ACC-SINV-2026-0001",
			"is_pos": 1,
			"pos_profile": "POS-TEST",
			"is_return": 0,
			"posting_date": "2026-04-06",
			"posting_time": "10:30:00",
			"customer": "CUST-0001",
			"customer_name": "Walk In Customer",
			"tax_id": "1234567-8",
			"contact_mobile": "03001234567",
			"items": [item],
			"payments": [payment],
			"taxes": [],
			"base_discount_amount": 0,
			"base_rounded_total": 234,
			"base_grand_total": 234,
		}
		defaults.update(overrides)
		return DummyDoc(**defaults)

	def _mock_profile(self, enabled=True):
		profile = MagicMock()
		profile.enable_fbr_integration = 1 if enabled else 0
		profile.fbr_environment = "Sandbox"
		profile.fbr_pos_id = "110014"
		profile.fbr_api_url = ""
		profile.fbr_skip_ssl_verification = 0
		profile.fbr_local_service_url = "http://localhost:8524"
		profile.get_password.return_value = "secret-token"
		return profile

	def _db_get_value_side_effect(self, doctype, name, fieldname=None, *args, **kwargs):
		if doctype == "Item":
			return {"customs_tariff_number": "11001010", "fbr_third_schedule": 0}
		if doctype == "Mode of Payment":
			return ""
		return None

	@patch("xpos.x_pos.integrations.fbr.requests.post")
	@patch("xpos.x_pos.integrations.fbr.frappe")
	def test_fiscalize_invoice_stores_fbr_response(self, mock_frappe, mock_post):
		invoice = self._make_invoice()
		mock_frappe.get_doc.return_value = self._mock_profile(enabled=True)
		mock_frappe.db.get_value.side_effect = self._db_get_value_side_effect

		response = MagicMock()
		response.status_code = 200
		response.json.return_value = {
			"FBRInvoiceNumber": "9329402106181682148",
			"Code": "100",
			"Response": "Invoice received successfully",
		}
		response.text = '{"FBRInvoiceNumber":"9329402106181682148","Code":"100"}'
		mock_post.return_value = response

		fbr.fiscalize_invoice(invoice)

		self.assertEqual(invoice.fbr_invoice_number, "9329402106181682148")
		self.assertTrue(invoice.fbr_posted_on)

		called_payload = mock_post.call_args.kwargs["json"]
		self.assertEqual(called_payload["InvoiceNumber"], "")
		self.assertEqual(called_payload["USIN"], invoice.name)
		self.assertEqual(called_payload["POSID"], 110014)
		self.assertEqual(called_payload["Items"][0]["PCTCode"], "11001010")

	@patch("xpos.x_pos.integrations.fbr.requests.post")
	@patch("xpos.x_pos.integrations.fbr.frappe")
	def test_fiscalize_invoice_skips_when_disabled(self, mock_frappe, mock_post):
		invoice = self._make_invoice()
		mock_frappe.get_doc.return_value = self._mock_profile(enabled=False)

		fbr.fiscalize_invoice(invoice)

		mock_post.assert_not_called()
		self.assertFalse(invoice.get("fbr_invoice_number"))

	@patch("xpos.x_pos.integrations.fbr.requests.post")
	@patch("xpos.x_pos.integrations.fbr.frappe")
	def test_fiscalize_invoice_requires_pct_code(self, mock_frappe, mock_post):
		invoice = self._make_invoice()
		mock_frappe.get_doc.return_value = self._mock_profile(enabled=True)

		def missing_pct_side_effect(doctype, name, fieldname=None, *args, **kwargs):
			if doctype == "Item":
				return {"customs_tariff_number": "", "fbr_third_schedule": 0}
			if doctype == "Mode of Payment":
				return ""
			return None

		mock_frappe.db.get_value.side_effect = missing_pct_side_effect

		with self.assertRaises(fbr.FBRIntegrationError):
			fbr.fiscalize_invoice(invoice)

		mock_post.assert_not_called()

	@patch("xpos.x_pos.integrations.fbr.requests.post")
	@patch("xpos.x_pos.integrations.fbr.frappe")
	def test_prepare_fiscalization_cloud_success(self, mock_frappe, mock_post):
		invoice = self._make_invoice()
		mock_frappe.get_doc.return_value = self._mock_profile(enabled=True)
		mock_frappe.db.get_value.side_effect = self._db_get_value_side_effect

		response = MagicMock()
		response.status_code = 200
		response.json.return_value = {"FBRInvoiceNumber": "9329402106181682148", "Code": "100"}
		response.text = '{"FBRInvoiceNumber":"9329402106181682148","Code":"100"}'
		mock_post.return_value = response

		outcome = fbr.prepare_fiscalization(invoice)

		self.assertEqual(outcome.status, "cloud")
		self.assertEqual(outcome.fbr_invoice_number, "9329402106181682148")
		# prepare_fiscalization must not mutate the document.
		self.assertFalse(invoice.get("fbr_invoice_number"))

	@patch("xpos.x_pos.integrations.fbr.requests.post")
	@patch("xpos.x_pos.integrations.fbr.frappe")
	def test_prepare_fiscalization_local_required_when_offline(self, mock_frappe, mock_post):
		invoice = self._make_invoice()
		mock_frappe.get_doc.return_value = self._mock_profile(enabled=True)
		mock_frappe.db.get_value.side_effect = self._db_get_value_side_effect
		mock_post.side_effect = fbr.requests.RequestException("connection refused")

		outcome = fbr.prepare_fiscalization(invoice)

		self.assertEqual(outcome.status, "local_required")
		self.assertIsNotNone(outcome.payload)
		self.assertEqual(outcome.payload["POSID"], 110014)
		self.assertEqual(outcome.local_service_url, "http://localhost:8524")
		self.assertFalse(invoice.get("fbr_invoice_number"))

	@patch("xpos.x_pos.integrations.fbr.requests.post")
	@patch("xpos.x_pos.integrations.fbr.frappe")
	def test_fiscalize_invoice_raises_connection_error_when_offline(self, mock_frappe, mock_post):
		invoice = self._make_invoice()
		mock_frappe.get_doc.return_value = self._mock_profile(enabled=True)
		mock_frappe.db.get_value.side_effect = self._db_get_value_side_effect
		mock_post.side_effect = fbr.requests.RequestException("connection refused")

		# The submit-time hook has no client to drive the local fallback → hard-fail.
		with self.assertRaises(fbr.FBRConnectionError):
			fbr.fiscalize_invoice(invoice)

	@patch("xpos.x_pos.integrations.fbr.requests.post")
	@patch("xpos.x_pos.integrations.fbr.frappe")
	def test_prepare_fiscalization_uses_local_id_as_usin(self, mock_frappe, mock_post):
		invoice = self._make_invoice(xpos_local_id="inv_local_123")
		mock_frappe.get_doc.return_value = self._mock_profile(enabled=True)
		mock_frappe.db.get_value.side_effect = self._db_get_value_side_effect
		mock_post.side_effect = fbr.requests.RequestException("offline")

		outcome = fbr.prepare_fiscalization(invoice)

		self.assertEqual(outcome.payload["USIN"], "inv_local_123")


if __name__ == "__main__":
	unittest.main()
