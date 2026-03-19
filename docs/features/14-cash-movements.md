# Cash Movements

X POS tracks cash-in and cash-out operations during a shift, providing full accountability for register movements outside of regular sales.

---

## Overview

Cash movements allow POS operators to:
- Record **cash expenses** (petty cash withdrawals for operational needs)
- Record **cash deposits** (moving cash to a safe or back-office account)
- View a history of all movements during the current shift
- Cancel movements if errors are made

Each cash movement is backed by a **Journal Entry** in ERPNext for accurate accounting.

---

## POS Expense

Record cash removed from the register for operational expenses.

### How to Create
1. Open the **Cash Movement Dialog** from the POS toolbar
2. Select **Expense** as the movement type
3. Choose an **expense account** from the dropdown (or use the default)
4. Enter the **amount** being withdrawn
5. Enter a **reason/remarks** (required if `require_cash_movement_remarks` is enabled)
6. Click **Submit**

### What Happens
- A **POS Cash Movement** document is created with type "Expense"
- A **Journal Entry** is created:
  - Debit: Expense Account (the expense)
  - Credit: POS Cash Account (cash leaving the register)
- The movement is linked to the current POS Opening Shift

### Example Use Cases
- Buying supplies for the store
- Paying for a delivery service
- Emergency petty cash withdrawals

---

## Cash Deposit

Record cash transfers from the register to a bank, safe, or back-office account.

### How to Create
1. Open the **Cash Movement Dialog** from the POS toolbar
2. Select **Deposit** as the movement type
3. Choose a **target account** (bank account or safe account)
4. Enter the **amount** being deposited
5. Enter a **reason/remarks** (optional unless required by settings)
6. Click **Submit**

### What Happens
- A **POS Cash Movement** document is created with type "Deposit"
- A **Journal Entry** is created:
  - Debit: Target Account (where the cash goes)
  - Credit: POS Cash Account (cash leaving the register)
- The movement is linked to the current POS Opening Shift

### Example Use Cases
- Mid-shift cash drops to the safe
- Depositing excess cash to the bank
- Transferring cash to another register

---

## Movement History

### Viewing Movements
- The Cash Movement Dialog shows a scrollable list of **recent movements** for the current shift
- Each entry displays:
  - Movement type (Expense or Deposit)
  - Reason/remarks
  - Amount
  - Status

### Filtering
- Filter by movement type (Expense / Deposit)
- Filter by status
- Search by text

---

## Cancelling a Movement

- When enabled in your POS settings:
  1. Find the movement in the history list
  2. Click **Cancel**
  3. The movement is cancelled
  4. The linked accounting entry is also cancelled
  5. The accounting impact is reversed

- When enabled, cancelled movements can also be permanently deleted

---

## Accounting Impact

### POS Expense Journal Entry
```
Account                    Debit     Credit
─────────────────────────────────────────────
Expense Account            100.00    
POS Cash Account                     100.00
```

### Cash Deposit Journal Entry
```
Account                    Debit     Credit
─────────────────────────────────────────────
Target (Bank/Safe)         500.00    
POS Cash Account                     500.00
```

---

## Shift Reconciliation Impact

- Cash movements directly affect the expected cash balance at shift closing
- POS Expenses reduce the expected cash, while deposits do the same
- The shift closing reconciliation accounts for these movements when calculating expected vs. actual cash
- All movements for the shift can be reviewed during the closing process

---

## Tips

- Set a maximum amount limit to prevent accidental large withdrawals
- Enable remarks requirement for full audit trail
- Review cash movements during shift closing to ensure all are accounted for
- Use specific expense accounts for different types of expenses (e.g., "Office Supplies", "Transportation")
- Configure allowed expense accounts to restrict where POS expenses can be charged
