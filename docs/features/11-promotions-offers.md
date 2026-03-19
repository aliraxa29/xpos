# Promotions & Offers

X POS includes a powerful promotions engine supporting automatic discounts, coupon codes, gift cards, pricing rules, and promotional schemes.

---

## POS Offers

POS Offers are the primary way to configure promotions in X POS.

### Offer Types

| Offer Type | Description |
|---|---|
| **Item Price** | Discounts on specific items — rate override, percentage off, or fixed amount off |
| **Give Product** | Free item giveaways — buy X, get Y free |
| **Grand Total** | Discount on the entire order total |
| **Loyalty Point** | Award bonus loyalty points for qualifying purchases |

### Qualifying Criteria (Apply On)

Offers can be triggered based on:
- **Item Code** — Specific item purchased
- **Item Group** — Any item from a group
- **Brand** — Any item from a brand
- **Transaction** — Any transaction meeting thresholds

### Conditions

| Condition | Description |
|---|---|
| Minimum / Maximum Qty | Quantity thresholds to activate the offer |
| Minimum / Maximum Amount | Amount thresholds to activate the offer |
| Valid From / Valid Until | Date validity period |
| Company | Restrict to a specific company |
| POS Profile | Restrict to a specific POS Profile |
| Warehouse | Restrict to a specific warehouse |
| Coupon Based | Requires a coupon code to activate |

### Automatic vs. Manual Offers
- **Auto offers** — Applied automatically when conditions are met
- **Coupon-based offers** — Require the customer to provide a coupon code
- When enabled, auto offers are fetched and applied every time items change in the cart

### Discount Types for Item Price Offers
- **Rate** — Override the item price to a fixed rate
- **Discount Percentage** — Apply a percentage discount on the item
- **Discount Amount** — Deduct a fixed amount from the item price

### Give Product Offers
- Configure the **free item** and **quantity to give**
- Options:
  - Replace the triggering item with the free item
  - Replace the cheapest item in the cart
  - Only apply if the item rate is below a threshold

---

## Coupon Codes

### POS Coupon Setup

| Field | Description |
|---|---|
| Coupon Code | Unique code the customer provides |
| Coupon Type | Promotional or Gift Card |
| POS Offer | The POS Offer this coupon activates |
| Valid From / Valid Until | Validity dates |
| Maximum Use | Maximum number of total redemptions |
| Used Count | Counter of times already redeemed |
| One Use Per Customer | Limit to one use per customer |
| Customer | For gift cards — assigned to a specific customer |
| Campaign | Marketing campaign association |

### Applying a Coupon
1. Click the **Coupon** button in the cart area
2. Enter the coupon code in the input field
3. Click **Apply** or press Enter
4. The system validates the coupon:
   - Is the code valid and active?
   - Are the dates within the validity window?
   - Has the maximum usage been reached?
   - Is the customer eligible? (for customer-specific coupons)
5. If valid, the coupon's associated POS Offer is applied to the cart
6. Applied coupons appear as violet tags in the cart
7. Error messages are shown for invalid or expired coupons

### Gift Cards
- Gift card coupons are tied to a specific customer
- When `auto_fetch_coupons_gifts` is enabled, the system auto-fetches active gift card coupons for the selected customer
- Gift card balance is tracked via the coupon's `maximum_use` and `used` fields

---

## Promotional Scheme Integration

X POS integrates with ERPNext's **Promotional Scheme** feature:

### How It Works
- Promotional Schemes defined in ERPNext are automatically converted to POS Offer-compatible format
- Both **Product Discount** rules (free items) and **Price Discount** rules (rate changes) are supported
- The conversion includes:
  - Discount type mapping
  - Item/group/brand qualification
  - Quantity and amount thresholds
  - Date validity

### Automatic Conversion
- When offers are loaded for the POS, Promotional Scheme rules linked to the POS Profile's price list are included
- No additional configuration needed — existing ERPNext Promotional Schemes work in X POS

---

## Pricing Rules

X POS also integrates with ERPNext's **Pricing Rules** engine for advanced pricing control.

### Features
- Active selling pricing rules are fetched based on:
  - Company and price list
  - Customer, customer group, and territory
  - Validity dates
- Rules can apply to specific items, item groups, or brands
- Cart prices are automatically reconciled with pricing rules

### Cart Price Reconciliation
- When pricing rules are active, cart prices are automatically calculated
- Adjusts per-line rates as needed
- Can add free item lines automatically
- Supports invoice-level adjustments

---

## Offer Application in the Cart

### Visual Display
- Applied auto offers appear as **green tags** on affected cart items
- Applied coupons appear as **violet tags**
- The offer description is shown alongside the tag
- Users can **manually remove** individual offers by clicking the remove button on the tag

### Offer Tracking
When the invoice is created, offer information is tracked:
- Which offers were applied to the order
- Which coupons were used
- Per-item offer details for reporting
- Free items are marked separately

---

## Tips

- Combine POS Offers with Promotional Schemes for maximum flexibility
- Use coupon-based offers for targeted promotions (email campaigns, loyalty rewards)
- Auto offers work best for store-wide or always-on promotions (e.g., "Buy 2 Get 1 Free")
- Monitor coupon usage through the system
- Gift cards are great for customer retention when issued after returns or as loyalty rewards
