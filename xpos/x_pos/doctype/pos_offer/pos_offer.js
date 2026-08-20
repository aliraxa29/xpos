// Copyright (c) 2026, Ali Raza and contributors
// For license information, please see license.txt

frappe.ui.form.on("POS Offer", {
	setup: function (frm) {
		set_filters(frm);
		toggle_fields(frm);
	},
	refresh: function (frm) {
		toggle_fields(frm);
	},
	onload: function (frm) {
		set_filters(frm);
		toggle_fields(frm);
	},
	validate: function (frm) {
		if (frm.doc.apply_on === "Transaction" && !(frm.doc.min_amt > 0)) {
			frappe.throw(__("Min Amount must be more than zero for Transaction offers"));
		}
		if (frm.doc.offer === "Give Product" && !(frm.doc.given_qty > 0)) {
			frappe.throw(__("Given Quantity must be more than zero"));
		}
		if (frm.doc.offer === "Loyalty Point" && !(frm.doc.loyalty_points > 0)) {
			frappe.throw(__("Loyalty Points must be more than zero"));
		}
	},
	apply_on: function (frm) {
		if (frm.doc.apply_on === "Transaction" && frm.doc.offer === "Item Price") {
			frm.set_value("offer", "");
		}
		toggle_fields(frm);
	},
	offer: function (frm) {
		if (frm.doc.offer !== "Give Product") {
			frm.set_value("apply_type", "");
			frm.set_value("replace_item", 0);
			frm.set_value("replace_cheapest_item", 0);
			frm.set_value("apply_item_code", "");
			frm.set_value("apply_item_group", "");
			frm.set_value("given_qty", 0);
		}
		if (frm.doc.offer !== "Item Price" && frm.doc.offer !== "Grand Total") {
			frm.set_value("discount_type", "");
			frm.set_value("rate", 0);
			frm.set_value("discount_amount", 0);
			frm.set_value("discount_percentage", 0);
		}
		if (frm.doc.offer !== "Loyalty Point") {
			frm.set_value("loyalty_program", "");
			frm.set_value("loyalty_points", 0);
		}
		if (frm.doc.offer === "Grand Total") {
			frm.set_value("discount_type", "Discount Percentage");
		}
		toggle_fields(frm);
	},
	apply_type: function (frm) {
		toggle_fields(frm);
	},
	discount_type: function (frm) {
		if (frm.doc.discount_type !== "Rate") frm.set_value("rate", 0);
		if (frm.doc.discount_type !== "Discount Amount") frm.set_value("discount_amount", 0);
		if (frm.doc.discount_type !== "Discount Percentage") frm.set_value("discount_percentage", 0);
		toggle_fields(frm);
	},
	replace_item: function (frm) {
		if (frm.doc.replace_item) frm.set_value("apply_item_code", "");
		toggle_fields(frm);
	},
	replace_cheapest_item: function (frm) {
		if (frm.doc.replace_cheapest_item) {
			frm.set_value("apply_item_group", "");
			frm.set_value("less_then", 0);
		}
		toggle_fields(frm);
	},
});

function toggle_fields(frm) {
	const apply_on = frm.doc.apply_on;
	const offer = frm.doc.offer;
	const apply_type = frm.doc.apply_type;
	const discount_type = frm.doc.discount_type;

	frm.toggle_display("item", apply_on === "Item Code");
	frm.toggle_reqd("item", apply_on === "Item Code");

	frm.toggle_display("item_group", apply_on === "Item Group");
	frm.toggle_reqd("item_group", apply_on === "Item Group");

	frm.toggle_display("brand", apply_on === "Brand");
	frm.toggle_reqd("brand", apply_on === "Brand");

	frm.toggle_reqd("min_amt", apply_on === "Transaction");

	if (apply_on === "Transaction") {
		frm.set_df_property("offer", "options", "\nGive Product\nGrand Total\nLoyalty Point");
	} else {
		frm.set_df_property("offer", "options", "\nItem Price\nGive Product\nGrand Total\nLoyalty Point");
	}

	const is_give = offer === "Give Product";

	frm.toggle_display("apply_for_section", is_give);
	frm.toggle_display("apply_type", is_give);
	frm.toggle_reqd("apply_type", is_give);

	const show_replace_item = is_give && apply_on === "Item Code" && apply_type === "Item Code";
	const show_replace_cheapest = is_give && apply_on === "Item Group" && apply_type === "Item Group";
	frm.toggle_display("replace_item", show_replace_item);
	frm.toggle_display("replace_cheapest_item", show_replace_cheapest);

	const show_apply_item_code = is_give && apply_type === "Item Code" && !frm.doc.replace_item;
	const show_apply_item_group = is_give && apply_type === "Item Group" && !frm.doc.replace_cheapest_item;
	const show_less_then = show_apply_item_group;

	frm.toggle_display("apply_item_code", show_apply_item_code);
	frm.toggle_reqd("apply_item_code", show_apply_item_code);

	frm.toggle_display("apply_item_group", show_apply_item_group);
	frm.toggle_reqd("apply_item_group", show_apply_item_group);

	frm.toggle_display("less_then", show_less_then);

	frm.toggle_display("product_discount_scheme_section", is_give);
	frm.toggle_display("given_qty", is_give);
	frm.toggle_reqd("given_qty", is_give);

	const show_price = offer === "Item Price" || offer === "Grand Total";

	frm.toggle_display("price_discount_scheme_section", show_price);
	frm.toggle_display("column_break_26", show_price);
	frm.toggle_display("discount_type", show_price);
	frm.toggle_reqd("discount_type", show_price);

	if (offer === "Grand Total") {
		frm.set_df_property("discount_type", "options", "\nDiscount Percentage");
	} else {
		frm.set_df_property("discount_type", "options", "\nRate\nDiscount Percentage\nDiscount Amount");
	}

	frm.toggle_display("rate", show_price && discount_type === "Rate");
	frm.toggle_reqd("rate", show_price && discount_type === "Rate");

	frm.toggle_display("discount_amount", show_price && discount_type === "Discount Amount");
	frm.toggle_reqd("discount_amount", show_price && discount_type === "Discount Amount");

	frm.toggle_display("discount_percentage", show_price && discount_type === "Discount Percentage");
	frm.toggle_reqd("discount_percentage", show_price && discount_type === "Discount Percentage");

	const is_loyalty = offer === "Loyalty Point";

	frm.toggle_display("loyalty_point_scheme_section", is_loyalty);
	frm.toggle_display("loyalty_program", is_loyalty);
	frm.toggle_reqd("loyalty_program", is_loyalty);

	frm.toggle_display("loyalty_points", is_loyalty);
	frm.toggle_reqd("loyalty_points", is_loyalty);

	const auto_blocked =
		is_give && apply_type === "Item Group" && !frm.doc.replace_item && !frm.doc.replace_cheapest_item;
	frm.set_df_property("auto", "read_only", auto_blocked ? 1 : 0);
	if (auto_blocked) frm.set_value("auto", 0);
}

function set_filters(frm) {
	frm.set_query("pos_profile", function () {
		return { filters: { company: frm.doc.company } };
	});
	frm.set_query("warehouse", function () {
		return { filters: { company: frm.doc.company, is_group: 0 } };
	});
	frm.set_query("loyalty_program", function () {
		return { filters: { company: frm.doc.company } };
	});
	frm.set_query("item_group", function () {
		return { filters: { is_group: 0 } };
	});
	frm.set_query("apply_item_group", function () {
		return { filters: { is_group: 0 } };
	});
}
