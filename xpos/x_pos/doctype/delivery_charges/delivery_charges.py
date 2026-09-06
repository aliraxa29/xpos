# Copyright (c) 2026, Kodlyft and contributors
# For license information, please see license.txt

import json

import frappe
from frappe import _
from frappe.model.document import Document


class DeliveryCharges(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		from xpos.x_pos.doctype.delivery_charges_pos_profile.delivery_charges_pos_profile import (
			DeliveryChargesPOSProfile,
		)

		company: DF.Link
		cost_center: DF.Link
		default_rate: DF.Currency
		disabled: DF.Check
		label: DF.Data
		profiles: DF.Table[DeliveryChargesPOSProfile]
		profiles_list: DF.Code | None
		shipping_account: DF.Link

	# end: auto-generated types
	def validate(self):
		if not self.default_rate or self.default_rate <= 0:
			frappe.throw(_("Default Rate is required"))
		self.validate_profiles()

	def validate_profiles(self):
		profiles = []
		for row in self.profiles:
			if row.pos_profile not in profiles:
				profiles.append(row.pos_profile)
			else:
				frappe.throw(_("Duplicate POS Profile in Delivery Charges"))
		self.set_profiles_list(profiles)

	def set_profiles_list(self, profiles_list):
		if len(profiles_list) > 0:
			self.profiles_list = json.dumps(profiles_list)
		else:
			self.profiles_list = None


def get_applicable_delivery_charges(
	company,
	pos_profile=None,
	customer=None,
	address=None,
	delivery_charges=None,
	restrict=False,
):
	charges = []
	address_list = []
	delivery_charges_list = []
	if address:
		address_list.append(address)
	if customer:
		address_list.extend(
			frappe.get_all(
				"Dynamic Link",
				filters={
					"link_doctype": "Customer",
					"link_name": customer,
					"parentfield": "links",
					"parenttype": "Address",
				},
				pluck="parent",
			)
		)
	for address in address_list:
		address_charges = frappe.get_cached_value("Address", address, "delivery_charges")
		if address_charges:
			delivery_charges_list.append(address_charges)

	delivery_charges_filters = {"disabled": 0, "company": company}
	if delivery_charges:
		delivery_charges_list.append(delivery_charges)

	if len(delivery_charges_list) > 0:
		delivery_charges_filters["name"] = ["in", delivery_charges_list]
	if restrict:
		delivery_charges_filters["profiles_list"] = ["not in", ["", None]]

	delivery_charges_items = frappe.get_all(
		"Delivery Charges",
		filters=delivery_charges_filters,
		fields=["*"],
	)
	delivery_charges_list = [i.name for i in delivery_charges_items]

	delivery_profiels_filters = {"parent": ("in", delivery_charges_list)}
	if pos_profile:
		delivery_profiels_filters["pos_profile"] = pos_profile
	delivery_profiels = frappe.get_all(
		"Delivery Charges POS Profile",
		filters=delivery_profiels_filters,
		fields=["*"],
	)
	for charge in delivery_charges_items:
		profile = next((i for i in delivery_profiels if i.parent == charge.name), None)
		if profile:
			charge.rate = profile.rate
			charges.append(charge)
		else:
			if not restrict:
				if not charge.profiles_list:
					charge.rate = charge.default_rate
					charges.append(charge)

	return charges
