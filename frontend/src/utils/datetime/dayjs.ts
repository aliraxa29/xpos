import dayjsLib from "dayjs";
import advancedFormat from "dayjs/plugin/advancedFormat";
import customParseFormat from "dayjs/plugin/customParseFormat";
import localizedFormat from "dayjs/plugin/localizedFormat";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjsLib.extend(advancedFormat);
dayjsLib.extend(customParseFormat);
dayjsLib.extend(localizedFormat);
dayjsLib.extend(quarterOfYear);
dayjsLib.extend(utc);
dayjsLib.extend(timezone);

export const dayjs = dayjsLib;

export type DayjsInput = dayjsLib.ConfigType;
export type DayjsInstance = dayjsLib.Dayjs;
