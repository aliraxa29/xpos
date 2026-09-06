import {
	getSystemTimeZone,
	getUserDateFormat,
	getUserDatetimeFormat,
	getUserTimeFormat,
	getUserTimeZone,
	SYSTEM_DATE_FORMAT,
	SYSTEM_DATETIME_FORMAT,
	SYSTEM_TIME_FORMAT,
} from "./formats";
import { dayjs, type DayjsInput, type DayjsInstance } from "./dayjs";
import { OpUnitType } from "dayjs";

function isMissingValue(value: DayjsInput | undefined | null): boolean {
	return value === undefined || value === null || value === "";
}

function parseValue(value: DayjsInput | undefined | null): DayjsInstance | null {
	if (isMissingValue(value)) {
		return null;
	}

	const parsed = dayjs(value);
	return parsed.isValid() ? parsed : null;
}

function formatOrFallback(value: DayjsInstance | null, format: string, fallback = ""): string {
	return value?.isValid() ? value.format(format) : fallback;
}

function nowInConfiguredTimeZone(useSystemTime = false): DayjsInstance {
	const timeZone = useSystemTime ? getSystemTimeZone() : getUserTimeZone() || getSystemTimeZone();
	return timeZone ? dayjs().tz(timeZone) : dayjs();
}

export { dayjs } from "./dayjs";
export {
	getSystemTimeZone,
	getUserDateFormat,
	getUserDatetimeFormat,
	getUserTimeFormat,
	getUserTimeZone,
	SYSTEM_DATE_FORMAT,
	SYSTEM_DATETIME_FORMAT,
	SYSTEM_TIME_FORMAT,
} from "./formats";
export type { DayjsInput, DayjsInstance } from "./dayjs";

export function nowDate(): string {
	return nowInConfiguredTimeZone().format(SYSTEM_DATE_FORMAT);
}

export function nowTime(): string {
	return nowInConfiguredTimeZone().format(SYSTEM_TIME_FORMAT);
}

export function nowDatetime(): string {
	return nowInConfiguredTimeZone().format(SYSTEM_DATETIME_FORMAT);
}

export function toDate(value: DayjsInput | undefined | null, fallback = ""): string {
	return formatOrFallback(parseValue(value), SYSTEM_DATE_FORMAT, fallback);
}

export function toDateOrNow(value: DayjsInput | undefined | null): string {
	return toDate(value, nowDate());
}

export function toTime(value: DayjsInput | undefined | null, fallback = ""): string {
	return formatOrFallback(parseValue(value), SYSTEM_TIME_FORMAT, fallback);
}

export function toDatetime(value: DayjsInput | undefined | null, fallback = ""): string {
	return formatOrFallback(parseValue(value), SYSTEM_DATETIME_FORMAT, fallback);
}

export function toDatetimeOrNow(value: DayjsInput | undefined | null): string {
	return toDatetime(value, nowDatetime());
}

export function formatDate(value: DayjsInput | undefined | null, format = getUserDateFormat()): string {
	return formatOrFallback(parseValue(value), format);
}

export function formatTime(value: DayjsInput | undefined | null, format = getUserTimeFormat()): string {
	return formatOrFallback(parseValue(value), format);
}

export function formatDatetime(
	value: DayjsInput | undefined | null,
	format = getUserDatetimeFormat(),
): string {
	return formatOrFallback(parseValue(value), format);
}

export function convertToUserTz(
	value: DayjsInput | undefined | null,
	format = SYSTEM_DATETIME_FORMAT,
): string {
	if (isMissingValue(value)) {
		return "";
	}

	const systemTimeZone = getSystemTimeZone();
	const userTimeZone = getUserTimeZone();

	if (!systemTimeZone || !userTimeZone) {
		return toDatetime(value, "");
	}

	const dateValue = String(value);
	const parsed = dayjs.tz(dateValue, SYSTEM_DATETIME_FORMAT, systemTimeZone).tz(userTimeZone);
	return formatOrFallback(parsed, format);
}

export function convertToSystemTz(
	value: DayjsInput | undefined | null,
	format = SYSTEM_DATETIME_FORMAT,
): string {
	if (isMissingValue(value)) {
		return "";
	}

	const systemTimeZone = getSystemTimeZone();
	const userTimeZone = getUserTimeZone();

	if (!systemTimeZone || !userTimeZone) {
		return toDatetime(value, "");
	}

	const dateValue = String(value);
	const parsed = dayjs.tz(dateValue, getUserDatetimeFormat(), userTimeZone).tz(systemTimeZone);
	return formatOrFallback(parsed, format);
}

export function userToDate(value: string, fallback = ""): string {
	if (!value) {
		return fallback;
	}

	const userDateFormat = getUserDateFormat();
	const parsed = dayjs(value, [userDateFormat.replace("YYYY", "YY"), userDateFormat], true);
	return formatOrFallback(parsed, SYSTEM_DATE_FORMAT, fallback);
}

export function userToDatetime(value: string, fallback = ""): string {
	if (!value) {
		return fallback;
	}

	const userDatetimeFormat = getUserDatetimeFormat();
	const parsed = dayjs(value, [userDatetimeFormat.replace("YYYY", "YY"), userDatetimeFormat], true);
	return formatOrFallback(parsed, SYSTEM_DATETIME_FORMAT, fallback);
}

export function getDiff(value1: DayjsInput, value2: DayjsInput, unit: OpUnitType = "day"): number {
	return dayjs(value1).diff(value2, unit);
}

export function getDayDiff(value1: DayjsInput, value2: DayjsInput): number {
	return getDiff(value1, value2, "day");
}

export function getHourDiff(value1: DayjsInput, value2: DayjsInput): number {
	return getDiff(value1, value2, "hour");
}

export function getMinuteDiff(value1: DayjsInput, value2: DayjsInput): number {
	return getDiff(value1, value2, "minute");
}

export function addDays(value: DayjsInput, days: number): string {
	return dayjs(value).add(days, "day").format(SYSTEM_DATE_FORMAT);
}

export function addMonths(value: DayjsInput, months: number): string {
	return dayjs(value).add(months, "month").format(SYSTEM_DATE_FORMAT);
}

export function weekStart(value?: DayjsInput): string {
	return (parseValue(value) || nowInConfiguredTimeZone()).startOf("week").format(SYSTEM_DATE_FORMAT);
}

export function weekEnd(value?: DayjsInput): string {
	return (parseValue(value) || nowInConfiguredTimeZone()).endOf("week").format(SYSTEM_DATE_FORMAT);
}

export function monthStart(value?: DayjsInput): string {
	return (parseValue(value) || nowInConfiguredTimeZone()).startOf("month").format(SYSTEM_DATE_FORMAT);
}

export function monthEnd(value?: DayjsInput): string {
	return (parseValue(value) || nowInConfiguredTimeZone()).endOf("month").format(SYSTEM_DATE_FORMAT);
}

export function quarterStart(value?: DayjsInput): string {
	return (parseValue(value) || nowInConfiguredTimeZone()).startOf("quarter").format(SYSTEM_DATE_FORMAT);
}

export function quarterEnd(value?: DayjsInput): string {
	return (parseValue(value) || nowInConfiguredTimeZone()).endOf("quarter").format(SYSTEM_DATE_FORMAT);
}

export function yearStart(value?: DayjsInput): string {
	return (parseValue(value) || nowInConfiguredTimeZone()).startOf("year").format(SYSTEM_DATE_FORMAT);
}

export function yearEnd(value?: DayjsInput): string {
	return (parseValue(value) || nowInConfiguredTimeZone()).endOf("year").format(SYSTEM_DATE_FORMAT);
}
