import { describe, expect, it } from "vitest";

import {
	isPaymentDialogSaveAndPrintShortcut,
	isPaymentDialogSaveOnlyShortcut,
} from "@/components/dialogs/paymentDialogShortcuts";

function makeEvent(overrides: Partial<KeyboardEvent> = {}): KeyboardEvent {
	return {
		key: "Enter",
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
		altKey: false,
		...overrides,
	} as KeyboardEvent;
}

describe("paymentDialogShortcuts", () => {
	it("treats Ctrl+Enter as save only", () => {
		const event = makeEvent({ ctrlKey: true });

		expect(isPaymentDialogSaveOnlyShortcut(event)).toBe(true);
		expect(isPaymentDialogSaveAndPrintShortcut(event)).toBe(false);
	});

	it("treats Cmd+Enter as save only", () => {
		const event = makeEvent({ metaKey: true });

		expect(isPaymentDialogSaveOnlyShortcut(event)).toBe(true);
		expect(isPaymentDialogSaveAndPrintShortcut(event)).toBe(false);
	});

	it("treats plain Enter as save and print", () => {
		const event = makeEvent();

		expect(isPaymentDialogSaveAndPrintShortcut(event)).toBe(true);
		expect(isPaymentDialogSaveOnlyShortcut(event)).toBe(false);
	});

	it("ignores Enter when Shift is pressed", () => {
		const event = makeEvent({ shiftKey: true });

		expect(isPaymentDialogSaveOnlyShortcut(event)).toBe(false);
		expect(isPaymentDialogSaveAndPrintShortcut(event)).toBe(false);
	});

	it("ignores Enter when Alt is pressed", () => {
		const event = makeEvent({ altKey: true });

		expect(isPaymentDialogSaveOnlyShortcut(event)).toBe(false);
		expect(isPaymentDialogSaveAndPrintShortcut(event)).toBe(false);
	});
});
