# Copyright (c) 2026, Kodlyft and contributors
# For license information, please see license.txt


from erpnext.accounts.doctype.sales_invoice.sales_invoice import SalesInvoice
from erpnext.controllers.taxes_and_totals import calculate_taxes_and_totals

# import frappe
from frappe.utils import flt


class custom_calculate_taxes_and_totals(calculate_taxes_and_totals):
	def _get_tax_rate(self, tax, item_tax_map):
		if tax.account_head in item_tax_map:
			return flt(item_tax_map.get(tax.account_head), self.doc.precision("rate", tax))
		else:
			return 0


class customSalesInvoice(SalesInvoice):
	def calculate_taxes_and_totals(object):
		return custom_calculate_taxes_and_totals(object)
