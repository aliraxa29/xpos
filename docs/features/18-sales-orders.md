# Sales Orders & Quotations

X POS can create Sales Orders and Quotations directly from the POS screen, enabling pre-orders, layaway, and quotation workflows without switching to the ERPNext desk.

---

## Sales Orders

### Creating a Sales Order
When enabled in your POS Profile:

1. Build your cart normally — select customer, add items, apply discounts
2. Instead of proceeding to payment, choose **Create Sales Order**
3. Set a **delivery date** for the order
4. The Sales Order is created as a draft

### Sales Order Fields
The Sales Order includes:
- Customer and customer details
- All items with quantities, rates, and discounts
- Per-item delivery dates
- Per-item additional notes
- Row IDs for reference tracking

### Submitting a Sales Order
- After creation, the Sales Order can be submitted:
  - From the POS interface
  - From the back-office system
- Submitted orders are tracked with name, status, and grand total

### Converting to Invoice
- A Sales Order can be converted directly to a **Sales Invoice** from the POS
- The system:
  1. Takes the Sales Order
  2. Creates a Sales Invoice with all items and details
  3. Links the invoice to the POS Profile and shift
  4. Returns the invoice summary

### Searching Sales Orders
- Search for existing unbilled, non-closed Sales Orders
- Filter by company, currency, and order name
- Useful for converting pending orders to invoices when the customer is ready to pay

---

## Quotations

### Creating a Quotation
1. Build the cart with customer and items
2. Choose **Create Quotation**
3. The Quotation is created as a draft in ERPNext

### Quotation Fields
- Customer and customer details
- Items with quantities, rates, and discounts
- Additional notes per item
- Row IDs for tracking

### Submitting a Quotation
- Quotations can be submitted:
  - Via the `submit_quotation` API from the POS
  - From ERPNext's desk interface
- Submitted quotations show name, status, and grand total

### Updating Quotations
- Existing draft quotations can be updated with revised items, quantities, and prices
- The update API preserves the original quotation name

---

## Workflow: Sales Order → Invoice

A typical workflow for pre-orders:

```
┌──────────────────────┐
│ Customer visits POS   │
│ Places order for      │
│ future pickup/delivery│
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Create Sales Order    │──── Items, qty, delivery date
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Submit Sales Order    │──── Optional approval workflow
└──────────┬───────────┘
           │
           ▼ (When customer returns)
┌──────────────────────┐
│ Search Sales Order    │──── By name or customer
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Convert to Invoice    │──── Creates Sales Invoice
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Process Payment       │──── Normal POS checkout
└──────────────────────┘
```

---

## Workflow: Quotation → Decision

```
┌──────────────────────┐
│ Customer inquires     │
│ about pricing         │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Create Quotation      │──── Items, qty, prices
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Submit Quotation      │──── Can be printed/emailed
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Customer decides      │
│ ┌─── Yes: Convert to │
│ │    Sales Order or   │
│ │    Invoice          │
│ └─── No: Let expire   │
└──────────────────────┘
```

---

## Use Cases

### Pre-Orders
- Take orders for items not yet in stock
- Set expected delivery dates
- Convert to invoice when items arrive

### Layaway
- Customer selects items and creates a Sales Order
- Customer pays deposit (partial payment)
- When fully paid, convert to invoice and deliver

### B2B Quotations
- Create formal quotations for business customers
- Allow review and approval before converting to orders

### Custom Orders
- Record special requests as Sales Orders
- Include per-item notes for customization details

---

## POS Profile Settings

| Setting | Description |
|---|---|
| `allow_sales_order` | Enable creating Sales Orders from POS |
