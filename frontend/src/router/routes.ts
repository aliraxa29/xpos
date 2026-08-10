import PosView from "@/views/PosView.vue";

const OrdersView = () => import("@/views/OrdersView.vue");
const CashierView = () => import("@/views/CashierView.vue");
const ReportsIndexView = () => import("@/views/ReportsIndexView.vue");
const ReportViewerView = () => import("@/views/ReportViewerView.vue");
const SettingsView = () => import("@/views/SettingsView.vue");
const PurchaseOrderView = () => import("@/views/PurchaseOrderView.vue");
const PurchaseOrderListView = () => import("@/views/PurchaseOrderListView.vue");
const PurchaseInvoiceView = () => import("@/views/PurchaseInvoiceView.vue");
const PurchaseInvoiceListView = () => import("@/views/PurchaseInvoiceListView.vue");
const StockReceivingView = () => import("@/views/StockReceivingView.vue");
const ExpenseView = () => import("@/views/ExpenseView.vue");
const BankDropView = () => import("@/views/BankDropView.vue");
const LoginView = () => import("@/views/LoginView.vue");
const ResetPasswordView = () => import("@/views/ResetPasswordView.vue");
const BarcodePrintView = () => import("@/views/BarcodePrintView.vue");
const SetupWizardView = () => import("@/views/SetupWizardView.vue");
const RolePermissionsView = () => import("@/views/RolePermissionsView.vue");
import { RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
	{
		path: "/setup",
		name: "setup",
		component: SetupWizardView,
		meta: { title: "Setup", requiresAuth: false, isSetupPage: true },
	},
	{
		path: "/login",
		name: "login",
		component: LoginView,
		meta: { title: "Sign In", requiresAuth: false, isAuthPage: true },
	},
	{
		path: "/reset-password",
		name: "reset-password",
		component: ResetPasswordView,
		meta: { title: "Reset Password", requiresAuth: false, isAuthPage: true },
	},
	{
		path: "/",
		redirect: "/pos",
	},
	{
		path: "/pos",
		name: "pos",
		component: PosView,
		meta: { title: "Point of Sale", requiresAuth: true },
	},
	{
		path: "/orders",
		name: "orders",
		component: OrdersView,
		meta: { title: "Orders", requiresAuth: true },
	},
	{
		path: "/cashier",
		name: "cashier",
		component: CashierView,
		meta: { title: "Cashier", requiresAuth: true },
	},
	{
		path: "/reports",
		name: "reports",
		component: ReportsIndexView,
		meta: { title: "Reports", requiresAuth: true },
	},
	{
		path: "/reports/:reportSlug",
		name: "report-viewer",
		component: ReportViewerView,
		meta: { title: "Report Viewer", requiresAuth: true },
	},
	{
		path: "/barcode-print",
		name: "barcode-print",
		component: BarcodePrintView,
		meta: { title: "Barcode Printer", requiresAuth: true },
	},
	{
		path: "/purchase-order",
		name: "purchase-order",
		component: PurchaseOrderView,
		meta: { title: "Purchase Order", requiresAuth: true },
	},
	{
		path: "/purchase-orders",
		name: "purchase-orders",
		component: PurchaseOrderListView,
		meta: { title: "Purchase Orders", requiresAuth: true },
	},
	{
		path: "/purchase-invoice",
		name: "purchase-invoice",
		component: PurchaseInvoiceView,
		meta: { title: "Purchase Invoice", requiresAuth: true },
	},
	{
		path: "/purchase-invoices",
		name: "purchase-invoices",
		component: PurchaseInvoiceListView,
		meta: { title: "Purchase Invoices", requiresAuth: true },
	},
	{
		path: "/stock-receiving",
		name: "stock-receiving",
		component: StockReceivingView,
		meta: { title: "Stock Receiving", requiresAuth: true },
	},
	{
		path: "/settings",
		name: "settings",
		component: SettingsView,
		meta: { title: "Settings", requiresAuth: true },
	},
	{
		path: "/expenses",
		name: "expenses",
		component: ExpenseView,
		meta: { title: "Expenses", requiresAuth: true },
	},
	{
		path: "/bank-drops",
		name: "bank-drops",
		component: BankDropView,
		meta: { title: "Bank Drops", requiresAuth: true },
	},
	{
		path: "/role-permissions",
		name: "role-permissions",
		component: RolePermissionsView,
		meta: { title: "Role Permissions", requiresAuth: true, requiresAdmin: true },
	},
	{
		path: "/price-checker",
		name: "price-checker",
		component: () => import("@/views/PriceChecker.vue"),
		meta: { title: "Price Checker", requiresAuth: true, fullScreen: true },
	},
];

export default routes;
