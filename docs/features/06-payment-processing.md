# Payment Processing

X POS supports flexible payment processing with multiple payment methods, split payments, loyalty redemption, write-offs, and phone payments.

---

## Payment Dialog

Clicking the **Pay** button opens a full-screen payment dialog where you complete the transaction.

### Dialog Layout
- **Amount Due / Refund Amount** — Large, prominent display of the total amount to be paid (or refunded for returns)
- **Tax Summary** — Subtotal, individual tax lines with inclusive indicators
- **Payment Method Selector** — Buttons for each configured mode of payment
- **Amount Input** — Editable field for the tendered amount
- **Quick Amount Buttons** — Pre-calculated rounded amounts near the total
- **On-Screen Numpad** — Touch-friendly number pad (hidden on mobile devices for space)

---

## Payment Methods

Payment modes are configured in the POS Profile and typically include:

| Mode | Icon | Description |
|---|---|---|
| Cash | Banknotes | Physical cash payment |
| Card | Credit card | Debit/credit card payments |
| Bank Transfer | Building | Direct bank transfers |
| Mobile / M-Pesa | Phone | Mobile money payments |
| Check | Document | Payment by check |
| Custom modes | — | Any other mode defined in ERPNext |

### Selecting a Payment Method
- Click the payment method button to select it
- Use **Left/Right arrow keys** to navigate between methods
- The selected method is highlighted

---

## Single Payment

1. Select a payment method (default is Cash)
2. The **tendered amount** auto-fills with the grand total
3. Adjust the amount if the customer pays a different amount
4. **Quick amount buttons** offer convenient options:
   - **Exact amount** — Matches the grand total exactly
   - **Next 10** — Rounds up to the nearest 10
   - **Next 50** — Rounds up to the nearest 50
   - **Next 100** — Rounds up to the nearest 100
5. If the tendered amount exceeds the grand total, the **change amount** is automatically calculated and displayed

---

## Split Payments

Enable split payments to accept multiple payment methods on a single transaction.

### How to Use
1. Toggle **Split Payment** mode in the payment dialog
2. Select the first payment method and enter the amount
3. Click **Add** to record this payment
4. Select the next payment method and enter its amount
5. Repeat until the full amount is covered
6. The dialog shows:
   - Running list of payments with method and amount
   - **Remaining amount** still due
   - **Total tendered** across all methods

### Example
- Order total: $150
- Cash: $100
- Card: $50
- ✅ Fully paid

---

## Quick Amount Buttons

For faster checkout, quick buttons appear based on the grand total:

| Button | Calculation |
|---|---|
| Exact | Grand total amount |
| ↑10 | Ceiling to next multiple of 10 |
| ↑50 | Ceiling to next multiple of 50 |
| ↑100 | Ceiling to next multiple of 100 |

Clicking a quick button fills the tendered amount and auto-calculates change.

---

## Change Calculation

- When the tendered amount exceeds the amount due, the **change** is calculated and displayed
- Change = Tendered Amount − Grand Total
- Change is shown prominently so the cashier knows the exact amount to return

---

## Loyalty Point Redemption

If the selected customer is enrolled in a loyalty program and has available points:

1. The dialog shows the customer's **loyalty points balance** and its **monetary value**
2. Click **Redeem Points** to apply loyalty points toward the payment
3. The system auto-calculates how many points to redeem (capped at the order total)
4. The redeemed amount is deducted from the amount due
5. Click **Remove Loyalty** to undo the redemption before submitting
6. See [Loyalty Program](12-loyalty-program.md) for full details

---

## Write-Off

- A small **write-off** field is available when `allow_write_off_change` is enabled
- Use it to write off minor rounding differences
- Example: Order total is $10.02, customer pays $10.00 — write off $0.02
- Written-off amounts appear as an amber badge in the cart summary

---

## Phone Payments (M-Pesa)

For payment modes configured as phone-type payments:

1. The system creates or retrieves a **Payment Request** 
2. The payment request is sent to the customer's registered mobile number
3. The customer completes the payment on their phone
4. X POS tracks the Payment Request status

---

## Customer Credit

When `use_customer_credit` is enabled:

1. Available customer credits are shown in the payment dialog
2. Credits come from:
   - **Unallocated Payment Entries** — Advance payments from the customer
   - **Credit Notes** — Refunds or return credits
3. Select credits to apply toward the current payment
4. The applied credit reduces the amount due

---

## Submitting the Invoice

### Validation Before Submit
- Cart must not be empty
- Customer must be selected
- For returns: all items must have negative quantities
- Grand total must have the correct sign (positive for sales, negative for returns)
- Stock validation: checks batch quantities and stock availability

### Submit Actions
- **Save & Print** — Creates and submits the invoice, then opens print preview (keyboard: **Enter**)
- **Save Only** — Creates and submits the invoice without printing (keyboard: **Shift+Enter**)

### What Happens After Submit
1. The invoice is created via the `create_invoice` API
2. The invoice is submitted (or queued for background submission if enabled)
3. If printing is selected, the print preview opens in a new window
4. The `lastInvoiceName` is stored for "Print Last" functionality
5. The cart is completely cleared
6. The POS is ready for the next transaction

### Background Submission
- When `allow_submissions_in_background_job` is enabled, invoices are submitted asynchronously
- This speeds up the checkout process for busy POS stations
- The invoice is created as a draft and submitted in a background job

---

## Offline Payment Handling

- If the POS is **offline** when you submit a payment, the invoice is automatically saved to the IndexedDB queue
- If a **network error** occurs during submission, the system falls back to offline save
- Queued invoices sync automatically when the connection is restored
- See [Offline Mode](16-offline-mode.md) for details

---

## Return Payments

When processing returns, the payment dialog adapts:
- Labels change to "Refund Amount" and "Return & Print"
- The grand total is negative
- The refund amount is clearly displayed
- All items must have negative quantities

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Enter` | Save & Print |
| `Shift+Enter` | Save Only |
| `Esc` | Cancel / Close dialog |
| `←` / `→` | Navigate payment methods |
| `↑` / `↓` | Navigate between input areas |
