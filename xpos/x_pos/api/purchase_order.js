// XPOS Purchase Order Client Script
// Adds stock-in-hand, transit stock, packing calculations, and grid focus

frappe.ui.form.on("Purchase Order", {
    setup(frm) {
        // Ensure all custom columns are visible in child table grid
        frm.fields_dict.items.grid.update_docfield_property("custom_alias", "in_list_view", 1);
        frm.fields_dict.items.grid.update_docfield_property("custom_stock_in_hand", "in_list_view", 1);
        frm.fields_dict.items.grid.update_docfield_property("custom_transit_stock", "in_list_view", 1);
        frm.fields_dict.items.grid.update_docfield_property("custom_required_loose", "in_list_view", 1);
        frm.fields_dict.items.grid.update_docfield_property("custom_required_packs", "in_list_view", 1);
        frm.fields_dict.items.grid.update_docfield_property("custom_generic_item", "in_list_view", 1);
        frm.fields_dict.items.grid.update_docfield_property("custom_category", "in_list_view", 1);
        frm.fields_dict.items.grid.update_docfield_property("custom_class", "in_list_view", 1);
        frm.fields_dict.items.grid.update_docfield_property("custom_item_packing", "in_list_view", 1);
        frm.fields_dict.items.grid.update_docfield_property("custom_pack_units", "in_list_view", 1);

        // Standard fields visibility in grid
        frm.fields_dict.items.grid.update_docfield_property("rate", "in_list_view", 1);
        frm.fields_dict.items.grid.update_docfield_property("discount_percentage", "in_list_view", 1);
        frm.fields_dict.items.grid.update_docfield_property("amount", "in_list_view", 1);
        frm.fields_dict.items.grid.update_docfield_property("qty", "in_list_view", 1);
        frm.fields_dict.items.grid.update_docfield_property("item_name", "in_list_view", 1);

        // Set rate label to match image
        frm.fields_dict.items.grid.update_docfield_property("rate", "label", "Purchase Price");
        frm.fields_dict.items.grid.update_docfield_property("discount_percentage", "label", "Disc (%)");
    },

    refresh(frm) {
        // Fetch stock data for all items when form loads
        if (frm.doc.items && frm.doc.items.length) {
            _xpos_fetch_stock_data(frm);
        }

        // Add button to refresh stock data
        if (!frm.is_new()) {
            frm.add_custom_button(__("Refresh Stock Data"), function () {
                _xpos_fetch_stock_data(frm);
            }, __("Tools"));
        }
    },

    custom_zero_qty(frm) {
        // Filter out zero qty items if Zero Qty = No
        frm.trigger("validate_zero_qty");
    },

    validate_zero_qty(frm) {
        if (frm.doc.custom_zero_qty === "No") {
            let has_zero = false;
            (frm.doc.items || []).forEach(function (item) {
                if (flt(item.qty) === 0 && flt(item.custom_required_packs) === 0 && flt(item.custom_required_loose) === 0) {
                    has_zero = true;
                }
            });
            if (has_zero) {
                frappe.msgprint(__("Some items have zero quantity. Set 'Zero Qty' to 'Yes' to keep them, or remove them."));
            }
        }
    },

    validate(frm) {
        // Recalculate all item qtys before save
        (frm.doc.items || []).forEach(function (item) {
            _xpos_calculate_qty(frm, item);
        });
    }
});


frappe.ui.form.on("Purchase Order Item", {
    item_code(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.item_code) {
            // Fetch stock and transit data for this item
            _xpos_fetch_item_stock(frm, row);
        }
    },

    custom_required_packs(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        _xpos_calculate_qty(frm, row);
        frm.refresh_field("items");
    },

    custom_required_loose(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        _xpos_calculate_qty(frm, row);
        frm.refresh_field("items");
    },

    custom_pack_units(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        _xpos_calculate_qty(frm, row);
        frm.refresh_field("items");
    },

    qty(frm, cdt, cdn) {
        // When qty is manually changed, reverse-calculate packs and loose
        let row = locals[cdt][cdn];
        let pack_units = flt(row.custom_pack_units);
        if (pack_units > 0) {
            let total_qty = flt(row.qty);
            row.custom_required_packs = Math.floor(total_qty / pack_units);
            row.custom_required_loose = flt(total_qty % pack_units);
            frm.refresh_field("items");
        }
    },

    rate(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        _xpos_calculate_amount(row);
        frm.refresh_field("items");
    },

    discount_percentage(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        _xpos_calculate_amount(row);
        frm.refresh_field("items");
    }
});


// ── Helper Functions ──

function _xpos_calculate_qty(frm, row) {
    let pack_units = flt(row.custom_pack_units);
    let required_packs = flt(row.custom_required_packs);
    let required_loose = flt(row.custom_required_loose);

    if (pack_units > 0 && (required_packs > 0 || required_loose > 0)) {
        row.qty = (required_packs * pack_units) + required_loose;
    }
}

function _xpos_calculate_amount(row) {
    let rate = flt(row.rate);
    let qty = flt(row.qty);
    let disc = flt(row.discount_percentage);

    if (disc > 0) {
        row.amount = flt(qty * rate * (1 - disc / 100));
    } else {
        row.amount = flt(qty * rate);
    }
}

function _xpos_fetch_stock_data(frm) {
    let item_codes = [];
    let warehouse = frm.doc.set_warehouse || "";

    (frm.doc.items || []).forEach(function (item) {
        if (item.item_code && !item_codes.includes(item.item_code)) {
            item_codes.push(item.item_code);
        }
    });

    if (!item_codes.length) return;

    frappe.call({
        method: "xpos.x_pos.api.purchase_orders.get_stock_and_transit",
        args: {
            item_codes: item_codes,
            warehouse: warehouse
        },
        callback: function (r) {
            if (r.message) {
                let stock_data = r.message;
                (frm.doc.items || []).forEach(function (item) {
                    let data = stock_data[item.item_code];
                    if (data) {
                        item.custom_stock_in_hand = flt(data.stock_in_hand);
                        item.custom_transit_stock = flt(data.transit_stock);
                    }
                });
                frm.refresh_field("items");
            }
        }
    });
}

function _xpos_fetch_item_stock(frm, row) {
    let warehouse = row.warehouse || frm.doc.set_warehouse || "";

    frappe.call({
        method: "xpos.x_pos.api.purchase_orders.get_stock_and_transit",
        args: {
            item_codes: [row.item_code],
            warehouse: warehouse
        },
        callback: function (r) {
            if (r.message && r.message[row.item_code]) {
                let data = r.message[row.item_code];
                row.custom_stock_in_hand = flt(data.stock_in_hand);
                row.custom_transit_stock = flt(data.transit_stock);
                frm.refresh_field("items");
            }
        }
    });
}
