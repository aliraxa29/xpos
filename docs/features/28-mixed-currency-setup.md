# Mixed-Currency Tender Setup

The step-by-step configuration for a store that prices in one currency but takes cash notes in
another. The worked example throughout is a Lebanese retailer with a base currency of LBP that
also accepts US dollars at a hand-entered daily rate.

For what the feature does and how a cashier uses it, see
[Payment Processing](06-payment-processing.md#mixed-currency-cash-payment-and-change). For how it
differs from `allow_multi_currency`, see [Multi-Currency](19-multi-currency.md).

Do this once, in order. Steps 1 to 6 are one-time; step 7 is daily.

---

## 1. Currency masters

Both currencies must be enabled, and both need a correct `number_format` — it is the only source
of an amount's decimal places.

| Currency | `number_format` | Renders |
|---|---|---|
| LBP | `#,###` | `5,892,300` |
| USD | `#,###.##` | `100.00` |

`#,###` and `#.###` are the only zero-decimal formats Frappe recognises. Leaving a zero-decimal
currency at `#,###.##` gives every amount phantom cents that will never reconcile against a drawer
count, so check this before anything else.

Set a symbol on each currency while you are here.

---

## 2. Company and rounding

| Setting | Value |
|---|---|
| Company default currency | LBP |
| `Global Defaults.disable_rounded_total` | `0` |

Leaving rounded totals enabled keeps ERPNext's `rounded_total` and the frontend's own rounding in
agreement. Disabling it lets them drift by a minor unit.

---

## 3. Modes of Payment

Create one mode per currency of cash you accept.

| Field | Cash LBP | Cash USD |
|---|---|---|
| `type` | `Cash` | `Cash` |
| `pos_tender_currency` | `LBP` (or blank) | `USD` |
| Mode of Payment Account | Shared **LBP** cash account | The **same** LBP cash account |

Both are mandatory:

- `type = Cash` — change calculation is gated on it, so a non-cash mode can never hand change back
- The account row — `before_save` throws without one for the company

The account must stay in the **company currency** for both modes. A USD-denominated account cannot
work: ERPNext writes `payment_mode.amount` into `debit_in_account_currency`, and that field always
holds the invoice-currency value.

---

## 4. POS Profile

| Setting | Value |
|---|---|
| `payments` | Both modes listed |
| `cash_mode_of_payment` | `Cash LBP` |
| `account_for_change_amount` | The same shared LBP cash account |
| `pos_mixed_currency_tender` | `1` |
| `allow_multi_currency` | **off** |

---

## 5. POS Settings

`post_change_gl_entries` must be `1`. The `enable_pos_change_gl_entries` patch sets it on migrate.

With it off, ERPNext subtracts the full change amount from `base_amount` on **every** payment row
matching `account_for_change_amount`, which is only correct when exactly one row matches. Zero
matches leaves a dangling Debtors credit and two matches subtracts twice — and because debits
still equal credits either way, nothing errors. A server-side guard refuses the sale if the
setting is ever turned back off.

---

## 6. Price list

Use a selling price list in whichever currency the store actually prices in. `allow_multi_currency`
stays off.

---

## 7. The daily rate

One **Currency Exchange** record per trading day:

| Field | Value |
|---|---|
| `from_currency` | `USD` |
| `to_currency` | `LBP` |
| `exchange_rate` | `90000` |
| `date` | Today |
| `for_buying` | ✅ |
| `for_selling` | ✅ |

**`for_selling` is required** — the resolver filters on it, and a record without it is invisible to
the POS. Tick both to keep the record usable elsewhere in ERPNext.

If today's record is missing, X POS falls back to the newest rate available and writes an
error-log entry saying so. The payment dialog shows an amber warning when the rate it is using is
not from today.

---

## 8. Opening float

Enter the float per mode, in each mode's **native** currency:

| Mode | Opening amount |
|---|---|
| Cash USD | `200` |
| Cash LBP | `1,000,000` |

The closing count sheet asks for the same units back.

---

## Verifying the setup

Ring up one sale and check it end to end.

1. Sell an item at 5,892,300 LBP. Tender `100` on Cash USD; confirm the dialog reads
   `$100.00 at 90,000 = L£9,000,000` and change due of `3,107,700`.
2. Split the change: `407,700` on Cash LBP and `$30.00` on Cash USD. The submit button stays
   disabled until the legs add up.
3. Submit, then open the **General Ledger** report for the invoice. Debtors must net to exactly
   **5,892,300 Dr** and the cash account to **5,892,300**, with `outstanding_amount = 0`.
4. Reopen the submitted invoice after changing the daily rate. Its payment rows must still read
   the old rate — rates are frozen at submit time.
5. Close the shift. The count sheet must ask for **$270** and **592,300 LBP** as separate lines.

---

## Tips

- Deploy tender-currency changes **between shifts**: tagging a mode changes the units its drawer is
  counted in, and a shift opened before the change will be counted after it
- A foreign-currency invoice queued offline and replayed after the rate moved will be rejected on
  purpose. Re-ring it at the current rate rather than editing the rate to match
- There is no FX gain or loss tracking. The foreign figure is drawer-reconciliation metadata against
  one shared company-currency cash account
- Genuine note shortfalls go through the existing write-off path, not through the change legs. The
  allocator's tolerance is exactly one minor unit and is deliberately not configurable
