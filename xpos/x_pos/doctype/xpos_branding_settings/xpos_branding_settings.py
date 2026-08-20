# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class XPOSBrandingSettings(Document):
	# begin: auto-generated types
	# This code is auto-generated. Do not modify anything in this block.

	from typing import TYPE_CHECKING

	if TYPE_CHECKING:
		from frappe.types import DF

		dark_accent: DF.Color | None
		dark_accent_foreground: DF.Color | None
		dark_background: DF.Color | None
		dark_border: DF.Color | None
		dark_card: DF.Color | None
		dark_card_foreground: DF.Color | None
		dark_destructive: DF.Color | None
		dark_destructive_foreground: DF.Color | None
		dark_foreground: DF.Color | None
		dark_input: DF.Color | None
		dark_muted: DF.Color | None
		dark_muted_foreground: DF.Color | None
		dark_popover: DF.Color | None
		dark_popover_foreground: DF.Color | None
		dark_primary: DF.Color | None
		dark_primary_foreground: DF.Color | None
		dark_ring: DF.Color | None
		dark_secondary: DF.Color | None
		dark_secondary_foreground: DF.Color | None
		enable_splash: DF.Check
		favicon: DF.AttachImage | None
		light_accent: DF.Color | None
		light_accent_foreground: DF.Color | None
		light_background: DF.Color | None
		light_border: DF.Color | None
		light_card: DF.Color | None
		light_card_foreground: DF.Color | None
		light_destructive: DF.Color | None
		light_destructive_foreground: DF.Color | None
		light_foreground: DF.Color | None
		light_input: DF.Color | None
		light_muted: DF.Color | None
		light_muted_foreground: DF.Color | None
		light_popover: DF.Color | None
		light_popover_foreground: DF.Color | None
		light_primary: DF.Color | None
		light_primary_foreground: DF.Color | None
		light_ring: DF.Color | None
		light_secondary: DF.Color | None
		light_secondary_foreground: DF.Color | None
		logo_dark: DF.AttachImage | None
		logo_light: DF.AttachImage | None
		radius: DF.Float
		splash_background_color: DF.Color | None
	# end: auto-generated types

	def on_update(self):
		frappe.cache().delete_value("xpos_branding")
