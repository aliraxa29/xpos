# Copyright (c) 2026, Ali Raza and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe import _, cint
from xpos.x_pos.api.status_updater import StatusUpdater


class XPOSOpeningShift(StatusUpdater):
    # begin: auto-generated types
    # This code is auto-generated. Do not modify anything in this block.

    from typing import TYPE_CHECKING

    if TYPE_CHECKING:
        from frappe.types import DF
        from xpos.x_pos.doctype.xpos_opening_shift_detail.xpos_opening_shift_detail import XPOSOpeningShiftDetail

        amended_from: DF.Link | None
        balance_details: DF.Table[XPOSOpeningShiftDetail]
        company: DF.Link
        period_end_date: DF.Date | None
        period_start_date: DF.Datetime
        pos_closing_shift: DF.Data | None
        pos_profile: DF.Link
        posting_date: DF.Date
        set_posting_date: DF.Check
        status: DF.Literal["Draft", "Open", "Closed", "Cancelled"]
        user: DF.Link
    # end: auto-generated types

    def validate(self):
        self.validate_pos_profile_and_cashier()
        self.set_status()

    def validate_pos_profile_and_cashier(self):
        if self.company != frappe.db.get_value(
            "POS Profile", self.pos_profile, "company"
        ):
            frappe.throw(
                _(
                    "POS Profile {} does not belongs to company {}".format(
                        self.pos_profile, self.company
                    )
                )
            )

        if not cint(frappe.db.get_value("User", self.user, "enabled")):
            frappe.throw(
                _(
                    "User {} has been disabled. Please select valid user/cashier".format(
                        self.user
                    )
                )
            )

    def on_submit(self):
        self.set_status(update=True)
