# Loyalty Program

X POS integrates with ERPNext's Loyalty Program to reward repeat customers with points, tiers, and redeemable rewards.

---

## Overview

The loyalty system allows customers to:
- Earn points on every purchase
- Accumulate points toward tiers with increasing benefits
- Redeem points as payment toward future purchases
- Track their loyalty status and balance

---

## Enrolling a Customer

### From the POS Screen
1. Select a customer who is not yet enrolled
2. Open the **Loyalty Dialog** (accessible from the cart area)
3. Browse available loyalty programs showing:
   - Program name
   - Conversion factor (points per currency unit)
   - Point expiry policy
   - Available tiers and their thresholds
4. Select a program and click **Enroll**
5. The customer is now enrolled and will begin earning points

### Automatic Enrollment
- Loyalty enrollment can also be managed from the ERPNext backend for bulk operations

---

## Loyalty Information Display

Once a customer is enrolled, the POS shows:

| Info | Description |
|---|---|
| **Program name** | Which loyalty program the customer belongs to |
| **Points balance** | Total available (non-expired) loyalty points |
| **Monetary value** | Calculated value of points based on conversion factor |
| **Current tier** | The customer's loyalty tier (e.g., Silver, Gold, Platinum) |
| **Tier thresholds** | Points needed to reach the next tier |

---

## Earning Points

- Points are automatically calculated and awarded when an invoice is submitted
- The number of points earned depends on:
  - The **conversion factor** defined in the loyalty program
  - The **invoice total** amount
  - The applicable **tier rules**
- Earned points appear on the invoice detail and order history

---

## Redeeming Points

### During Checkout
1. Proceed to the **Payment Dialog** with the enrolled customer
2. The dialog shows:
   - Current points balance
   - Monetary value of the points
3. Click **Redeem Points**
4. The system auto-calculates the points to apply:
   - Points converted to monetary value based on the conversion factor
   - Capped at the order total (cannot redeem more than the order value)
5. The redeemed amount is deducted from the amount due
6. Continue with remaining balance using other payment methods

### Before Submitting
- Click **Remove Loyalty** to undo the redemption if needed
- You can adjust other payments after applying loyalty

### On Invoice
- Loyalty redemption is recorded on the invoice
- A Loyalty Point Entry is created deducting the redeemed points

---

## Unenrolling a Customer

1. Open the Loyalty Dialog for an enrolled customer
2. View their current enrollment details
3. Click **Unenroll** to remove the customer from the loyalty program
4. Confirmation is required before unenrolling
5. Existing points may be forfeited (depending on program configuration)

---

## Loyalty Tiers

Loyalty programs can have multiple tiers:

| Aspect | Description |
|---|---|
| **Tier name** | e.g., Bronze, Silver, Gold, Platinum |
| **Minimum points** | Points threshold to qualify for the tier |
| **Benefits** | Tier-specific conversion rates or special offers |
| **Auto-upgrade** | Customers are automatically moved to higher tiers as they earn points |

---

## Loyalty in Order History

Each order in the Order History shows:
- Loyalty program name
- Points earned from the transaction
- Points redeemed (if any)
- Remaining balance after the transaction

---

## Point Expiry

- Loyalty points can have an expiry policy defined in the program
- Only non-expired points are counted toward the available balance
- Expired points are excluded from the monetary value calculation

---

## Tips

- Loyalty programs are a powerful tool for customer retention
- Set meaningful tier thresholds to encourage customers to reach the next level
- Monitor loyalty point balances to understand customer engagement
- Combine loyalty with POS Offers for even more compelling promotions (e.g., "Loyalty Point" offer type awards bonus points)
- Points are tracked per customer via ERPNext's Loyalty Point Entry doctype
