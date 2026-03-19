# Multi-Currency

X POS supports transactions in multiple currencies, allowing businesses that serve international customers or operate in multi-currency environments.

---

## Overview

When `allow_multi_currency` is enabled on the POS Profile, POS operators can:
- Process sales in a currency different from the company's default
- Apply real-time or manual exchange rates
- Display totals in both transaction and base currencies

---

## How It Works

### Currency Selection
- The transaction currency can be set in the cart area
- The exchange rate is fetched from the server or entered manually

### Exchange Rate
- The system provides current exchange rates
- Rates are sourced from your currency exchange settings

### Totals Display
- Item rates are shown in the transaction currency
- The cart summary may display:
  - **Transaction currency total** — What the customer pays
  - **Base currency equivalent** — For accounting purposes

---

## Invoice Impact

When a multi-currency invoice is created:
- The transaction currency and exchange rate are recorded
- The Sales Invoice tracks both transaction currency and base currency totals
- The Closing Shift records both transaction amounts and base amounts

## Tips

- Keep exchange rates updated for accurate accounting
- Review the base currency total to ensure correct accounting impact
- Multi-currency adds complexity; only enable if your business requires it
- Currency conversion occurs at the time of invoice creation
