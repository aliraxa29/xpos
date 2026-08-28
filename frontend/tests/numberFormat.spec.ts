import { beforeEach, describe, expect, it } from "vitest";

import {
	DEFAULT_FLOAT_PRECISION,
	NUMBER_FORMAT_INFO,
	currencyPrecisionOverride,
	floatPrecision,
	formatFloat,
	formatInt,
	formatNumber,
	formatPercent,
	formatQty,
	getNumberFormatInfo,
	hideCurrencySymbol,
	parseNumber,
	precisionFromNumberFormat,
	resetNumberFormatSettings,
	roundTo,
	setNumberFormatSettings,
	systemNumberFormat,
	useNumberFormatFromCurrency,
} from "@/utils/numberFormat";

/** Reset to "System Settings untouched": the Frappe default mask, blank precisions. */
beforeEach(() => {
	(window as any).xpos = undefined;
	resetNumberFormatSettings();
});

describe("settings resolution", () => {
	it("falls back to Frappe's own defaults when nothing is configured", () => {
		expect(systemNumberFormat()).toBe("#,###.##");
		expect(floatPrecision()).toBe(DEFAULT_FLOAT_PRECISION);
		expect(currencyPrecisionOverride()).toBeNull();
		expect(useNumberFormatFromCurrency()).toBe(false);
		expect(hideCurrencySymbol()).toBe(false);
	});

	it("reads the mask off the boot payload without being told to", () => {
		(window as any).xpos = { boot: { xpos_number_format: { number_format: "#.###,##" } } };
		resetNumberFormatSettings();

		expect(systemNumberFormat()).toBe("#.###,##");
	});

	it("prefers the xpos payload over frappe's sysdefaults", () => {
		(window as any).xpos = {
			boot: {
				xpos_number_format: { number_format: "# ###,##" },
				sysdefaults: { number_format: "#,###.##" },
			},
		};
		resetNumberFormatSettings();

		expect(systemNumberFormat()).toBe("# ###,##");
	});

	it("falls back to frappe's sysdefaults when xpos ships no payload", () => {
		(window as any).xpos = { boot: { sysdefaults: { number_format: "#'###.##" } } };
		resetNumberFormatSettings();

		expect(systemNumberFormat()).toBe("#'###.##");
	});

	it("treats a blank precision as unset, not as zero", () => {
		setNumberFormatSettings({ number_format: "#,###.##", float_precision: "", currency_precision: "" });

		expect(floatPrecision()).toBe(DEFAULT_FLOAT_PRECISION);
		expect(currencyPrecisionOverride()).toBeNull();
	});

	it("honours an explicit zero precision", () => {
		setNumberFormatSettings({ number_format: "#,###.##", float_precision: "0", currency_precision: "0" });

		expect(floatPrecision()).toBe(0);
		expect(currencyPrecisionOverride()).toBe(0);
	});
});

describe("getNumberFormatInfo", () => {
	it.each(Object.keys(NUMBER_FORMAT_INFO))("knows the separators for %s", (mask) => {
		const info = getNumberFormatInfo(mask);
		expect(info.decimalStr).toBe(NUMBER_FORMAT_INFO[mask].decimalStr);
		expect(info.groupSep).toBe(NUMBER_FORMAT_INFO[mask].groupSep);
	});

	it("falls back to the anglo mask for an unknown string", () => {
		expect(getNumberFormatInfo("nonsense")).toMatchObject({ decimalStr: ".", groupSep: "," });
	});

	it("reads precision off each mask the way frappe does", () => {
		expect(precisionFromNumberFormat("#,###.##")).toBe(2);
		expect(precisionFromNumberFormat("#,###.###")).toBe(3);
		expect(precisionFromNumberFormat("#.########")).toBe(8);
		expect(precisionFromNumberFormat("#,###")).toBe(0);
		expect(precisionFromNumberFormat("#.###")).toBe(0);
	});
});

describe("formatNumber", () => {
	it("groups in threes with the mask's own separators", () => {
		expect(formatNumber(1234567.891, "#,###.##")).toBe("1,234,567.89");
		expect(formatNumber(1234567.891, "#.###,##")).toBe("1.234.567,89");
		expect(formatNumber(1234567.891, "# ###.##")).toBe("1 234 567.89");
		expect(formatNumber(1234567.891, "# ###,##")).toBe("1 234 567,89");
		expect(formatNumber(1234567.891, "#'###.##")).toBe("1'234'567.89");
	});

	it("groups the indian mask in pairs above the first thousand", () => {
		expect(formatNumber(1234567.89, "#,##,###.##")).toBe("12,34,567.89");
		expect(formatNumber(100000, "#,##,###.##")).toBe("1,00,000.00");
		expect(formatNumber(999, "#,##,###.##")).toBe("999.00");
	});

	it("drops the fraction for a mask that has no decimal separator", () => {
		expect(formatNumber(1234.56, "#,###")).toBe("1,235");
		expect(formatNumber(1234.56, "#.###")).toBe("1.235");
	});

	it("keeps eight decimals for the crypto mask, ungrouped", () => {
		expect(formatNumber(1234.5, "#.########")).toBe("1234.50000000");
	});

	it("takes decimals from the mask when no precision is given", () => {
		expect(formatNumber(5, "#,###.###")).toBe("5.000");
		expect(formatNumber(5, "#,###.##")).toBe("5.00");
	});

	it("takes decimals from float_precision when no mask is given either", () => {
		setNumberFormatSettings({ number_format: "#,###.##", float_precision: "4" });
		expect(formatNumber(5)).toBe("5.0000");
	});

	it("lets an explicit precision override the mask", () => {
		expect(formatNumber(1234.5678, "#,###.##", 3)).toBe("1,234.568");
		expect(formatNumber(1234.5678, "#,###.##", 0)).toBe("1,235");
	});

	it("keeps the minus outside the grouping", () => {
		expect(formatNumber(-1234567.89, "#,###.##")).toBe("-1,234,567.89");
		expect(formatNumber(-1234567.89, "#.###,##")).toBe("-1.234.567,89");
	});

	it("rounds a half-way value up despite binary representation error", () => {
		// 34.535 * 100 is 3453.4999999999995, so a naive toFixed gives 34.53.
		expect(formatNumber(34.535, "#,###.##", 2)).toBe("34.54");
		expect(formatNumber(1.005, "#,###.##", 2)).toBe("1.01");
	});

	it("renders zero and non-finite values as a plain zero", () => {
		expect(formatNumber(0, "#,###.##")).toBe("0.00");
		expect(formatNumber(Number.NaN, "#,###.##")).toBe("0.00");
		expect(formatNumber(null, "#,###.##")).toBe("0.00");
	});

	it("accepts a numeric string written in the same mask", () => {
		expect(formatNumber("1.234,50", "#.###,##")).toBe("1.234,50");
	});
});

describe("formatFloat, formatInt, formatPercent, formatQty", () => {
	beforeEach(() => {
		setNumberFormatSettings({ number_format: "#.###,##", float_precision: "3" });
	});

	it("formats a float at float_precision in the system mask", () => {
		expect(formatFloat(1234.5)).toBe("1.234,500");
	});

	it("formats an int with grouping and no decimals", () => {
		expect(formatInt(1234567)).toBe("1.234.567");
	});

	it("appends a percent sign to a float", () => {
		expect(formatPercent(12.5)).toBe("12,500%");
		expect(formatPercent(12.5, 1)).toBe("12,5%");
	});

	it("trims the trailing zeros off a quantity", () => {
		expect(formatQty(2)).toBe("2");
		expect(formatQty(2.5)).toBe("2,5");
		expect(formatQty(1234)).toBe("1.234");
	});

	it("does not mistake a group separator for a decimal one when trimming", () => {
		// The mask groups with ".", so 1.000 is one thousand and must survive intact.
		expect(formatQty(1000)).toBe("1.000");
	});
});

describe("parseNumber", () => {
	it("round-trips a value through its own mask", () => {
		for (const mask of Object.keys(NUMBER_FORMAT_INFO)) {
			const formatted = formatNumber(1234567.89, mask);
			const expected = getNumberFormatInfo(mask).decimalStr ? 1234567.89 : 1234568;
			expect(parseNumber(formatted, mask)).toBeCloseTo(expected, 6);
		}
	});

	it("reads a european figure when the site is configured for one", () => {
		setNumberFormatSettings({ number_format: "#.###,##" });
		expect(parseNumber("1.234,50")).toBe(1234.5);
	});

	it("reads an anglo figure when the site is configured for one", () => {
		setNumberFormatSettings({ number_format: "#,###.##" });
		expect(parseNumber("1,234.50")).toBe(1234.5);
	});

	it("strips a currency symbol on either side", () => {
		expect(parseNumber("$1,234.50")).toBe(1234.5);
		expect(parseNumber("1,234.50 kr")).toBe(1234.5);
	});

	it("keeps a negative sign", () => {
		expect(parseNumber("-1,234.50")).toBe(-1234.5);
	});

	it("returns zero for nothing usable", () => {
		expect(parseNumber("")).toBe(0);
		expect(parseNumber(null)).toBe(0);
		expect(parseNumber("abc")).toBe(0);
	});

	it("passes a number straight through", () => {
		expect(parseNumber(12.5)).toBe(12.5);
		expect(parseNumber(Number.NaN)).toBe(0);
	});
});

describe("roundTo", () => {
	it("rounds half away from zero, symmetrically", () => {
		expect(roundTo(34.535, 2)).toBe(34.54);
		expect(roundTo(-34.535, 2)).toBe(-34.54);
	});

	it("rounds to whole units at zero precision", () => {
		expect(roundTo(5892300.6, 0)).toBe(5892301);
		expect(roundTo(5892300.4, 0)).toBe(5892300);
	});

	it("returns zero for a non-finite value", () => {
		expect(roundTo(Number.NaN, 2)).toBe(0);
		expect(roundTo(Number.POSITIVE_INFINITY, 2)).toBe(0);
	});
});
