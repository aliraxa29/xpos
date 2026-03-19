<div align="center">

# X POS

**A modern, offline-capable Point of Sale for Frappe & ERPNext**

[![Semantic Release](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](license.txt)
[![Frappe](https://img.shields.io/badge/Frappe-v15-blue)](https://frappeframework.com)
[![ERPNext](https://img.shields.io/badge/ERPNext-v15-blue)](https://erpnext.com)

</div>

---

X POS is a feature-rich, offline-first Point of Sale application built on [Frappe](https://frappeframework.com) and [ERPNext](https://erpnext.com). It delivers a fast, keyboard-driven, and fully offline-capable POS experience for retail, hospitality, and service businesses — deployable as a web app, PWA, or Electron desktop application.

## Highlights

| Feature | Description |
|---|---|
| **Offline-First** | Full POS operation without internet. Background sync when reconnected. |
| **Electron Desktop** | Standalone app for Windows, macOS, and Linux with local database and hardware access. |
| **PWA Ready** | Install from browser on any device. Works offline with service-worker caching. |
| **Keyboard-Driven** | 15+ shortcuts, command palette (Ctrl+K), and full keyboard navigation. |
| **Dark Mode & RTL** | System theme detection, manual toggle, and full Right-to-Left layout support. |
| **Multi-Payment** | Split payments across cash, card, mobile money, and custom modes in one transaction. |
| **Hub & Spoke** | Multi-terminal architecture for networked stores with centralized sync. |
| **Full Purchasing** | Purchase orders, purchase invoices, and stock receiving — all from the POS. |

---

## Features

### Point of Sale

- **Real-time cart** – Add items, adjust quantities, apply line-level discounts
- **Multi-payment** – Accept cash, card, mobile wallet, and custom modes per transaction
- **Draft invoices** – Save, retrieve, and manage multiple open orders per session
- **Return mode** – Process returns linked to original invoices with automatic credit notes
- **Repeat sales** – Quickly duplicate previous invoices
- **Customer credit** – Auto-detect unallocated advances and credit notes at checkout
- **Outstanding settlement** – View and pay against a customer's open invoices

### Offline & Sync

- **Continuous offline operation** – Complete POS functionality with no internet
- **Auto background sync** – Pending invoices queue and retry on reconnection
- **Master data caching** – Items, customers, pricing rules, and tax templates cached locally
- **Sync status indicator** – Real-time display of pending transactions and connection state

### Inventory & Purchasing

- **Real-time stock display** – Actual quantities per warehouse
- **Batch & serial tracking** – Select specific batch/serial numbers during sale or return
- **Purchase orders** – Create, search, and invoice against POs
- **Purchase invoices** – Direct invoice entry with multi-line tax
- **Stock receiving** – Goods receipt workflow with PO matching and variance handling
- **Barcode scanning** – Automatic item lookup via integrated barcode scanner

### Customer Management

- **Quick search & inline creation** – Find or add customers without leaving the POS
- **Loyalty programs** – Point accumulation, redemption, and multi-program support
- **Credit limits** – Enforce customer credit policies during checkout
- **Address management** – Multiple billing and shipping addresses per customer

### Pricing & Discounts

- **Price list selection** – Per-transaction selling price list with currency support
- **Pricing rules** – Volume, customer, time-based, and brand/group rules
- **Free-item promotions** – "Buy X get Y free" rules with auto-apply
- **Coupon codes** – Validate and apply reusable coupon and gift-card codes
- **Multi-level discounts** – Item-level, order-level, and permission-controlled additional discounts
- **Delivery charges** – Dynamic delivery fee calculation per basket or customer

### Shift & Cash Management

- **Opening shift** – Define opening balance with cash denomination breakdown
- **Closing shift** – Reconcile all payment modes with tax collection summary
- **Cash expenses** – Record till expenses with GL account allocation
- **Cash deposits** – Move cash from till to bank/safe accounts mid-shift

### Quotations & Sales Orders

- **Quotation creation** – Convert cart to customer-facing quote
- **Sales order conversion** – Create SOs from quotes or directly from POS
- **SO fulfillment** – Invoice against open or partial sales orders

### Receipts & Printing

- **Dynamic print format** – Select from available ERPNext print formats
- **Print format rules** – Conditional printing based on payment type or other criteria
- **Barcode printing** – Generate and print item barcodes and QR codes
- **Thermal printer support** – Optimized for ESC/POS printers

### User Interface

- **Command palette** (Ctrl+K) – Navigate pages, execute actions, search items, and calculate — all from one bar
- **Keyboard shortcuts** – 15+ shortcuts for all major operations with in-app shortcut reference
- **Dark mode** – System theme detection and manual light/dark/system toggle
- **RTL support** – Full Right-to-Left interface for Arabic, Hebrew, and other RTL languages
- **Touch-optimized** – Large buttons and responsive grid layout for retail touchscreens
- **Responsive design** – Adapts to phones, tablets, and desktop displays
- **About dialog** – Version, git info, system details, and environment information

### Deployment Options

| Mode | Description |
|---|---|
| **Web** | Standard browser-based deployment via Frappe site |
| **PWA** | Installable progressive web app with offline service worker |
| **Electron** | Standalone desktop app with local SQLite, hardware access, and auto-updates |
| **Hub & Spoke** | Multi-terminal Electron setup with centralized hub and satellite tills |

### Security & Access Control

- **26+ permission flags** per user — discount authority, return privileges, expense access, price overrides, and more
- **POS Profile assignment** – Granular per-location access control
- **Warehouse-level permissions** – Restrict users to specific inventory locations
- **Frappe authentication** – Standard login with 2FA, API key, and offline auth cache

---

## Requirements

| Dependency | Version |
|---|---|
| Python | >= 3.10 |
| Frappe Framework | v15 |
| ERPNext | v15 |
| Node.js | >= 18 (for builds) |

---

## Installation

### Frappe Cloud

X POS is available on [Frappe Cloud](https://frappecloud.com). Add it as a marketplace app to your site.

### Self-Hosted

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app https://github.com/aliraxa29/xpos --branch develop
bench --site your-site.com install-app xpos
```

Then open your site and launch **X POS** from the app launcher.

---

## Configuration

1. Create or update a **POS Profile** in ERPNext and assign it to the relevant users.
2. Set the default warehouse, payment methods, and print format on the POS Profile.
3. Configure user permissions via the **XPOS Settings** page for granular access control.
4. Open **X POS** from the app launcher to start selling.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3, TypeScript, Pinia, Tailwind CSS, Radix Vue |
| Build | Vite, vite-plugin-pwa, vite-plugin-electron |
| Backend | Frappe Framework (Python) |
| Desktop | Electron with local SQLite |
| Linting | Ruff, ESLint, Prettier |
| Testing | Vitest |
| CI/CD | GitHub Actions, Semantic Release |

---

## Contributing

We welcome contributions from the community! Whether it's bug reports, feature requests, documentation improvements, or code contributions — every bit helps.

Please read our [Contributing Guide](CONTRIBUTING.md) before submitting a pull request.

### Quick Start for Contributors

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app https://github.com/aliraxa29/xpos --branch develop
bench --site your-site.com install-app xpos
cd apps/xpos
pre-commit install
```

### Code Quality

This project uses `pre-commit` for code formatting and linting:

- **ruff** – Python linting, import sorting, and formatting
- **eslint** – JavaScript / TypeScript linting
- **prettier** – Code formatting for JS, Vue, and SCSS

All commits must follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
feat: add barcode printing support
fix: correct tax calculation for returns
docs: update installation instructions
```

### Community

- [Report a Bug](https://github.com/aliraxa29/xpos/issues/new?template=bug_report.md)
- [Request a Feature](https://github.com/aliraxa29/xpos/issues/new?template=feature_request.md)
- [Security Policy](SECURITY.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)

---

## License

MIT — see [license.txt](license.txt) for full terms.

---

<div align="center">

Developed and maintained by **Ali Raza** — [ar.frappe.dev@gmail.com](mailto:ar.frappe.dev@gmail.com)

</div>
