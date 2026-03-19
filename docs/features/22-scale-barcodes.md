# Scale Barcode Support

X POS supports barcode parsing for weighing scales — used in retail environments where items are weighed and a barcode label is printed containing the item code and weight (and optionally price).

---

## Overview

Many grocery stores, butchers, and produce retailers use digital weighing scales that print barcode labels encoding:
- A **prefix** identifying the barcode type
- An **item code** segment
- A **weight** segment (with decimal precision)
- Optionally, a **price** segment

X POS can parse these barcodes and automatically add the correct item with the right quantity (weight) to the cart.

---

## Scale Barcode Settings

The **Scale Barcode Settings** screen configures how to parse scale barcodes:

### Prefix Configuration
| Field | Description |
|---|---|
| Prefix Included | Whether the barcode has a fixed prefix |
| Number of Prefix Characters | Length of the prefix segment |
| Prefix | Expected prefix value (e.g., "331", "99") |

### Item Code Segment
| Field | Description |
|---|---|
| Item Code Starting Position | Position where the item code starts |
| Item Code Total Digits | Number of digits in the item code segment |

### Weight Segment
| Field | Description |
|---|---|
| Weight Starting Position | Position where weight starts |
| Weight Total Digits | Number of integer digits in the weight |
| Weight Decimals | Number of decimal digits in the weight |

### Price Segment (Optional)
| Field | Description |
|---|---|
| Price Included | Whether the barcode contains a price |
| Price Starting Position | Position where price starts |
| Price Total Digits | Number of integer digits in the price |
| Price Decimals | Number of decimal digits in the price |

---

## Example

### Barcode Format: `331 IIIII WWWWW PP`
```
Barcode:  3310012301234500
          ├─┤├────┤├────┤├┤
          │  │     │     └── Price: ignored or "00"
          │  │     └── Weight: 01234.5 → 1.2345 kg
          │  └── Item Code: 00123
          └── Prefix: 331
```

### Settings
```
Prefix Included:           Yes
Number of Prefix Characters: 3
Prefix:                    "331"
Item Code Starting Position: 4
Item Code Total Digits:    5
Weight Starting Position:  9
Weight Total Digits:       4
Weight Decimals:           1
```

### Result
- Item code: "00123" → matched to the item in the system
- Quantity: 1234.5 (interpreted as 1234 + 0.5 decimal) → 1.2345 kg
- Item is added to the cart with quantity 1.2345

---

## How It Works in the POS

1. The cashier scans a scale barcode using the barcode scanner
2. X POS first tries to match the barcode against Item Barcode records and direct item codes
3. If no match is found, the **scale barcode parser** is invoked
4. The parser:
   - Checks if the barcode starts with the configured prefix
   - Extracts the item code segment
   - Extracts the weight segment (with decimal precision)
   - Optionally extracts the price segment
   - Looks up the item by the extracted code
5. If the item is found:
   - It is added to the cart with the extracted weight as the quantity
   - The price may be overridden if the barcode contains price data

---

## Configuration Steps

1. Navigate to **Scale Barcode Settings** in the system
2. Enable the prefix check if your scale barcodes use one
3. Enter the prefix value and length
4. Map the digit positions for item code, weight, and optionally price
5. Save the settings
6. Test with a sample barcode to verify parsing

---

## Tips

- Scale barcode formats vary by manufacturer — consult your scale's manual for the exact format
- Use the prefix to distinguish scale barcodes from regular product barcodes
- Test thoroughly with actual scale-printed barcodes before going live
- Weight decimals are critical — incorrect decimal placement will result in wrong quantities
- This feature works offline when items are pre-cached
