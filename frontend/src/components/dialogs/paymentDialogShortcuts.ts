type PaymentDialogShortcutEvent = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey">;

export function isPaymentDialogSaveOnlyShortcut(event: PaymentDialogShortcutEvent): boolean {
	return event.key === "Enter" && !event.shiftKey && !event.altKey && (event.ctrlKey || event.metaKey);
}

export function isPaymentDialogSaveAndPrintShortcut(event: PaymentDialogShortcutEvent): boolean {
	return event.key === "Enter" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey;
}
